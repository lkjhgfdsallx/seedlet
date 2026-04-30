import { type Content, text, toContent } from "./content";
import { stringify } from "./json";
import { applySchema, type TypedSchema } from "./schema";
import {
  type ChatMemory,
  type ChatMemoryPatch,
  ContentMemoryNonSerializablePatch,
  type Tool,
  type ToolCallResponse,
  type ToolHandler,
  type Tools
} from "./tool";

/**
 * 枚举类型的字符串联合，表示所有识别的聊天角色。
 */
export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "function" // legacy OpenAI
  | "system_function" // internal use
  | "tool_response" // OpenAI variant
  | "assistant_function_call"; // transitional internal role

/** 所有消息变体的基础结构。 */
interface BaseMessage<R extends MessageRole> {
  role: R;
}

/** 由系统或开发者指令发送的消息。 */
export interface SystemMessage extends BaseMessage<"system"> {
  content: Content;
}

/** 人类用户消息。 */
export interface UserMessage extends BaseMessage<"user"> {
  content: Content;
  /** 这是为代理步骤生成的吗？ */
  fake?: boolean;
}

/** 可能包含工具调用的助手回复。 */
export interface AssistantMessage extends BaseMessage<"assistant"> {
  content: Content | null;
  tool_calls?: ToolCall[];
}

/** 由工具处理程序生成的响应。 */
export interface ToolMessage extends BaseMessage<"tool"> {
  tool_call_id: string;
  content: Content;
}

/** 函数（旧版 OpenAI）消息。 */
export interface FunctionMessage extends BaseMessage<"function"> {
  name: string;
  content: Content;
}

/** 可辨识联合，涵盖框架使用的每种消息类型。 */
export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage
  | FunctionMessage;

/** 创建 **user** 消息的便捷工厂函数。 */
export const UserMessage = (c: string | Content): UserMessage => ({
  role: "user",
  content: toContent(c)
});

/** 创建 **system** 消息的便捷工厂函数。 */
export const SystemMessage = (c: string | Content): SystemMessage => ({
  role: "system",
  content: toContent(c)
});

/** 创建 **assistant** 消息的便捷工厂函数（可选包含工具调用）。 */
export const AssistantMessage = (
  c: string | Content | null,
  tool_calls?: ToolCall[]
): AssistantMessage => ({
  role: "assistant",
  content: toContent(c),
  ...(tool_calls ? { tool_calls } : {})
});

/** 附加到助手回合的单个工具调用的模式。 */
export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
};

/** 类型守卫，检测助手消息是否包含工具调用。 */
export const isAssistantToolCall = (
  msg: Message | undefined
): msg is AssistantMessage & { tool_calls: ToolCall[] } =>
  msg?.role === "assistant" &&
  Array.isArray(msg.tool_calls) &&
  msg.tool_calls.length > 0;

/** 解析并验证 {@link ToolCall} 的 `arguments` 字段。 */
export const getToolArguments = (
  input: string | Record<string, unknown>
): Record<string, unknown> => {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (_err) {
      const snippet = input.slice(0, 80) + (input.length > 80 ? "…" : "");
      throw new Error(`Failed to parse tool arguments string: ${snippet}`);
    }
  }
  return input;
};

/**
 * 将 {@link ToolCallResponse} 规范化为单个 {@link Content} 项。
 * 当目标提供者无法处理结构化负载时，回退到人类可读的文本。
 */
const normalizeToolResponse = <Memory extends ChatMemory, Out>(
  response: ToolCallResponse<Memory, Out>,
  mode: "openai" | "mcp"
): Content => {
  if (response.error) return text(`Error: ${response.error}`);
  if (!response.content || response.content.length === 0)
    return text("Empty response.");
  // @todo 仅第一个响应？
  // biome-ignore lint/style/noNonNullAssertion: 类型已收窄
  if (mode === "mcp") return response.content[0]!;

  // OpenAI 回退 → 展平为字符串。
  const flat = response.content
    .map((c) => {
      if (c.type === "text") return c.text;
      if (c.type === "json") return stringify(c.data);
      if (c.type === "image") return `[Image: ${c.mimeType ?? "unknown"}]`;
      return "[Unsupported content type]";
    })
    .join("\n\n");
  return text(flat);
};

/** 执行单个 {@link ToolCall}。 */
export const executeToolCall = async <
  In extends Record<string, unknown>,
  Out,
  Memory extends ChatMemory
>(
  toolCall: ToolCall,
  handler: ToolHandler<In, Out, Memory>,
  schema: TypedSchema<In>,
  memory: Memory,
  mode: "openai" | "mcp" = "openai"
): Promise<{ message: ToolMessage; memPatch?: ChatMemoryPatch<Memory> }> => {
  try {
    const parsedArgs = getToolArguments(toolCall.function.arguments);
    const checkedArgs = applySchema(schema, parsedArgs as Partial<In>);

    const {
      error,
      content,
      [ContentMemoryNonSerializablePatch]: memPatch
    } = await handler(checkedArgs, memory);

    return {
      message: {
        role: "tool",
        tool_call_id: toolCall.id,
        content: normalizeToolResponse({ content, error }, mode)
      },
      memPatch
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Unknown error during tool execution";
    return {
      message: { role: "tool", tool_call_id: toolCall.id, content: text(msg) }
    };
  }
};

/** 检测冲突并组合内存补丁的有序列表。 */
export const composePatches = <M extends ChatMemory>(
  memory: M,
  patches: (ChatMemoryPatch<M> | undefined)[]
): M => {
  let acc = memory;
  const written = new Set<string>();

  for (const patch of patches) {
    if (!patch) continue;
    const beforeKeys = Object.keys(acc);
    acc = patch(acc);
    for (const k of Object.keys(acc)) {
      if (!beforeKeys.includes(k) || acc[k] !== memory[k]) {
        if (written.has(k))
          throw new Error(`Memory‑patch conflict on key '${k}'.`);
        written.add(k);
      }
    }
  }
  return acc;
};

/** {@link callToolAndAppend} 接受的运行时选项。 */
export interface CallToolOptions {
  mode?: "openai" | "mcp";
  logger?: Pick<Console, "log" | "warn" | "error">;
}

/**
 * 检测最后一条助手消息中的工具调用，按顺序执行它们，
 * 添加生成的工具消息，并合并所有内存补丁。
 */
export const callToolAndAppend = async <Memory extends ChatMemory>(
  messages: readonly Message[],
  memory: Memory,
  tools: Tools<Memory> = {},
  { mode = "openai", logger = console }: CallToolOptions = {}
): Promise<{ messages: readonly Message[]; memory: Memory }> => {
  if (!messages.length) return { messages, memory };
  const last = messages[messages.length - 1];
  if (!isAssistantToolCall(last)) return { messages, memory };

  // Duplicate‑ID guard.
  const ids = last.tool_calls.map((c) => c.id);
  if (new Set(ids).size !== ids.length)
    logger.error("Duplicate tool_call IDs detected.");

  const results: {
    message: ToolMessage;
    memPatch?: ChatMemoryPatch<Memory>;
  }[] = [];
  for (const call of last.tool_calls) {
    const def = tools[call.function.name];
    if (!def) {
      results.push({
        message: {
          role: "tool",
          tool_call_id: call.id,
          content: text(`No handler for tool \"${call.function.name}\"`)
        }
      });
      continue;
    }
    const { handler, tool } = typeof def === "function" ? await def() : def;
    results.push(
      await executeToolCall(
        call,
        handler,
        tool.function.parameters,
        memory,
        mode
      )
    );
  }

  return {
    messages: [...messages, ...results.map((r) => r.message)],
    memory: composePatches(
      memory,
      results.map((r) => r.memPatch)
    )
  };
};

/** 聊天完成请求的与提供者无关的部分。 */
export interface CompletionRequestBase {
  model: string;
  messages: readonly Message[];
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  user?: string;
  seed?: number;
  temperature?: number;
}

/** OpenAI HTTP 端点理解的额外参数。 */
export interface CompletionRequestOpenAI {
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  tools?: readonly Tool[];
  tool_choice?:
    | "none"
    | "auto"
    | { type: "function"; function: { name: string } };
}

/** 我们的 HTTP 包装器接受的完整请求对象。 */
export type CompletionRequest = CompletionRequestBase & CompletionRequestOpenAI;
