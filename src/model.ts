import { toText } from "./content";
import {
  AssistantMessage,
  type CompletionRequest,
  callToolAndAppend,
  type Message,
  type ToolCall
} from "./message";
import { type ChatMemory, type Tools, toolList } from "./tool";

const isNode = typeof process !== "undefined" && !!process.versions?.node;

/** Ollama 本地模型服务 */

const OLLAMA_DEFAULT_ORIGIN = "http://localhost:11434";
const OLLAMA_PATH = "/api/chat";

export const OLLAMA_URL = (() => {
  let origin = OLLAMA_DEFAULT_ORIGIN;

  if (isNode && process.env.OLLAMA_HOST) {
    origin = process.env.OLLAMA_HOST.replace(/\/+$/, ""); // remove trailing slash(es)
  }

  return `${origin}${OLLAMA_PATH}`;
})();

/**
 * 创建 Ollama 模型配置的工厂函数
 * 注意：现在模型配置应该从前端传入，这些工厂函数仅供参考或测试使用
 */
export const ollama = (
  name: string,
  options?: Partial<ChatModelOptions>
): ChatModelOptions => ({
  url: OLLAMA_URL,
  name,
  stringifyContent: true,
  ...options
});

/** LM Studio 本地模型服务 */

const LMS_DEFAULT_ORIGIN = "http://localhost:1234";
const LMS_PATH = "/v1/chat/completions";

/**
 * 创建 LM Studio 模型配置的工厂函数
 * 注意：现在模型配置应该从前端传入，这些工厂函数仅供参考或测试使用
 */
export const lms = (
  name: string,
  options?: Partial<ChatModelOptions>
): ChatModelOptions => ({
  url: LMS_DEFAULT_ORIGIN + LMS_PATH,
  name,
  stringifyContent: true,
  ...options
});

/** OpenAI 云端模型服务 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * 创建 OpenAI 模型配置的工厂函数
 * 注意：现在模型配置应该从前端传入，这些工厂函数仅供参考或测试使用
 */
export const chatgpt = (name: string, key?: string): ChatModelOptions => ({
  url: OPENAI_URL,
  name,
  key: key || (isNode ? process.env?.CHATGPT_KEY : undefined),
  stringifyArguments: true
});

/**
 * 最小化的远程聊天模型包装器，支持可选的流式传输和优雅的
 * 取消功能。专为seedlet框架设计。
 *
 * ## 导出内容
 * - `ChatModelOptions` - {@link ChatModel} 构造函数可识别的选项。
 * - `ChatMessageAdder` - 异步辅助函数，将助手回复合并到
 *   正在进行的对话记录中。
 * - `Model` - 代理运行时期望的接口。
 * - `ChatModel` - 与OpenAI风格HTTP端点通信的具体实现。
 *
 * @module model
 */

/**
 * 实例化 {@link ChatModel} 时使用的选项。
 */
export interface ChatModelOptions {
  /** 接受OpenAI风格聊天完成JSON的HTTP端点。 */
  url: string;
  /** 传递给提供者的模型标识符。 */
  name: string;
  /** 用于 `Authorization: Bearer …` 的可选Bearer令牌。 */
  key?: string;
  /** 用于合并助手回复的可选自定义消息添加器。 */
  adder?: ChatMessageAdder;
  /** 工具参数必须序列化为字符串 (OpenAI) */
  stringifyArguments?: boolean;
  /** 消息内容应序列化为字符串 (ollama) */
  stringifyContent?: boolean;
  /** 覆盖所有消息的温度参数 */
  temperature?: number;
  /** 移除思考过程 */
  removeThink?: boolean;
  /** 禁用思考的提示词 */
  noThinkPrompt?: string;

  /** 自定义响应解析 */
  customResponse?: (res: Response) => Promise<AssistantMessage>;
}

// @todo 跳转到内容？
export const removeThinkSection = (input: string): string => {
  const start = input.indexOf("<think>");
  const end = input.lastIndexOf("</think>");

  if (start === -1 || end === -1 || end < start) return input.trim();

  return (input.slice(0, start) + input.slice(end + "</think>".length)).trim();
};

/**
 * 默认消息添加器：简单地将助手消息追加到历史记录中。
 */
export const defaultAdder = async (
  history: readonly Message[],
  assistant: Message
): Promise<readonly Message[]> => [...history, assistant];

/**
 * 自定义函数的签名，用于在下一步代理操作之前将助手回复
 * 合并到正在进行的对话记录中。
 */
export type ChatMessageAdder = typeof defaultAdder;

export type CompleteOptions<Memory extends ChatMemory> = {
  memory?: Memory;
  tools?: Tools<Memory>;
  /** 流式输出的回调函数 */
  onOutput?: (progress: string) => void;
};

/**
 * 模型必须实现的最小接口，以便在代理循环中使用。
 */
export interface Model {
  /** 人类可读的模型名称（例如 "gpt‑4o-mini"）。 */
  name?: string;
  /**
   * 生成下一个助手回合——包括任何工具调用——并返回
   * 更新后的对话记录以及（可能已更新的）记忆。
   */
  complete: <Memory extends ChatMemory>(
    input: readonly Message[],
    options?: CompleteOptions<Memory>
  ) => Promise<{ messages: readonly Message[]; memory: Memory }>;
  /** 中止正在进行的流式请求。 */
  stop: () => Promise<void>;
}

/**
 * 具体的HTTP聊天模型包装器。
 *
 * 支持流式传输（`options.stream = true`）并暴露 `stop()` 方法，
 * 该方法通过 `AbortController` 取消底层的 `fetch` 请求。
 */
export class ChatModel implements Model {
  readonly name: string;
  readonly options: ChatModelOptions;

  private readonly url: string;
  private readonly key?: string;
  private readonly adder: ChatMessageAdder;
  private _abortCtl: AbortController | null = null;

  constructor({ adder, ...opts }: ChatModelOptions) {
    if (!opts.url || !opts.name) {
      throw new Error("ChatModel 需要 url 和 name 参数，请从前端配置传入");
    }
    this.options = opts;
    const { url, name, key } = opts;
    this.url = url;
    this.name = name;
    this.key = key;
    this.adder = adder ?? defaultAdder;
  }

  private _formatMessages(messages: readonly Message[]) {
    if (!this.options.stringifyContent) return messages;
    return messages.map((msg, i) => ({
      ...msg,
      content: msg.content
        ? toText(msg.content) +
          (i === messages.length - 1 && this.options?.removeThink
            ? this.options?.noThinkPrompt || ""
            : "")
        : null
    }));
  }

  private _finalize(
    raw:
      | {
          message?:
            | AssistantMessage
            | { content: string; tool_calls?: ToolCall[] };
        }
      | { choices: AssistantMessage[] }
  ) {
    const msg =
      "message" in raw && raw.message && "content" in raw.message
        ? raw.message
        : "choices" in raw &&
            Array.isArray(raw.choices) &&
            raw.choices?.length &&
            // @todo support multiple choices
            raw.choices[0] &&
            "message" in raw.choices[0]
          ? (raw.choices[0].message as AssistantMessage)
          : null;
    if (!msg) {
      console.log({ raw });
      throw new Error("no message");
    }
    const message = AssistantMessage(
      this.options.removeThink && typeof msg.content === "string"
        ? removeThinkSection(msg.content)
        : msg.content || "",
      msg?.tool_calls
    );
    return { message };
  }

  /**
   * 执行聊天完成请求并返回提供者的原始响应。
   * 流式响应被连接成包含最终助手消息的单个JSON对象。
   */
  async invoke(
    chat: CompletionRequest
  ): Promise<{ message: AssistantMessage }> {
    if (this._abortCtl) this._abortCtl.abort();
    this._abortCtl = new AbortController();

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8"
    };
    if (this.key) headers.Authorization = `Bearer ${this.key}`;

    const request = {
      ...chat,
      temperature: chat.temperature ?? this.options.temperature ?? undefined,
      messages: this._formatMessages(chat.messages)
    } as CompletionRequest;

    console.log(`🌐 调用模型: ${this.name} @ ${this.url}`);
    console.log(`📨 请求消息数: ${request.messages.length}`);
    console.log(`🔧 工具数: ${request.tools?.length || 0}`);

    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: this._abortCtl.signal
      });

      console.log(`📡 响应状态: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ 模型调用失败: ${errorText}`);
        this._abortCtl = null;
        throw new Error(`模型调用失败 (${res.status}): ${errorText}`);
      }

      const raw = this.options.customResponse
        ? { message: await this.options.customResponse(res) }
        : ((await res.json()) as {
            message:
              | AssistantMessage
              | { content: string; tool_calls?: ToolCall[] };
          });

      console.log(`✅ 模型响应成功`);
      
      this._abortCtl = null;
      const result = this._finalize(raw);
      
      try {
        const content = result.message.content as string | object | null;
        let contentPreview = '(空内容)';
        if (typeof content === 'string') {
          contentPreview = content.slice(0, 100);
        } else if (content) {
          contentPreview = JSON.stringify(content).slice(0, 100);
        }
        console.log(`💬 响应内容预览: ${contentPreview}...`);
        console.log(`🔨 工具调用数: ${result.message.tool_calls?.length || 0}`);
      } catch (e) {
        console.log(`💬 响应内容: (无法预览)`);
      }
      
      return result;
    } catch (err) {
      this._abortCtl = null;
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(`⏹️  模型调用被中止`);
        throw err;
      }
      console.error(`❌ 模型调用异常:`, err);
      throw err;
    }
  }

  /** 构建特定于提供者的完成请求。 */
  async makeRequest<Memory extends ChatMemory>(
    messages: readonly Message[],
    tools?: Tools<Memory>
  ): Promise<CompletionRequest> {
    return {
      model: this.name,
      messages: messages as Message[],
      stream: !!this.options.customResponse, // @todo explicit option?
      tools: tools ? await toolList(tools) : undefined,
      tool_choice: "auto"
    };
  }

  /** @inheritdoc */
  async complete<Memory extends ChatMemory>(
    input: readonly Message[],
    options?: CompleteOptions<Memory>
  ) {
    const { message } = await this.invoke(
      await this.makeRequest(input, options?.tools)
    );
    const merged = await this.adder(input, message);
    return callToolAndAppend(
      merged,
      options?.memory || ({} as Memory),
      options?.tools
    );
  }

  /** @inheritdoc */
  stop = async () => {
    if (this._abortCtl) {
      this._abortCtl.abort();
      this._abortCtl = null;
    }
  };
}
