import { useState, useEffect, useCallback } from "react";
import ChatView from "./ChatView";
import ModeSelector from "./ModeSelector";
import SettingsPanel from "./SettingsPanel";

interface AgentInfo {
  name: string;
  description: string;
}

interface ChatMessage {
  role: string;
  content: string;
}

export default function App() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data: AgentInfo[]) => {
        setAgents(data);
        if (data.length > 0) {
          setSelectedAgent((prev) => prev || data[0]!.name);
        }
      })
      .catch((err: Error) => setError("无法连接到服务器: " + err.message));
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedAgent) return;

      const userMsg: ChatMessage = { role: "user", content };
      const allMessages = [...messages, userMsg];
      setMessages(allMessages);
      setIsLoading(true);
      setError("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: selectedAgent,
            messages: allMessages
          })
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error || "请求失败");
        }

        const data = (await res.json()) as { messages: ChatMessage[] };
        setMessages(data.messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAgent, messages]
  );

  const handleClear = () => {
    setMessages([]);
    setError("");
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 seedlet</h1>
        <div className="header-controls">
          <ModeSelector
            agents={agents}
            selected={selectedAgent}
            onSelect={setSelectedAgent}
          />
          <button
            className="btn-clear"
            onClick={handleClear}
            disabled={isLoading}
          >
            清空对话
          </button>
          <button
            className="btn-settings"
            onClick={() => setIsSettingsOpen(true)}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </header>
      {error && <div className="app-error">{error}</div>}
      <main className="app-main">
        <ChatView
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          disabled={!selectedAgent}
        />
      </main>
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
