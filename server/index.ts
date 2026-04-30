import { resolve } from "node:path";
import { loadAgents } from "./agentLoader";
import type { AgentConfig } from "../src/agentConfig";
import {
  type AgentContext,
  type AgentState,
  type ChatMemory,
  type Message,
  ChatModel,
  SystemMessage,
  UserMessage,
  ToolRegistry,
  loopAgent
} from "../src";

const PORT = parseInt(process.env.PORT || "3001");

/** 工作区路径配置：默认为当前项目所在文件夹 */
const DEFAULT_WORKSPACE = resolve(import.meta.dir, "..");
let workspacePath: string = process.env.WORKSPACE_PATH || DEFAULT_WORKSPACE;
let workspaceExplicitlySet: boolean = !!process.env.WORKSPACE_PATH;

/** 模型配置：默认使用 Ollama 本地模型 */
interface ModelConfig {
  url: string;
  apiKey: string;
  modelId: string;
}

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  url: "http://localhost:11434/api/chat",
  apiKey: "",
  modelId: "qwen3.5:9b"
};

let modelConfig: ModelConfig = { ...DEFAULT_MODEL_CONFIG };
let modelConfigExplicitlySet: boolean = false;

let agents: AgentConfig[] = [];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

/** 将结构化内容转换为字符串 */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "text" in (content as Record<string, unknown>)) {
    return (content as Record<string, unknown>).text as string;
  }
  if (content) return JSON.stringify(content);
  return "";
}

/** 将系统提示词中的 {{WORKSPACE_PATH}} 占位符替换为实际工作区路径 */
function resolveWorkspacePrompt(systemPrompt: string): string {
  return systemPrompt.replace(/\{\{WORKSPACE_PATH\}\}/g, workspacePath);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS 预检
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 获取已加载的 Agent 列表
    if (url.pathname === "/api/agents" && req.method === "GET") {
      return new Response(
        JSON.stringify(
          agents.map((a) => ({ name: a.name, description: a.description }))
        ),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // 获取工作区路径配置
    if (url.pathname === "/api/workspace" && req.method === "GET") {
      return new Response(
        JSON.stringify({
          workspacePath,
          explicitlySet: workspaceExplicitlySet,
          defaultPath: DEFAULT_WORKSPACE
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // 设置工作区路径配置
    if (url.pathname === "/api/workspace" && req.method === "PUT") {
      try {
        const body = await req.json();
        const { path: newPath, skipWarning } = body;
        if (typeof newPath !== "string" || !newPath.trim()) {
          return new Response(
            JSON.stringify({ error: "工作区路径不能为空" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }
        workspacePath = resolve(newPath.trim());
        workspaceExplicitlySet = !skipWarning;
        console.log(`📁 工作区路径已更新为: ${workspacePath} (显式设置: ${workspaceExplicitlySet})`);
        return new Response(
          JSON.stringify({
            workspacePath,
            explicitlySet: workspaceExplicitlySet,
            defaultPath: DEFAULT_WORKSPACE
          }),
          { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "无效的请求体" }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // 获取模型配置
    if (url.pathname === "/api/model-config" && req.method === "GET") {
      return new Response(
        JSON.stringify({
          ...modelConfig,
          explicitlySet: modelConfigExplicitlySet
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // 设置模型配置
    if (url.pathname === "/api/model-config" && req.method === "PUT") {
      try {
        const body = await req.json();
        const { url: newUrl, apiKey, modelId, skipWarning } = body;
        if (typeof newUrl !== "string" || !newUrl.trim()) {
          return new Response(
            JSON.stringify({ error: "API 地址不能为空" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }
        if (typeof modelId !== "string" || !modelId.trim()) {
          return new Response(
            JSON.stringify({ error: "模型 ID 不能为空" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }
        modelConfig = {
          url: newUrl.trim(),
          apiKey: typeof apiKey === "string" ? apiKey.trim() : "",
          modelId: modelId.trim()
        };
        modelConfigExplicitlySet = !skipWarning;
        console.log(`🤖 模型配置已更新: ${modelConfig.modelId} @ ${modelConfig.url} (显式设置: ${modelConfigExplicitlySet})`);
        return new Response(
          JSON.stringify({
            ...modelConfig,
            explicitlySet: modelConfigExplicitlySet
          }),
          { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "无效的请求体" }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // 聊天接口：发送消息并运行 Agent Loop
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body = await req.json();
        const { agentName, messages: clientMessages, memory: initialMemory } = body;

        const config = agents.find((a) => a.name === agentName);
        if (!config) {
          return new Response(
            JSON.stringify({ error: `Agent "${agentName}" 未找到` }),
            {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS_HEADERS }
            }
          );
        }

        // 调试信息收集
        const debugInfo: {
          steps: Array<{
            step: number;
            messageCount: number;
            lastMessageRole?: string;
            lastMessagePreview?: string;
            lastMessageToolCalls?: number;
            halted?: string;
            error?: string;
          }>;
          modelConfig: ModelConfig;
          agentConfig: { name: string; toolCount: number; availableTools: string[] };
          finalState: { halted?: string; messageCount: number };
          initialMessages: Array<{ role: string; contentPreview: string }>;
        } = {
          steps: [],
          modelConfig: { ...modelConfig },
          agentConfig: {
            name: config.name,
            toolCount: Object.keys(config.tools || {}).length,
            availableTools: Object.keys(config.tools || {})
          },
          finalState: { messageCount: 0 },
          initialMessages: []
        };

        // 构建 Agent 上下文
        const ctx: AgentContext<ChatMemory> = {
          name: config.name,
          registry: new ToolRegistry(config.tools),
          isFinal: config.isFinal,
          controller: config.controller
          // 注意：不提供 getUserInput，让 agent 在需要用户输入时自然结束
        };

        // 解析客户端消息
        const parsedMessages: Message[] = clientMessages.map(
          (m: { role: string; content: string }) =>
            m.role === "user" ? UserMessage(m.content) : UserMessage(m.content)
        );

        // 使用前端配置的模型
        const chatModelOptions = {
          url: modelConfig.url,
          name: modelConfig.modelId,
          key: modelConfig.apiKey || undefined,
          stringifyContent: true
        };

        // 构建初始状态（替换系统提示词中的工作区路径占位符）
        const resolvedPrompt = resolveWorkspacePrompt(config.systemPrompt);
        const state: AgentState<ChatMemory> = {
          model: new ChatModel(chatModelOptions),
          messages: [SystemMessage(resolvedPrompt), ...parsedMessages],
          memory: initialMemory || config.initialMemory || {}
        };

        // 记录初始消息
        debugInfo.initialMessages = state.messages.map(m => ({
          role: m.role,
          contentPreview: contentToText(m.content).slice(0, 100)
        }));

        console.log(`\n🤖 运行 Agent: ${config.name} (模型: ${modelConfig.modelId})`);
        console.log(`📋 初始消息数: ${state.messages.length}`);
        console.log(`🔧 可用工具: [${Object.keys(config.tools || {}).join(', ')}]`);
        console.log(`📝 用户消息: ${parsedMessages.map(m => contentToText(m.content).slice(0, 50)).join(' | ')}`);

        // yesModel 也使用前端配置的模型
        const yesModelOptions = {
          url: modelConfig.url,
          name: modelConfig.modelId,
          key: modelConfig.apiKey || undefined,
          stringifyContent: true
        };

        let stepCount = 0;
        const result = await loopAgent(ctx, state, {
          maxSteps: 20,
          delay: 0,
          yesModel: new ChatModel(yesModelOptions),
          onStateChange: (currentState) => {
            stepCount++;
            const last = currentState.messages[currentState.messages.length - 1];
            const preview = last?.content
              ? contentToText(last.content).slice(0, 100)
              : "";
            
            // 统计工具调用
            const toolCalls = last?.role === 'assistant' && 'tool_calls' in last
              ? (last.tool_calls?.length || 0)
              : 0;
            
            debugInfo.steps.push({
              step: stepCount,
              messageCount: currentState.messages.length,
              lastMessageRole: last?.role,
              lastMessagePreview: preview,
              lastMessageToolCalls: toolCalls,
              halted: currentState.halted?.kind
            });

            console.log(
              `  步骤 ${stepCount}: ${currentState.messages.length} 条消息, ` +
              `最后消息: ${last?.role || "无"}` +
              (toolCalls > 0 ? ` (${toolCalls} 个工具调用)` : '') + ', ' +
              `停止状态: ${currentState.halted?.kind || "运行中"}`
            );
            if (preview) {
              console.log(`    内容预览: ${preview}${preview.length >= 100 ? '...' : ''}`);
            }
          }
        });

        debugInfo.finalState = {
          halted: result.halted?.kind,
          messageCount: result.messages.length
        };

        console.log(`✅ Agent ${config.name} 完成，共 ${result.messages.length} 条消息`);
        console.log(`🛑 最终状态: ${result.halted?.kind || "未知"}\n`);

        const messages = result.messages.map((m) => ({
          role: m.role,
          content: contentToText(m.content)
        }));

        return new Response(
          JSON.stringify({
            messages,
            debug: debugInfo,
            success: result.halted?.kind === "done"
          }),
          {
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          }
        );
      } catch (err) {
        console.error("❌ Chat error:", err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        return new Response(
          JSON.stringify({
            error: String(err),
            errorStack,
            errorType: err instanceof Error ? err.constructor.name : typeof err
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          }
        );
      }
    }

    // 健康检查
    if (url.pathname === "/api/health") {
      return new Response(
        JSON.stringify({ status: "ok", agentCount: agents.length }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }
});

// 启动时加载所有 Agent
loadAgents().then((loaded) => {
  agents = loaded;
  console.log(`\n✅ 共加载 ${agents.length} 个 Agent: ${agents.map((a) => a.name).join(", ")}`);
  console.log(`📁 工作区路径: ${workspacePath} ${workspaceExplicitlySet ? "(用户配置)" : "(默认：项目所在文件夹，建议在前端配置)"}`);
  console.log(` API 服务运行在: http://localhost:${server.port}\n`);
});
