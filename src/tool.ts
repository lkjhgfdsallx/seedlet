/**
 * @module tool
 *
 * seedlet 的工具元数据、辅助工厂和注册表实现。
 * 所有公共导出都有单独的文档；此头部为生成的文档门户提供快速
 * 概览。
 *
 * ### 核心概念
 * - **Tool**: 可调用函数的 JSON‑Schema 描述。
 * - **ToolHandler**: 由框架调用的异步函数。
 * - **ToolCallResponse**: MCP 风格的响应对象。
 * - **ToolRegistry**: 解析和执行工具的内存容器。
 */

import { type Content, toContent } from "./content";
import type { JSONSchemaObject, TypedSchema } from "./schema";

/** 描述可调用工具的 OpenAI 风格 JSON schema。 */
export type Tool = {
  type: "function";
  function: {
    /** 唯一的 kebab‑case 标识符 */
    name: string;
    /** 展示给 LLM 的简短人类可读描述 */
    description?: string;
    /** 传递给处理器的 `arguments` 的 JSON Schema */
    parameters: JSONSchemaObject;
  };
};

/** 在步骤之间共享的透明、可序列化的键值对集合。 */
export type ChatMemory = Record<string, unknown>;

/** 返回*新*内存快照的纯函数。 */
export type ChatMemoryPatch<M extends ChatMemory> = (state: M) => M;

/** MCP 扩展头字段。 */
export const ContentJSON = "x-content";
export const ContentMemoryNonSerializablePatch = "x-memPatch";
/** 为未来扩展保留的键。 */
export const ContentMemoryLambdascriptPatch = "x-memLambda";

/** 由 {@link ToolHandler} 返回的响应。 */
export type ToolCallResponse<Memory extends ChatMemory, Out> = {
  /** 首选的富内容负载。 */
  content?: readonly Content[];
  /** 错误字符串；与 `content` *互斥*。 */
  error?: string;
  /** 为缺少 `content` 的提供者提供的结构化输出。 */
  [ContentJSON]?: Out;
  /** 用于修改内存的 Lambdascript 程序。 */
  [ContentMemoryLambdascriptPatch]?: string;
  /** 内部不可序列化的修改。 */
  [ContentMemoryNonSerializablePatch]?: ChatMemoryPatch<Memory>;
};

/** 传递给 {@link content} 的可选参数。 */
export interface ToolContentOptions<Memory extends ChatMemory> {
  memory?: Memory;
  memPatch?: ChatMemoryPatch<Memory>;
}

/**
 * 构建携带内存修改的元数据对象。
 */
const buildMeta = <Memory extends ChatMemory>({
  memPatch
}: ToolContentOptions<Memory> = {}) => ({
  ...(memPatch ? { [ContentMemoryNonSerializablePatch]: memPatch } : {})
});

/**
 * 返回成功的 {@link ToolCallResponse} 的辅助函数。
 */
export const content = <
  Memory extends ChatMemory,
  Out extends unknown[] | unknown
>(
  value: Out,
  opts?: ToolContentOptions<Memory>
): ToolCallResponse<Memory, Out> => ({
  content: Array.isArray(value) ? value.map(toContent) : [toContent(value)],
  ...buildMeta(opts)
});

/**
 * 返回错误 {@link ToolCallResponse} 的辅助函数。
 */
export const error = (
  v: string | Error
): ToolCallResponse<ChatMemory, never> => ({
  error: v instanceof Error ? v.message : v
});

/** 实现工具逻辑的异步函数。 */
export type ToolHandler<
  In = unknown,
  Out = unknown,
  Memory extends ChatMemory = ChatMemory
> = (args: In, memory: Memory) => Promise<ToolCallResponse<Memory, Out>>;

/** 内部工具是可信的，外部工具可能通过网络访问。 */
export const InternalTool = "internal" as const;
export const ExternalTool = "external" as const;
export type ToolType = typeof InternalTool | typeof ExternalTool;

/** 结合 {@link Tool} 描述及其处理器的运行时结构。 */
export type RegisteredTool<In, Out, Memory extends ChatMemory> = {
  type: ToolType;
  tool: Tool;
  handler: ToolHandler<In, Out, Memory>;
};

/** 注册表映射；值可能是返回 {@link RegisteredTool} 的延迟加载器。 */
export type Tools<Memory extends ChatMemory> = {
  [
    name: string
  ]: // biome-ignore lint/suspicious/noExplicitAny: generic registry
    | RegisteredTool<any, any, Memory>
    // biome-ignore lint/suspicious/noExplicitAny: generic registry
    | (() => Promise<RegisteredTool<any, any, Memory>>);
};

/**
 * 将 {@link Tools} 映射解析为提供者所需的静态列表。
 */
export const toolList = async <Memory extends ChatMemory>(
  tools: Tools<Memory>
): Promise<readonly Tool[]> =>
  Promise.all(
    Object.entries(tools).map(async ([, v]) =>
      typeof v === "function" ? (await v()).tool : v.tool
    )
  );

/** 在一个表达式中注册工具的工厂。 */

/**
 * 在一次调用中生成 {@link RegisteredTool} 的工厂。
 */
export const tool = <
  In extends Record<string, unknown>,
  Out,
  Memory extends ChatMemory
>(
  name: string,
  description: string,
  parameters: TypedSchema<In>,
  handler: ToolHandler<In, Out, Memory>,
  type: ToolType = InternalTool
): RegisteredTool<In, Out, Memory> => ({
  type,
  tool: {
    type: "function",
    function: { name, description, parameters }
  },
  handler
});

/**
 * 确定性地组合内存补丁；如果两个补丁写入相同的键则抛出错误。
 */
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

/**
 * 轻量级的内存注册表。不保存全局状态。
 */
export class ToolRegistry<Memory extends ChatMemory> {
  private readonly _tools: Tools<Memory>;
  constructor(initial: Tools<Memory> = {}) {
    this._tools = initial;
  }

  /** 工具的浅拷贝 */
  get tools() {
    return { ...this._tools };
  }

  /** 注册或覆盖工具。 */
  add = <In, Out>(reg: RegisteredTool<In, Out, Memory>) => {
    this._tools[reg.tool.function.name] = reg;
  };
  /** 从注册表中移除工具。 */
  remove = (name: string) => {
    delete this._tools[name];
  };
  /** 急切解析的工具描述符列表。 */
  get list() {
    return toolList(this._tools);
  }
  /** 工具映射的只读快照。 */
  get snapshot(): Tools<Memory> {
    return { ...this._tools };
  }

  /**
   * 同步执行单个工具并返回增强的响应，
   * 当产生补丁时包含更新的内存快照。
   */
  async call<In, Out>(
    name: string,
    args: In,
    memory: Memory
  ): Promise<ToolCallResponse<Memory, Out>> {
    const entry = this._tools[name];
    if (!entry) throw new Error(`Tool \"${name}\" not found`);
    const { handler } = typeof entry === "function" ? await entry() : entry;
    return handler(args, memory);
  }
}
