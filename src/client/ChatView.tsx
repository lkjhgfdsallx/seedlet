import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: string;
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  system: "系统",
  user: "用户",
  assistant: "助手",
  tool: "工具",
  function: "函数"
};

export default function ChatView({
  messages,
  onSend,
  isLoading,
  disabled
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="chat-empty">
            {disabled
              ? "请选择一个 Agent 模式开始对话"
              : "输入你的第一条消息开始对话"}
          </div>
        )}
        {messages
          .filter((m) => m.role !== "system")
          .map((msg, i) => (
            <div key={i} className={`chat-message chat-message-${msg.role}`}>
              <div className="chat-role">
                {ROLE_LABELS[msg.role] || msg.role}
              </div>
              <div className="chat-content">
                <pre>{msg.content}</pre>
              </div>
            </div>
          ))}
        {isLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-role">助手</div>
            <div className="chat-content">
              <span className="chat-loading-dots">思考中</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            disabled ? "请先选择模式" : isLoading ? "等待回复..." : "输入消息..."
          }
          disabled={disabled || isLoading}
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !input.trim()}
        >
          发送
        </button>
      </form>
    </div>
  );
}
