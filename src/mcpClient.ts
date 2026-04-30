import type {
  ChatMemory,
  RegisteredTool,
  Tool,
  ToolCallResponse
} from "./tool";

/**
 * MCPClient 是连接到指定 MCP 服务器的客户端。
 */
export class MCPClient {
  private _cache: Promise<Tool[]> | null = null;
  private _timestamp = 0;
  private readonly _duration = 5 * 60 * 1000; // 5分钟

  constructor(public baseURL: string) {}

  private async _fetchTools(): Promise<Tool[]> {
    const res = await fetch(`${this.baseURL}/v1/tools`);
    if (!res.ok) throw new Error(`Failed to list tools: ${res.status}`);
    return res.json() as Promise<Tool[]>;
  }

  /**
   * listTools 返回 MCP 服务器的工具列表。
   * 默认情况下，结果会被缓存 5 分钟。
   */
  async listTools(): Promise<Tool[]> {
    const now = Date.now();

    if (!this._cache || now - this._timestamp > this._duration) {
      this._timestamp = now;
      this._cache = this._fetchTools();
    }

    return this._cache;
  }

  tool = async (name: string) => {
    const all = await this.listTools();
    return all.find((tool) => tool.function.name === name);
  };

  // @todo 检查响应类型是否匹配
  async callTool(
    name: string,
    input: unknown,
    memory: Record<string, unknown> = {}
  ): Promise<ToolCallResponse<ChatMemory, unknown>> {
    const res = await fetch(`${this.baseURL}/v1/tool-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, input, memory })
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        `Tool call failed: ${res.status} - ${err?.error || "Unknown error"}`
      );
    }
    return res.json() as Promise<ToolCallResponse<ChatMemory, unknown>>;
  }

  /**
   * registeredTool 创建一个外部注册的工具，可以
   * 添加到工作流中。
   */
  registeredTool = async <In, Out, Memory extends ChatMemory>(
    name: string
  ): Promise<RegisteredTool<In, Out, Memory>> => {
    const tool = await this.tool(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    // @todo memory 在 MCP 中未使用
    const handler = (args: In, _memory: Memory) =>
      this.callTool(name, args, {} as Memory);
    return {
      type: "external",
      tool,
      handler
    } as RegisteredTool<In, Out, Memory>;
  };
}
