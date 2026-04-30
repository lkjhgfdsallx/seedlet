import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentConfig } from "../src/agentConfig";

const AGENT_DIR = join(import.meta.dir, "..", "agent");

/**
 * 自动扫描 agent/ 目录，加载所有导出了 `agentConfig` 的 TypeScript 文件。
 */
export async function loadAgents(): Promise<AgentConfig[]> {
  const entries = await readdir(AGENT_DIR, { withFileTypes: true });
  const agents: AgentConfig[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;

    const modulePath = join(AGENT_DIR, entry.name);
    try {
      const mod = await import(modulePath);
      if (mod.agentConfig) {
        agents.push(mod.agentConfig);
        console.log(`  ✓ 已加载 Agent: ${mod.agentConfig.name} (来自 ${entry.name})`);
      }
    } catch (err) {
      console.error(`  ✗ 加载 Agent 失败 (${entry.name}):`, err);
    }
  }

  return agents;
}
