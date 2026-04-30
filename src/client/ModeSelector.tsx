interface AgentInfo {
  name: string;
  description: string;
}

interface Props {
  agents: AgentInfo[];
  selected: string;
  onSelect: (name: string) => void;
}

export default function ModeSelector({ agents, selected, onSelect }: Props) {
  if (agents.length === 0) {
    return <span className="mode-loading">加载 Agent 列表中...</span>;
  }

  return (
    <div className="mode-selector">
      <label htmlFor="mode-select">模式:</label>
      <select
        id="mode-select"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
      >
        {agents.map((a) => (
          <option key={a.name} value={a.name}>
            {a.name} - {a.description}
          </option>
        ))}
      </select>
    </div>
  );
}
