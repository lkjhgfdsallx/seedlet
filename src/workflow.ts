/**
 * seedlet 的轻量级、纯函数式代理运行时。
 *
 * 导出内容
 * -------
 * • {@link HaltStatus} – 可辨识联合类型，解释循环停止的原因。
 * • {@link AgentState} – 在步骤间传递的不可变快照。
 * • {@link SequenceOptions} – 用于调试和步骤限制的配置项。
 * • {@link AgentContext} – 行为契约（纯函数钩子）。
 * • {@link stepAgent} – 单次确定性转换。
 * • {@link loopAgent} – 迭代驱动器，直到停止。
 * • {@link Sequence} – 多阶段工作流的便捷封装。
 * • {@link runWorkflow} – 链式序列的高级辅助函数。
 */

import { isTextContent } from "./content";
import { stringify } from "./json";
import { type Message, UserMessage } from "./message";
import { type Model } from "./model";
import type { ChatMemory, ToolRegistry } from "./tool";
import { requestsUserInput } from "./yes";

/**
 * 枚举代理停止的原因。
 */
export enum HaltKind {
  AwaitUser = "await_user",
  ToolError = "tool_error",
  Done = "done",
  Stopped = "stopped"
}

/**
 * 可辨识的停止状态，可选择携带错误信息。
 */
export type HaltStatus<Err = unknown> =
  | { kind: HaltKind.AwaitUser }
  | { kind: HaltKind.ToolError; error: Err }
  | { kind: HaltKind.Done }
  | { kind: HaltKind.Stopped };

export const awaitUser: HaltStatus<unknown> = { kind: HaltKind.AwaitUser };

/** 在步骤间传递的不可变状态。 */
export type AgentState<Memory> = {
  /** 可选标识符，用于调试/遥测。 */
  readonly id?: string;
  /** 可调用模型实现的引用。 */
  readonly model: Model;
  /** 到目前为止的完整对话（不可变）。 */
  readonly messages: readonly Message[];
  /** 不透明的函数式内存 – 可以是任何可序列化的结构。 */
  readonly memory?: Memory;
  /** 停止条件（仍在运行时为 undefined）。 */
  readonly halted?: HaltStatus;
};

/** 单次序列运行的配置。 */
export interface SequenceOptions<Memory extends ChatMemory> {
  /** 要执行的最大额外模型调用次数。 */
  maxSteps?: number;
  /** 为 true 时，框架通过 `logger` 打印调试输出。 */
  debug?: boolean;
  /** 在链式序列时保留之前的 `getUserInput` 回调。 */
  preserveInput?: boolean;
  /** 结构化日志记录器 – 默认为全局 console 对象。 */
  logger?: Pick<Console, "log" | "warn" | "error">;
  /**
   * 用于代理循环管理的 ChatModel，例如判断助手是否需要用户输入
   * 必须从前端配置传入，不再使用默认值
   */
  yesModel: Model;
  /** 状态变更时的回调 */
  onStateChange?: (state: AgentState<Memory>) => void;
  onStart?: (state: AgentState<Memory>) => void;
  onStop?: (state: AgentState<Memory>) => void;
  /** 调用之间的延迟（毫秒），例如用于调试无限循环 */
  delay?: number;
}

/**
 * 代理行为契约。除了 `getUserInput` 允许执行 I/O 外，
 * 所有函数都必须是纯函数（无副作用）。
 */
export interface AgentContext<Memory extends ChatMemory> {
  /** 仅用于日志/调试的上下文名称。 */
  name?: string;
  /**
   * 系统指南生成器。应嵌入主要指令载荷。
   * 它*不会*自动插入到记录中；调用者需要在
   * 组合初始状态时执行此操作。
   */
  guidelines?: (memory: Memory) => Promise<string>;
  /** 当代理需要用户输入时，可选的请求用户输入的函数。 */
  getUserInput?: (
    ctx: AgentContext<Memory>,
    state: AgentState<Memory>
  ) => Promise<string>;
  /** 测试代理是否已达到其目标。 */
  isFinal: (state: AgentState<Memory>) => Promise<boolean>;
  /** 可调用的工具的可选注册表。 */
  registry?: ToolRegistry<Memory>;
  /**
   * 计算多阶段工作流中*下一个*序列的回调。
   * 返回 `undefined` 将在当前序列后结束工作流。
   */
  nextSequence?: (state: AgentState<Memory>) => Promise<{
    ctx: AgentContext<Memory>;
    state: AgentState<Memory>;
    options?: SequenceOptions<Memory>;
  }>;
  /**
   * 当循环检测到进度停滞时调用的恢复钩子。
   * 实现通常会附加一条 SystemMessage 来重新引导代理。
   */
  controller?: (state: AgentState<Memory>) => Promise<AgentState<Memory>>;
}

const isToolMessage = (msg?: Message) =>
  msg?.role === "tool" || msg?.role === "function";
const isAssistantMessage = (msg?: Message) => msg?.role === "assistant";
const isEmptyAssistantMessage = (msg?: Message) =>
  isAssistantMessage(msg) &&
  (!msg?.content ||
    (isTextContent(msg.content) && msg.content.text.trim() === ""));
const hasTwoAssistantInRow = (messages: readonly Message[]) =>
  messages.length > 1 &&
  isAssistantMessage(messages[messages.length - 1]) &&
  isAssistantMessage(messages[messages.length - 2]);

/** `stepAgent` 接受的选项。 */
export interface StepOptions {
  debug?: boolean;
  logger?: Pick<Console, "log" | "warn" | "error">;
  yesModel: Model;
}

/**
 * 将代理推进一个步骤（模型调用 ± 工具 ± 控制器）。
 */
export const stepAgent = async <Memory extends ChatMemory>(
  ctx: AgentContext<Memory>,
  state: AgentState<Memory>,
  options: StepOptions
): Promise<AgentState<Memory>> => {
  const log = options.logger?.log ?? console.log;
  const requestsInput = requestsUserInput(options.yesModel);

  // 调试日志
  if (options.debug) {
    const last = state.messages[state.messages.length - 1];
    log(
      `STEP id=${state.id ?? "-"} msgs=${state.messages.length} last=${last?.role} halted=${state.halted?.kind ?? "-"}`
    );
    for (const m of state.messages.slice(1)) log("💬", stringify(m));
    if (state.memory && typeof state.memory === "object")
      log(
        "💾 memory keys",
        Object.keys(state.memory as Record<string, unknown>)
      );
  }

  // 处理已停止状态
  if (state.halted) {
    switch (state.halted.kind) {
      case HaltKind.AwaitUser: {
        if (!ctx.getUserInput) {
          // 如果没有提供 getUserInput 处理函数，说明是服务器端单次请求模式
          // 将 AwaitUser 状态转换为 Done，让对话自然结束
          if (options.debug) {
            log("⚠️  Agent 请求用户输入但未提供 getUserInput 处理函数，将状态转换为 Done");
          }
          return {
            ...state,
            halted: { kind: HaltKind.Done }
          };
        }
        const content = await ctx.getUserInput(ctx, state);
        return {
          ...state,
          messages: [...state.messages, UserMessage(content)],
          halted: undefined
        };
      }
      case HaltKind.ToolError: {
        return ctx.controller ? ctx.controller(state) : state;
      }
      case HaltKind.Done:
      case HaltKind.Stopped:
        return state;
    }
  }

  // 模型（和工具）调用
  let output: { messages: readonly Message[]; memory?: Memory };
  try {
    output = await state.model.complete(state.messages, {
      memory: state.memory,
      tools: ctx.registry?.tools
    });
  } catch (error) {
    const halted: AgentState<Memory> = {
      ...state,
      halted: { kind: HaltKind.ToolError, error }
    };
    return ctx.controller ? ctx.controller(halted) : halted;
  }

  const messages = output.messages;
  const last = messages[messages.length - 1];
  const newState: AgentState<Memory> = {
    ...state,
    messages,
    memory: output.memory
  };

  // 停滞检测：无新消息 OR 空/重复助手响应
  const msgsUnchanged = messages.length === state.messages.length;
  const emptyAssistant = isEmptyAssistantMessage(last);
  const twoAssistant = hasTwoAssistantInRow(messages);
  const isStuck =
    msgsUnchanged ||
    (isAssistantMessage(last) && (emptyAssistant || twoAssistant));
  if (ctx.controller && isStuck) {
    return ctx.controller(newState);
  }

  // 工具消息：仅更新状态，不完成
  if (isToolMessage(last)) {
    return newState;
  }

  // 需要用户输入？
  if (last?.content && (await requestsInput(last.content))) {
    return { ...newState, halted: awaitUser };
  }

  // 达到最终目标（仅在助手响应时）
  if (isAssistantMessage(last) && (await ctx.isFinal(newState))) {
    return { ...newState, halted: { kind: HaltKind.Done } };
  }

  // 继续运行
  return newState;
};

/** timeout 是基于 Promise 的 setTimeout 调用 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 重复调用 `stepAgent`，直到代理停止或步骤预算耗尽。
 * 从递归转换为 `while` 循环，以避免长时间运行会话中的调用栈增长。
 */
export const loopAgent = async <Memory extends ChatMemory>(
  ctx: AgentContext<Memory>,
  initState: AgentState<Memory>,
  options: SequenceOptions<Memory>
): Promise<AgentState<Memory>> => {
  if (!options.yesModel) {
    throw new Error("loopAgent 需要 yesModel 参数，请从前端配置传入");
  }
  const logger = options.logger ?? console;
  let state = initState;
  let remaining = options.maxSteps ?? Number.POSITIVE_INFINITY;

  while (true) {
    if (options?.delay) await sleep(options.delay);

    if (options?.onStateChange) options.onStateChange(state);
    if (
      state.halted?.kind === HaltKind.Done ||
      state.halted?.kind === HaltKind.Stopped
    ) {
      return state;
    }
    if (remaining === 0) {
      return { ...state, halted: { kind: HaltKind.Stopped } };
    }
    if (options?.onStart) options.onStart(state);
    state = await stepAgent(ctx, state, {
      debug: options.debug,
      logger,
      yesModel: options.yesModel
    });
    if (options?.onStop) options.onStop(state);
    remaining =
      remaining === Number.POSITIVE_INFINITY
        ? Number.POSITIVE_INFINITY
        : remaining - 1;
  }
};

/** 封装单个代理步骤序列。 */
export class Sequence<Memory extends ChatMemory> {
  private _ctx: AgentContext<Memory>;
  private _state: AgentState<Memory>;
  private _options: SequenceOptions<Memory>;
  private _logger: Pick<Console, "log" | "warn" | "error">;

  constructor(
    ctx: AgentContext<Memory>,
    state: AgentState<Memory>,
    options: SequenceOptions<Memory>
  ) {
    if (!options.yesModel) {
      throw new Error("Sequence 需要 yesModel 参数，请从前端配置传入");
    }
    this._ctx = ctx;
    this._state = state;
    this._options = options;
    this._logger = options.logger ?? console;
  }

  get messages() {
    return this._state.messages;
  }

  /** 替换底层状态（例如，在外部持久化之后）。 */
  resetState = (state: AgentState<Memory>): void => {
    this._state = state;
  };

  /** 礼貌地请求模型停止流式传输（等待完成）。 */
  stop = async (): Promise<void> => {
    await this._state.model.stop();
  };

  /** 快照当前选项。 */
  private get options(): SequenceOptions<Memory> {
    return this._options;
  }

  /** 运行直到此序列产生 `halted.kind === 'done' | 'stopped'`。 */
  run = (): Promise<AgentState<Memory>> =>
    loopAgent(this._ctx, this._state, this.options);

  /**
   * 执行序列一次并返回*下一个*序列（可能是其自身）。
   */
  async next(): Promise<[Sequence<Memory>, AgentState<Memory>]> {
    const terminal = await this.run();

    if (terminal.halted?.kind === HaltKind.Done && this._ctx.nextSequence) {
      const {
        ctx: nextCtx,
        state: nextState,
        options: nextOpts
      } = await this._ctx.nextSequence(terminal);
      const preserved = nextOpts?.preserveInput
        ? this._ctx.getUserInput
        : undefined;
      if (this.options.debug)
        this._logger.log(
          `⏩ ${this._ctx.name} -> ${nextCtx.name} (preserved: ${preserved})`
        );
      const mergedCtx: AgentContext<Memory> = {
        ...nextCtx,
        getUserInput: nextCtx.getUserInput ?? preserved
      };
      // @todo 保留 yesModel？
      const mergedOpts: SequenceOptions<Memory> = {
        ...this.options,
        ...nextOpts
      };

      if (this.options.debug)
        this._logger.log(`☎︎  Sequence → ${nextState.id ?? "-"}`);
      return [new Sequence(mergedCtx, nextState, mergedOpts), terminal];
    }

    if (this.options.debug)
      this._logger.log(`🛑 Sequence ${terminal.id ?? "-"}`);
    return [this, terminal];
  }
}

export type WorkflowOptions<Memory extends ChatMemory> = {
  onSequenceChange?: (seq: Sequence<Memory>) => void;
};

/**
 * 执行由链式 `Sequence` 对象组成的工作流，直到不再产生新序列。
 * 返回最终的 `AgentState` 和有序的序列历史记录，用于检查/调试。
 */
export const runWorkflow = async <Memory extends ChatMemory>(
  init: Sequence<Memory>,
  options?: WorkflowOptions<Memory>
): Promise<{ final: AgentState<Memory>; history: Sequence<Memory>[] }> => {
  const history: Sequence<Memory>[] = [];
  let current = init;

  while (true) {
    history.push(current);
    const [next, state] = await current.next();
    current.resetState(state);

    if (options?.onSequenceChange) options.onSequenceChange(current);

    if (next === current) return { final: state, history };
    current = next;
  }
};
