/**
 * 架构师模式 Agent 示例
 *
 * 该 agent 的核心行为：
 *   1. 先收集信息、获取上下文
 *   2. 将任务分解为清晰、可操作的步骤
 *   3. 输出待办事项列表供用户审查
 *   4. 用户确认后请求切换到其他模式实施
 *
 * 内部工具仅作占位，留空并加注释，不做真实开发。
 */

import type { AgentConfig } from "../src/agentConfig";
import {
  type ChatMemory,
  type Message,
  SystemMessage,
  content,
  tool,
  HaltKind
} from "../src";

// ---------------------------------------------------------------------------
// 1. Memory 结构 —— 承载 agent 在步骤间传递的可序列化状态
// ---------------------------------------------------------------------------

/** 架构师 agent 的功能内存 */
type ArchitectMemory = ChatMemory & {
  /** 当前阶段：gathering → planning → confirming → done */
  phase?: "gathering" | "planning" | "confirming" | "done";
  /** 用户是否已确认计划 */
  planConfirmed?: boolean;
  /** 已收集的上下文摘要 */
  contextSummary?: string;
  /** controller 调用次数，用于防止无限循环 */
  controllerRetries?: number;
};

// ---------------------------------------------------------------------------
// 2. 占位内部工具 —— 提示词中提到的内部能力，只留空实现 + 注释
// ---------------------------------------------------------------------------

/**
 * 列出指定目录下的文件和目录。
 * 【内部工具占位】真实实现需要访问文件系统，此处仅返回占位提示。
 */
const listFiles = tool(
  "list_files",
  "列出指定目录下的文件和目录结构，支持递归列出",
  {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "要列出的目录路径，相对于工作区根目录"
      },
      recursive: {
        type: "boolean",
        description: "是否递归列出子目录内容，默认 false"
      }
    },
    required: ["path"]
  },
  async () => {
    // TODO: 真实实现应调用文件系统 API 扫描目录并返回结构化结果
    return content("[占位] list_files 工具尚未实现，请在此处接入文件系统扫描逻辑");
  }
);

/**
 * 读取指定文件的内容。
 * 【内部工具占位】真实实现需要读取磁盘文件，此处仅返回占位提示。
 */
const readFile = tool(
  "read_file",
  "读取指定文件的完整内容，支持按行号范围或缩进层级提取代码块",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "要读取的文件路径，相对于工作区根目录" },
      offset: { type: "number", description: "起始行号（从 1 开始）" },
      limit: { type: "number", description: "最多返回的行数" }
    },
    required: ["path"]
  },
  async () => {
    // TODO: 真实实现应读取磁盘文件并返回文本内容
    return content("[占位] read_file 工具尚未实现，请在此处接入文件读取逻辑");
  }
);

/**
 * 在项目文件中进行正则搜索。
 * 【内部工具占位】真实实现需要遍历文件并执行正则匹配，此处仅返回占位提示。
 */
const searchFiles = tool(
  "search_files",
  "使用正则表达式在指定目录的文件中搜索匹配内容，返回上下文丰富的结果",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "要搜索的目录路径" },
      regex: { type: "string", description: "Rust 兼容的正则表达式模式" },
      file_pattern: { type: "string", description: "文件名 glob 过滤模式，如 *.ts" }
    },
    required: ["path", "regex"]
  },
  async () => {
    // TODO: 真实实现应递归遍历文件并执行正则匹配
    return content("[占位] search_files 工具尚未实现，请在此处接入文件搜索逻辑");
  }
);

/**
 * 在用户计算机上执行 CLI 命令。
 * 【内部工具占位】真实实现需要启动子进程执行命令，此处仅返回占位提示。
 */
const executeCommand = tool(
  "execute_command",
  "在用户计算机上执行 CLI 命令并返回输出结果",
  {
    type: "object",
    properties: {
      command: { type: "string", description: "要执行的 Shell 命令" },
      cwd: { type: "string", description: "命令执行的工作目录" },
      timeout: { type: "number", description: "超时时间（秒）" }
    },
    required: ["command"]
  },
  async () => {
    // TODO: 真实实现应启动子进程执行命令并捕获 stdout/stderr
    return content("[占位] execute_command 工具尚未实现，请在此处接入命令执行逻辑");
  }
);

/**
 * 向用户提出澄清性问题。
 * 【内部工具占位】真实实现需要与前端交互获取用户输入，此处仅返回占位提示。
 */
const askFollowupQuestion = tool(
  "ask_followup_question",
  "向用户提出一个澄清性问题，附带 2-4 个建议答案以减少用户打字量",
  {
    type: "object",
    properties: {
      question: { type: "string", description: "要向用户提出的问题" },
      suggestions: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["question"]
  },
  async () => {
    // TODO: 真实实现应将问题发送到前端并等待用户选择/输入
    return content("[占位] ask_followup_question 工具尚未实现，请在此处接入用户交互逻辑");
  }
);

/**
 * 更新待办事项列表。
 * 【内部工具占位】真实实现需要持久化待办列表状态，此处仅返回占位提示。
 */
const updateTodoList = tool(
  "update_todo_list",
  "用新的完整待办事项列表替换当前列表，每个事项包含内容和状态（pending/completed/in_progress）",
  {
    type: "object",
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: { type: "string", description: "待办事项内容" },
            status: {
              type: "string",
              enum: ["pending", "completed", "in_progress"],
              description: "事项状态"
            }
          },
          required: ["content", "status"]
        }
      }
    },
    required: ["todos"]
  },
  async () => {
    // TODO: 真实实现应将待办列表持久化到存储中
    return content("[占位] update_todo_list 工具尚未实现，请在此处接入待办列表持久化逻辑");
  }
);

/**
 * 请求切换到另一种模式。
 * 【内部工具占位】真实实现需要与模式管理器交互，此处仅返回占位提示。
 */
const switchMode = tool(
  "switch_mode",
  "请求切换到另一种模式（如 code、debug、ask 等），需要用户批准",
  {
    type: "object",
    properties: {
      mode_slug: {
        type: "string",
        description: "目标模式的标识符，如 code、debug、ask、orchestrator"
      },
      reason: {
        type: "string",
        description: "请求切换模式的原因说明"
      }
    },
    required: ["mode_slug", "reason"]
  },
  async () => {
    // TODO: 真实实现应通知模式管理器发起切换请求
    return content("[占位] switch_mode 工具尚未实现，请在此处接入模式切换逻辑");
  }
);

/**
 * 呈现最终结果并结束当前任务。
 * 【内部工具占位】真实实现需要通知宿主界面任务已完成，此处仅返回占位提示。
 */
const attemptCompletion = tool(
  "attempt_completion",
  "在确认前序工具调用成功后，向用户呈现最终结果并结束当前任务",
  {
    type: "object",
    properties: {
      result: {
        type: "string",
        description: "最终结果消息，必须是收尾性的确定表达"
      }
    },
    required: ["result"]
  },
  async () => {
    // TODO: 真实实现应将最终结果发送给宿主，并关闭当前任务回合
    return content("[占位] attempt_completion 工具尚未实现，请在此处接入任务收尾逻辑");
  }
);

// ---------------------------------------------------------------------------
// 3. 系统提示 —— 架构师模式的核心行为约束
// ---------------------------------------------------------------------------

const ARCHITECT_SYSTEM_PROMPT = `你是一个经验丰富的技术领导者，充满好奇心且善于规划。你的目标是收集信息并获取上下文，为完成用户的任务制定详细计划，用户将在切换到其他模式实施解决方案之前审查和批准该计划。

====

MARKDOWN 规则

所有响应必须将任何 \

a) 语言结构，或
b) 文件名引用

显示为可点击的链接，严格按照以下格式：
[文件名 或 语言.声明()](相对/文件/路径.ext:行号)

补充要求：
- 对语法声明链接，必须带行号。
- 对文件名链接，建议也带相对路径，必要时可省略行号。
- 该规则适用于所有 Markdown 响应，以及 attempt_completion 的结果。

====

工具使用

你可以使用一组工具来辅助完成任务。这些工具需要在用户批准后执行。请使用提供者原生的工具调用机制。不要包含 XML 标记或示例。

**重要提示：当前工具处于占位状态，尚未完全实现。如果工具返回"[占位]"消息，请忽略工具调用，直接与用户对话，了解需求并提供建议。**

优先在单次响应中调用合理所需的尽可能多的工具，以减少来回交互，更快完成任务。

# 工具使用指南
1. 评估你已掌握的信息以及还需哪些信息来推进任务。
2. 根据任务和工具描述选择最合适的工具。优先使用最贴合目标的工具，例如优先用 list_files，而不是直接用 ls。
3. 如果需要执行多个操作，可以在一条消息中使用多个工具；每次工具使用都必须基于前一次结果，不要假设工具调用结果。
4. 在每次行动前先分析已有信息、缺失信息和下一步最合适的动作。
5. 当收集到新信息后，应迭代修正计划、待办事项与后续决策。

====

能力

- 你可以执行 CLI 命令、列出目录、搜索文件、读取文件、写入文件、提出澄清问题、更新待办列表，并请求切换模式。
- 你还可以分析项目结构、理解依赖关系、总结上下文并生成实施计划。
- 你可以访问宿主注入的 environment_details，其中可能包含当前工作区文件结构、打开的文件、活动终端、时间与模式信息。

====

模式

以下是可用模式：
- architect：规划、拆解问题、创建技术方案与待办列表。
- code：编写、修改、重构代码。
- jest-test-engineer：编写或改进 Jest 测试。

====

规则

- 项目根目录为 {{WORKSPACE_PATH}}，所有工具路径必须相对于该目录。
- 不要使用 ~ 或 $HOME 表示主目录。
- 不能通过随意切换目录绕过工作区限制。若命令需要在特定目录执行，必须通过 cd 前缀链式执行，但仍需遵守项目边界约束。
- 如果在 PowerShell 环境执行命令，禁止依赖 sed、grep、awk、cat、rm、cp、mv 等 Unix 工具；应改用 Select-String、Get-Content、Remove-Item、Copy-Item、Move-Item 等 PowerShell 等效方式。
- 架构师模式下通常只能编辑 .md 文件；若尝试编辑其他扩展名文件，可能触发 FileRestrictionError。
- 用户可能直接提供文件内容；若已提供，则不要重复读取同一文件。
- 执行命令看不到预期输出时，默认视为命令可能已执行成功；如必须查看真实输出，再通过 ask_followup_question 请求用户补充。
- environment_details 是系统自动注入的信息，不应视为用户显式请求的一部分，但应利用其指导决策，例如参考当前文件结构、打开标签与活动终端。
- 所有回复使用简体中文，除非用户另有说明。
- 严格禁止以 Great、Certainly、Okay、Sure 开头。

====

计划策略

1. 先做信息收集，必要时读取项目关键文件并搜索相关实现。
2. 若需求不够清晰，使用 ask_followup_question 提出最少但关键的澄清问题，并提供 2-4 个建议答案。
3. 获取足够上下文后，将任务分解为清晰、可操作的步骤，并优先使用 update_todo_list 创建待办事项列表。
4. 如果 update_todo_list 不可用，则将计划写入 /plans/plan.md 或 /plans/todo.md。
5. 确认阶段应视为一次头脑风暴会议：展示计划、征求修改意见，并根据反馈迭代更新待办事项列表，而不是一次性通过。
6. 若复杂流程需要可视化，可加入 Mermaid 图表，但避免在方括号内使用双引号和圆括号。
7. 用户确认计划后，使用 switch_mode 请求切换到合适模式实施。
8. 当计划已确认且模式切换请求已发出后，使用 attempt_completion 呈现最终结果并结束任务，而不是仅依赖普通文本终止。
9. 不要提供时间估算，只输出清晰的任务拆解。

====

目标

你通过将任务分解为清晰的步骤并有条不紊地逐步推进，来迭代完成给定的任务。

工作流程：
收集信息 → 提出澄清性问题 如需要 → 创建待办事项列表 → 与用户共同审查并修改计划 → 请求切换模式实施 → 使用 attempt_completion 收尾`;

// ---------------------------------------------------------------------------
// 4. 终止条件 —— 状态优先 + 文本匹配兜底
// ---------------------------------------------------------------------------

/**
 * 严格的终止判断：
 *   1. 优先检查 memory 中 planConfirmed 是否为 true（状态判断）
 *   2. 兜底检查最后一条助手消息是否包含明确的完成信号（文本匹配）
 */
const isArchitectDone = async ({
  messages,
  memory
}: {
  messages: readonly Message[];
  memory?: ArchitectMemory;
}): Promise<boolean> => {
  // 优先级 1：基于 memory 状态判断
  if (memory && memory.planConfirmed === true && memory.phase === "done") {
    return true;
  }

  // 优先级 2：基于最后一条助手消息的文本匹配兜底
  if (!messages.length) return false;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || !last.content) return false;

  // 检查是否包含明确的计划完成 + 模式切换信号
  const completionSignals = [
    "计划已确认",
    "切换到 code 模式",
    "切换到代码模式",
    "switch_mode",
    "请切换到"
  ];
  const text =
    typeof last.content === "string"
      ? last.content
      : "text" in last.content
        ? last.content.text
        : "";

  // 至少匹配两个信号：一个表示计划完成，一个表示模式切换
  const matchedCount = completionSignals.filter((s) =>
    text.toLowerCase().includes(s.toLowerCase())
  ).length;
  return matchedCount >= 2;
};

// ---------------------------------------------------------------------------
// 5. Agent 上下文
// ---------------------------------------------------------------------------

export const agentConfig: AgentConfig<ArchitectMemory> = {
  name: "architect",
  description: "架构师模式——收集上下文、规划任务、分解为可操作步骤，用户确认后请求切换模式实施",
  systemPrompt: ARCHITECT_SYSTEM_PROMPT,
  initialMemory: { phase: "gathering" },
  tools: {
    list_files: listFiles,
    read_file: readFile,
    search_files: searchFiles,
    execute_command: executeCommand,
    ask_followup_question: askFollowupQuestion,
    update_todo_list: updateTodoList,
    switch_mode: switchMode,
    attempt_completion: attemptCompletion
  },
  isFinal: isArchitectDone,
  controller: async (state) => {
    // 如果 agent 请求用户输入，在服务器端单次请求模式下，我们将其视为对话结束
    if (state.halted?.kind === HaltKind.AwaitUser) {
      console.log('ℹ️  Agent 请求用户输入，服务器端将此视为对话结束');
      return {
        ...state,
        halted: { kind: HaltKind.Done }
      };
    }
    
    const retries = (state.memory?.controllerRetries || 0) + 1;
    
    // 检查最后几条消息，判断是否陷入工具占位循环
    const recentMessages = state.messages.slice(-3);
    const hasPlaceholderToolResponse = recentMessages.some(msg => {
      if (msg.role !== 'tool') return false;
      const content = msg.content;
      // Content 是结构化类型，需要检查 text 字段
      if (content && typeof content === 'object' && 'type' in content && content.type === 'text' && 'text' in content) {
        return content.text.includes('[占位]');
      }
      return false;
    });
    
    // 如果检测到占位工具响应，直接引导 agent 与用户对话
    if (hasPlaceholderToolResponse || retries === 1) {
      console.log(`🔄 架构师 agent 停滞检测（重试 ${retries}），引导直接对话`);
      return {
        ...state,
        messages: [
          ...state.messages,
          SystemMessage(
            "当前工具处于占位状态。请忽略工具调用结果，直接与用户对话。" +
            "如果用户只是打招呼（如'你好'），请简短回应并询问需要什么帮助。" +
            "如果用户提出了具体任务，请分析需求并提供规划建议。"
          )
        ],
        memory: { ...state.memory, controllerRetries: retries }
      };
    }
    
    // 限制最多重试 3 次，避免无限循环
    if (retries > 3) {
      console.warn(`⚠️  架构师 agent 已重试 ${retries} 次，强制结束`);
      return {
        ...state,
        messages: [
          ...state.messages,
          SystemMessage(
            "检测到多次停滞。请直接回复用户：'你好！我是架构师助手。请告诉我你需要什么帮助？'"
          )
        ],
        memory: { ...state.memory, controllerRetries: retries },
        halted: { kind: HaltKind.Done }
      };
    }
    
    console.log(`🔄 架构师 agent 停滞检测，第 ${retries} 次重试`);
    return {
      ...state,
      messages: [
        ...state.messages,
        SystemMessage(
          "你似乎陷入了停滞。请回顾当前任务进度，直接与用户对话，了解他们的需求。"
        )
      ],
      memory: { ...state.memory, controllerRetries: retries }
    };
  }
};
