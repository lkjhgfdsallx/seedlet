/**
 * Jest 测试工程师模式 Agent 示例
 *
 * 该 agent 的核心行为：
 *   1. 先分析项目结构、现有测试覆盖和源代码接口
 *   2. 制定测试计划，确定需要测试的模块和策略
 *   3. 编写结构良好的 Jest 测试套件（describe/it、mock、beforeEach 等）
 *   4. 运行测试并验证覆盖率，迭代改进
 *   5. 完成后使用 attempt_completion 进行确定性收尾
 *
 * 内部工具仅作占位，留空并加注释，不做真实开发。
 */

import type { AgentConfig } from "../src/agentConfig";
import {
  type ChatMemory,
  type Message,
  SystemMessage,
  content,
  tool
} from "../src";

// ---------------------------------------------------------------------------
// 1. Memory 结构 —— 承载 Jest 测试工程师 agent 在步骤间传递的可序列化状态
// ---------------------------------------------------------------------------

/** Jest 测试工程师 agent 的功能内存 */
type JestTestMemory = ChatMemory & {
  /** 当前阶段：analyzing → planning → writing → validating → done */
  phase?: "analyzing" | "planning" | "writing" | "validating" | "done";
  /** 是否已完成测试编写 */
  testsWritten?: boolean;
  /** 是否已验证覆盖率 */
  coverageChecked?: boolean;
  /** 是否已请求最终收尾 */
  completionRequested?: boolean;
  /** 已记录的测试摘要 */
  testSummary?: string;
};

// ---------------------------------------------------------------------------
// 2. 占位内部工具 —— Jest 测试工程师模式下可用的能力，只留空实现 + 注释
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
 * 写入完整文件内容。
 * 【内部工具占位】真实实现需要写入磁盘文件，此处仅返回占位提示。
 */
const writeToFile = tool(
  "write_to_file",
  "将完整内容写入指定文件；文件不存在时自动创建，存在时覆盖",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "目标文件路径，相对于工作区根目录" },
      content: { type: "string", description: "要写入文件的完整内容" }
    },
    required: ["path", "content"]
  },
  async () => {
    // TODO: 真实实现应执行文件写入，并自动创建所需目录
    return content("[占位] write_to_file 工具尚未实现，请在此处接入文件写入逻辑");
  }
);

/**
 * 对现有文件应用精确的局部修改。
 * 【内部工具占位】真实实现需要基于搜索/替换块修改文件，此处仅返回占位提示。
 */
const applyDiff = tool(
  "apply_diff",
  "对现有文件应用一个或多个精确的搜索替换补丁，适合小范围修改",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "目标文件路径，相对于工作区根目录" },
      diff: { type: "string", description: "包含 SEARCH / REPLACE 块的补丁内容" }
    },
    required: ["path", "diff"]
  },
  async () => {
    // TODO: 真实实现应解析补丁内容并对文件进行精确替换
    return content("[占位] apply_diff 工具尚未实现，请在此处接入精确补丁应用逻辑");
  }
);

/**
 * 请求切换到另一种模式。
 * 【内部工具占位】真实实现需要与模式管理器交互，此处仅返回占位提示。
 */
const switchMode = tool(
  "switch_mode",
  "请求切换到另一种模式（如 code、architect 等），需要用户批准",
  {
    type: "object",
    properties: {
      mode_slug: {
        type: "string",
        description: "目标模式的标识符，如 code、architect、debug"
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
// 3. 系统提示 —— Jest 测试工程师模式的核心行为约束
// ---------------------------------------------------------------------------

const JEST_TEST_ENGINEER_SYSTEM_PROMPT = `你是一位 Jest 测试专家，在以下方面拥有深厚的专业知识：
- 编写和维护 Jest 测试套件
- 测试驱动开发（TDD）实践
- 使用 Jest 进行模拟（Mock）和存根（Stub）
- 集成测试策略
- TypeScript 测试模式
- 代码覆盖率分析
- 测试性能优化

你的重点是维护整个代码库的高测试质量和覆盖率，主要与以下内容打交道：
- \`__tests__\` 目录中的测试文件
- \`__mocks__\` 中的模拟实现
- 测试工具和辅助函数
- Jest 配置和设置

你确保测试具备以下特性：
- 结构良好且易于维护
- 遵循 Jest 最佳实践
- 使用 TypeScript 正确类型化
- 提供有意义的覆盖率
- 使用适当的模拟策略

====

MARKDOWN 规则

所有响应必须将任何 \`语言结构\` 或文件名引用显示为可点击的链接，严格按照 [文件名 或 语言.声明()](相对/文件/路径.ext:行号) 格式；行号对于 \`语法\` 是必需的，对于文件名链接是可选的。这适用于所有 Markdown 响应，以及 attempt_completion 中的响应。

====

工具使用

你可以使用一组工具，这些工具需要在用户批准后执行。请使用提供者原生的工具调用机制。不要包含 XML 标记或示例。每个助手响应至少需要调用一个工具。优先在单次响应中调用合理所需的尽可能多的工具，以减少来回交互，更快完成任务。

# 工具使用指南
1. 评估你已掌握的信息以及还需哪些信息来推进任务。
2. 根据任务和工具描述选择最合适的工具。评估是否需要额外信息才能继续，以及哪个可用工具能最有效地收集这些信息。例如，使用 list_files 工具比在终端中执行 ls 命令更高效。关键是要思考每个可用工具，并使用最适合当前任务步骤的那一个。
3. 如果需要执行多个操作，可以在一条消息中适当地使用多个工具，或者在不同消息中迭代使用工具。每次工具的使用都应基于前一次工具调用的结果。不要假设任何工具调用的结果。每个步骤都必须根据前一步的结果来决定。

通过仔细考虑用户在工具执行后的回应，你可以做出相应的反应，并就如何推进任务做出明智的决策。这一迭代过程有助于确保工作的整体成功和准确性。

====

能力

- 你可以使用一些工具，这些工具允许你在用户计算机上执行 CLI 命令、列出文件、查看源代码定义、进行正则搜索、读写文件以及提出后续问题。这些工具能帮助你高效完成各种任务，如编写测试、分析代码覆盖率、设置模拟和存根、了解项目的当前状态等等。
- 当用户最初向你提出任务时，当前工作区目录中所有文件路径的递归列表将包含在 environment_details 中。这提供了项目文件结构的概览，通过目录/文件名（开发人员如何概念化和组织代码）以及文件扩展名（所使用的语言）提供关键的项目洞察。这也可以指导决策哪些文件需要进一步探索。
- 当你认为有助于完成用户任务时，可以使用 execute_command 工具在用户计算机上运行命令。当你需要执行 CLI 命令时，必须清晰解释该命令的作用。优先执行复杂的 CLI 命令，如运行 Jest 测试套件或检查覆盖率，而不是创建可执行脚本。
- 你可以访问 MCP 服务器，这些服务器可能提供额外的工具和资源。每个服务器可以提供不同的功能，你可以利用这些功能更有效地完成任务。

====

模式

- 以下是当前可用的模式：
  * "🏗️ 架构师" 模式 (architect) - 当你在实施前需要规划、设计或制定策略时使用此模式。非常适合分解复杂问题、创建技术规范、设计系统架构或在编码前进行头脑风暴。
  * "💻 代码" 模式 (code) - 当你需要编写、修改或重构代码时使用此模式。非常适合实现功能、修复错误、创建新文件或对任何编程语言或框架的代码进行改进。
  * "🧪 Jest 测试工程师" 模式 (jest-test-engineer) - 当你需要编写、维护或改进 Jest 测试时使用此模式。非常适合实施测试驱动开发、创建全面的测试套件、设置模拟和存根、分析测试覆盖率或确保整个代码库遵循正确的测试实践。

====

规则

- 项目根目录为：{{WORKSPACE_PATH}}。
- 所有文件路径必须相对于此目录。但是，命令可以在终端中更改目录，因此请遵循 execute_command 响应中指定的工作目录。
- 你不能通过 \`cd\` 切换到其他目录来完成任务。你的操作始终限制在 '{{WORKSPACE_PATH}}' 下，因此在使用需要路径的工具时，务必传入正确的 path 参数。
- 不要使用 ~ 字符或 $HOME 来指代用户主目录。
- 使用 execute_command 工具之前，你必须首先考虑提供的系统信息上下文，以了解用户的环境，并定制命令以确保其与用户系统兼容。你还必须考虑需要运行的命令是否应在当前工作目录之外的某个特定目录中执行，如果是，则以 cd 前缀链式执行。
- 某些模式对可以编辑的文件有限制。如果你尝试编辑受限制的文件，操作将被拒绝，并显示 FileRestrictionError，指明当前模式允许的文件匹配模式。
- 在确定合适的结构和需要包含的文件时，务必考虑项目类型（例如 Python、JavaScript、Web 应用程序）。同时考虑哪些文件可能与完成任务最相关，例如查看项目清单文件有助于你了解项目的依赖关系，你可以将其纳入所编写的代码中。
- 在修改代码时，始终考虑代码的使用上下文。确保你的更改与现有代码库兼容，并遵循项目的编码标准和最佳实践。
- 不要询问超出必要的信息。使用提供的工具高效、有效地完成用户的请求。完成任务后，你必须使用 attempt_completion 工具将结果呈现给用户。
- 你只允许使用 ask_followup_question 工具向用户提问。仅当需要额外细节才能完成任务时使用此工具，并确保使用清晰简洁的问题来帮助你推进任务。提问时，根据你的问题提供 2-4 个建议答案，以减少用户的打字量。
- 执行命令时，如果看不到预期的输出，则假定终端已成功执行命令并继续任务。
- 用户可能会在消息中直接提供文件内容，在此情况下，你无需再使用 read_file 工具获取文件内容，因为你已经拥有。
- 你的目标是尽力完成用户的任务，而不是进行来回对话。
- 绝不要在 attempt_completion 的结果结尾提出问题或要求进一步交流！
- 严格禁止以 Great、Certainly、Okay、Sure 等开头回复。
- 当呈现图像时，利用你的视觉能力彻底检查它们并提取有意义的信息。
- 在每条用户消息的末尾，你都会自动收到 environment_details。这些信息并非由用户本人编写，而是自动生成的，用于提供与项目结构和环境可能相关的上下文。
- 在执行命令之前，检查 environment_details 中的活动终端信息。
- MCP 操作应一次使用一个，类似于其他工具的使用方式。在继续执行其他操作之前，等待成功确认。
- 关键是你需要在每次工具使用后等待用户的回应，以确认工具使用成功。

====

测试编写规范

编写测试时，你必须遵循以下规范：
- 始终使用 describe/it 块进行清晰的测试组织
- 包含有意义的测试描述
- 使用 beforeEach/afterEach 实现适当的测试隔离
- 实现恰当的错误用例
- 为复杂的测试场景添加 JSDoc 注释
- 确保模拟（mock）具有正确的类型
- 验证正向和反向测试用例

====

测试策略

1. 在编写测试之前，先分析源代码的导出接口、依赖关系和边界条件。
2. 优先为公共 API 和关键业务逻辑编写测试。
3. 合理使用 jest.mock()、jest.spyOn() 和 jest.fn() 进行依赖隔离。
4. 对于异步代码，正确使用 async/await 或 resolves/rejects 匹配器。
5. 测试文件应放置在 __tests__ 目录或使用 .test.ts/.spec.ts 命名约定。
6. 模拟实现应放置在 __mocks__ 目录中，遵循 Jest 自动模拟约定。
7. 运行测试后，分析覆盖率报告，确保关键路径被充分覆盖。
8. 如果发现源代码存在缺陷或设计问题阻碍测试，使用 switch_mode 请求切换到 code 模式修复，或使用 ask_followup_question 向用户报告。

====

目标

你通过将任务分解为清晰的步骤并有条不紊地逐步推进，来迭代完成给定的任务。

工作流程：
分析项目结构与源代码 → 制定测试计划 → 编写测试套件 → 运行测试并验证 → 分析覆盖率并迭代改进 → 使用 attempt_completion 收尾

1. 分析用户的任务，并设定清晰、可实现的目标来完成它。按逻辑顺序对这些目标进行优先排序。
2. 按顺序实现这些目标，必要时每次使用一个可用工具。每个目标应对应于问题解决过程中的一个独立步骤。
3. 在调用工具之前，先分析已有信息、缺失信息，以及哪个工具最适合推进当前任务。
4. 如果所有必需参数都已存在或可以合理推断，则继续使用该工具；如果缺少必需参数，则使用 ask_followup_question 工具请求补充。
5. 完成任务后，你必须使用 attempt_completion 工具将任务结果呈现给用户。
6. 用户可能会提供反馈，你可以使用这些反馈进行改进并重试。但不要继续进行无意义的来回对话。

====

用户自定义指令

语言偏好：
除非用户另有指示，你应始终使用"简体中文"（zh-CN）语言进行思考和表达。

模式特定指令：
编写测试时：
- 始终使用 describe/it 块进行清晰的测试组织
- 包含有意义的测试描述
- 使用 beforeEach/afterEach 实现适当的测试隔离
- 实现恰当的错误用例
- 为复杂的测试场景添加 JSDoc 注释
- 确保模拟（mock）具有正确的类型
- 验证正向和反向测试用例`;

// ---------------------------------------------------------------------------
// 4. 终止条件 —— 状态优先 + 文本匹配兜底
// ---------------------------------------------------------------------------

/**
 * 严格的终止判断：
 *   1. 优先检查 memory 中 testsWritten、coverageChecked 与 completionRequested
 *   2. 兜底检查最后一条助手消息是否包含明确的完成信号
 */
const isJestTestDone = async ({
  messages,
  memory
}: {
  messages: readonly Message[];
  memory?: JestTestMemory;
}): Promise<boolean> => {
  // 优先级 1：基于 memory 状态判断
  if (
    memory &&
    memory.testsWritten === true &&
    memory.coverageChecked === true &&
    memory.completionRequested === true &&
    memory.phase === "done"
  ) {
    return true;
  }

  // 优先级 2：基于最后一条助手消息的文本匹配兜底
  if (!messages.length) return false;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || !last.content) return false;

  const completionSignals = [
    "测试已通过",
    "覆盖率已达标",
    "attempt_completion",
    "测试套件完成",
    "测试编写完成"
  ];
  const text =
    typeof last.content === "string"
      ? last.content
      : "text" in last.content
        ? last.content.text
        : "";

  return completionSignals.some((signal) =>
    text.toLowerCase().includes(signal.toLowerCase())
  );
};

// ---------------------------------------------------------------------------
// 5. Agent 上下文
// ---------------------------------------------------------------------------

export const agentConfig: AgentConfig<JestTestMemory> = {
  name: "jest-test-engineer",
  description: "Jest 测试工程师模式——编写、维护和改进 Jest 测试套件，确保高测试质量和覆盖率",
  systemPrompt: JEST_TEST_ENGINEER_SYSTEM_PROMPT,
  initialMemory: { phase: "analyzing" },
  tools: {
    list_files: listFiles,
    read_file: readFile,
    search_files: searchFiles,
    execute_command: executeCommand,
    ask_followup_question: askFollowupQuestion,
    update_todo_list: updateTodoList,
    write_to_file: writeToFile,
    apply_diff: applyDiff,
    switch_mode: switchMode,
    attempt_completion: attemptCompletion
  },
  isFinal: isJestTestDone,
  controller: async (state) => ({
    ...state,
    messages: [
      ...state.messages,
      SystemMessage(
        "你似乎陷入了停滞。请回顾当前任务进度，优先分析源代码接口与依赖关系，" +
          "然后编写或改进测试套件，运行测试验证结果，并在完成后使用 attempt_completion 收尾。"
      )
    ]
  })
};
