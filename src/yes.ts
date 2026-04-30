import { type Content, textIncludes } from "./content";
import { type Message, SystemMessage, UserMessage } from "./message";
import type { Model } from "./model";

export const lastMessageIncludes =
  (text: string, options?: { caseInsensitive?: boolean }) =>
  async ({ messages }: { messages: readonly Message[] }) => {
    if (!messages?.length) return false;
    const last = messages[messages.length - 1];
    if (!last?.content) return false;
    return textIncludes(last.content, text, options);
  };

const UserInputGuidelines = `以下消息是否明确要求用户做出决策、确认或提供额外指示？

如果满足以下情况，请回复"yes"：
- 消息提出一个以问号"?"结尾的问题，并期待用户的真实回答。
- 消息提出要执行某项操作（"我应该..."、"您希望我..."、"我可以..."）并等待用户的决定。
- 消息提出多个选项并要求用户选择或确认。

如果满足以下情况，请回复"no"：
- 消息仅报告已完成的操作、状态或结果，未提出任何问题。
- 消息提供摘要、结果或信息，但不建议未来行动或请求指导。

重要提示：  
如果消息听起来像是提议或建议，假设它需要输入并回复"yes"。  
如果消息仅描述过去或当前状态而未提出任何问题，请回复"no"。

请始终准确回复"yes"或"no"，无需解释。`;

const WantsToExitGuidelines = `以下消息是否明确表示想要结束对话？当助手的最后一条消息请求退出或以其他方式结束对话时，请回复"yes"且仅回复"yes"。 

在所有其他情况下，请回复"no"且仅回复"no"。`;

/**
 * answerIsYes 向较小的模型询问简单的"是/否"任务。
 */
export const answerIsYes =
  (guidelines: string, model: Model) =>
  async (content: string | Content | null) => {
    if (!content) throw new Error("no content");
    const { messages } = await model.complete([
      SystemMessage(guidelines),
      UserMessage(content)
    ]);
    // console.log("answerIsYes", { messages });
    return lastMessageIncludes("yes", { caseInsensitive: true })({
      messages
    });
  };

export const requestsUserInput = (model: Model) =>
  answerIsYes(UserInputGuidelines, model);
export const wantsToExit = (model: Model) =>
  answerIsYes(WantsToExitGuidelines, model);
