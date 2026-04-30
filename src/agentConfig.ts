import type { AgentContext, AgentState } from "./workflow";
import type { ChatMemory, Tools } from "./tool";

/**
 * Agent 配置接口，由 agent/ 目录下的每个 agent 文件导出。
 * 服务端通过自动发现机制加载所有 agent 配置。
 */
export interface AgentConfig<Memory extends ChatMemory = ChatMemory> {
  /** Agent 的唯一标识名称 */
  name: string;
  /** Agent 的简短描述 */
  description: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 初始内存状态 */
  initialMemory?: Memory;
  /** 工具定义映射 */
  tools: Tools<Memory>;
  /** 终止条件判断函数 */
  isFinal: AgentContext<Memory>["isFinal"];
  /** 代理卡住时的纠偏回调 */
  controller?: AgentContext<Memory>["controller"];
}
