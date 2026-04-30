# Seedlet

<div align="center">
  
  **轻量级、纯函数式的 LLM 代理框架**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/version-0.1.3-blue.svg)](package.json)
  [![Bun](https://img.shields.io/badge/Bun-%3E%3D1.2.0-black.svg)](https://bun.sh)
</div>

## 📖 简介

Seedlet 是一个轻量级、纯函数式的 LLM 代理框架，配备 React 前端界面。它提供了一套完整的工具来构建、管理和运行 AI 代理，支持多种 LLM 模型（ChatGPT、Ollama、LM Studio）。

### ✨ 核心特性

- 🎯 **纯函数式设计** - 不可变状态管理，易于测试和调试
- 🔧 **工具系统** - 灵活的工具注册和调用机制
- 🔄 **工作流引擎** - 支持单步执行、循环和序列化工作流
- 🌐 **多模型支持** - 兼容 ChatGPT、Ollama、LM Studio
- 🎨 **React 前端** - 直观的用户界面
- 📡 **MCP 协议** - 支持 Model Context Protocol
- 🔌 **可扩展** - 易于添加自定义代理和工具
- 📝 **TypeScript** - 完整的类型支持

## 🚀 快速开始

### 前置要求

- [Bun](https://bun.sh) >= 1.2.0
- TypeScript >= 5.0

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd seedlet

# 安装依赖
bun install
```

### 开发模式

```bash
# 启动开发服务器（同时启动前端和后端）
bun run dev
```

开发服务器将在以下端口启动：
- 🌐 前端页面: http://localhost:3000
- 🔌 API 服务: http://localhost:3001

### 构建

```bash
# 构建项目
bun run build

# 代码检查
bun run lint

# 格式化代码
bun run format

# 生成文档
bun run docs
```

## 📚 核心概念

### 1. 模型 (Model)

Seedlet 支持多种 LLM 模型：

```typescript
import { chatgpt, ollama, lms } from 'seedlet';

// ChatGPT
const gptModel = chatgpt('gpt-4');

// Ollama 本地模型
const ollamaModel = ollama('llama2');

// LM Studio
const lmsModel = lms('local-model');
```

### 2. 工具 (Tools)

定义和注册工具供代理使用：

```typescript
import { tool, ToolRegistry } from 'seedlet';

const myTool = tool({
  name: 'calculator',
  description: '执行数学计算',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string' }
    }
  },
  handler: async ({ expression }) => {
    return eval(expression);
  }
});

const registry = new ToolRegistry();
registry.register(myTool);
```

### 3. 工作流 (Workflow)

使用纯函数式的工作流引擎：

```typescript
import { stepAgent, loopAgent, Sequence } from 'seedlet';

// 单步执行
const state = await stepAgent(initialState, context);

// 循环执行直到完成
const finalState = await loopAgent(initialState, context);

// 序列化工作流
const workflow = new Sequence([
  { name: 'step1', fn: step1Handler },
  { name: 'step2', fn: step2Handler }
]);
```

### 4. 消息 (Messages)

处理不同类型的消息：

```typescript
import { UserMessage, AssistantMessage, SystemMessage } from 'seedlet';

const messages = [
  new SystemMessage('你是一个有帮助的助手'),
  new UserMessage('你好！'),
  new AssistantMessage('你好！有什么我可以帮助你的吗？')
];
```

### 5. 内容类型 (Content)

支持多种内容格式：

```typescript
import { text, toContent, isTextContent } from 'seedlet';

// 文本内容
const textContent = text('Hello, world!');

// 图片内容
const imageContent = {
  type: 'image',
  source: { url: 'https://example.com/image.png' }
};

// JSON 内容
const jsonContent = {
  type: 'json',
  data: { key: 'value' }
};
```

## 🏗️ 项目结构

```
seedlet/
├── src/                    # 核心库代码
│   ├── content.ts         # 内容处理
│   ├── json.ts            # JSON 序列化
│   ├── mcpClient.ts       # MCP 客户端
│   ├── mcpServer.ts       # MCP 服务器
│   ├── message.ts         # 消息处理
│   ├── model.ts           # 模型配置
│   ├── schema.ts          # JSON Schema
│   ├── tool.ts            # 工具系统
│   ├── workflow.ts        # 工作流引擎
│   ├── yes.ts             # 用户输入检测
│   └── client/            # React 前端
│       ├── App.tsx
│       ├── ChatView.tsx
│       ├── ModelConfig.tsx
│       ├── ModeSelector.tsx
│       ├── SettingsPanel.tsx
│       └── WorkspaceConfig.tsx
├── server/                # API 服务器
│   ├── index.ts
│   └── agentLoader.ts
├── agent/                 # 代理实现
│   ├── architectAgent.ts
│   ├── codeAgent.ts
│   ├── jestTestEngineerAgent.ts
│   └── echo.ts
├── dev.ts                 # 开发服务器启动脚本
└── package.json
```

## 🔧 配置

### 环境变量

创建 `.env` 文件配置环境变量：

```env
# Ollama 服务地址
OLLAMA_HOST=http://localhost:11434

# API 端口
PORT=3001
```

## 📦 API 参考

### 导出模块

- **content** - 内容处理工具
- **json** - JSON 序列化
- **mcpClient** - MCP 客户端
- **mcpServer** - MCP 服务器
- **message** - 消息类型和处理
- **model** - 模型配置
- **schema** - JSON Schema 支持
- **tool** - 工具注册和管理
- **workflow** - 代理工作流
- **yes** - 用户输入检测

详细 API 文档请运行 `bun run docs` 生成。

## 🤝 开发

### 代码规范

项目使用 [Biome](https://biomejs.dev/) 进行代码检查和格式化：

```bash
# 检查代码
bun run check

# 自动格式化
bun run format

# 完整检查（包括类型检查）
bun run lint
```

### 测试

```bash
# 运行测试
bun test
```

### 发布

```bash
# 发布前会自动运行 lint、build 和 test
bun publish
```

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE.copying)。

Copyright (c) 2025 Henri Binsztok

## 🙏 致谢

感谢所有为 Seedlet 做出贡献的开发者！

---

<div align="center">
  Made with ❤️ by the Seedlet Team
</div>
