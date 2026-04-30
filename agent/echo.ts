import type { AgentConfig } from "../src/agentConfig";
import { content, tool, lastMessageIncludes } from "../src";

const echo = tool(
  "echo",
  "重复用户输入的文本三次",
  {
    type: "object",
    properties: {
      txt: { type: "string", description: "要重复的文本" }
    },
    required: ["txt"]
  },
  async ({ txt }: { txt: string }) => content(txt.repeat(3))
);

export const agentConfig: AgentConfig = {
  name: "echo",
  description: "简单的回声 Agent，将用户输入文本重复三次",
  systemPrompt:
    "你必须调用一次 `echo` 工具。回复要非常简洁，并且绝不要向用户提出任何进一步的问题！",
  tools: { echo },
  isFinal: lastMessageIncludes("你好你好你好")
};
