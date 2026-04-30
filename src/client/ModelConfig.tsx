import { useState, useEffect } from "react";

export interface ModelConfigData {
  url: string;
  apiKey: string;
  modelId: string;
}

interface Props {
  onConfigChange?: (config: ModelConfigData) => void;
}

const DEFAULT_CONFIG: ModelConfigData = {
  url: "http://localhost:11434/api/chat",
  apiKey: "",
  modelId: "qwen3.5:9b"
};

export default function ModelConfig({ onConfigChange }: Props) {
  const [config, setConfig] = useState<ModelConfigData>(DEFAULT_CONFIG);
  const [editing, setEditing] = useState(false);
  const [tempConfig, setTempConfig] = useState<ModelConfigData>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/model-config")
      .then((res) => res.json())
      .then((data: ModelConfigData & { explicitlySet?: boolean }) => {
        setConfig(data);
        setTempConfig(data);
        // 如果用户没有显式配置模型，显示提醒
        if (!data.explicitlySet) {
          setShowWarning(true);
        }
      })
      .catch(() => {
        // 使用默认配置
        setConfig(DEFAULT_CONFIG);
        setTempConfig(DEFAULT_CONFIG);
        setShowWarning(true);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/model-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tempConfig)
      });
      if (res.ok) {
        const data: ModelConfigData = await res.json();
        setConfig(data);
        setEditing(false);
        setShowWarning(false);
        setDismissed(false);
        onConfigChange?.(data);
      }
    } catch {
      // 忽略保存失败
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTempConfig(config);
    setEditing(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleUseDefault = async () => {
    setTempConfig(DEFAULT_CONFIG);
    setSaving(true);
    try {
      const res = await fetch("/api/model-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...DEFAULT_CONFIG, skipWarning: true })
      });
      if (res.ok) {
        const data: ModelConfigData = await res.json();
        setConfig(data);
        setTempConfig(data);
        setEditing(false);
        setShowWarning(false);
        setDismissed(true);
        onConfigChange?.(data);
      }
    } catch {
      // 忽略保存失败
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="model-config">
      {/* 未配置模型时的提醒横幅 */}
      {showWarning && !dismissed && (
        <div className="model-warning">
          <span className="model-warning-icon">⚙️</span>
          <span className="model-warning-text">
            尚未配置模型，当前使用默认配置：
            <code>{config.modelId}</code>
          </span>
          <button
            className="model-warning-btn model-warning-btn-primary"
            onClick={() => setEditing(true)}
          >
            去配置
          </button>
          <button
            className="model-warning-btn model-warning-btn-secondary"
            onClick={handleUseDefault}
            disabled={saving}
          >
            使用默认配置
          </button>
          <button
            className="model-warning-btn model-warning-btn-dismiss"
            onClick={handleDismiss}
          >
            ✕
          </button>
        </div>
      )}

      {/* 模型配置显示/编辑区域 */}
      <div className="model-display">
        <span className="model-label">🤖</span>
        {editing ? (
          <div className="model-edit">
            <div className="model-edit-row">
              <label className="model-edit-label">API 地址:</label>
              <input
                type="text"
                className="model-input"
                value={tempConfig.url}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, url: e.target.value })
                }
                placeholder="例如: http://localhost:11434/api/chat"
                disabled={saving}
              />
            </div>
            <div className="model-edit-row">
              <label className="model-edit-label">API Key:</label>
              <input
                type="password"
                className="model-input"
                value={tempConfig.apiKey}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, apiKey: e.target.value })
                }
                placeholder="留空表示不需要 API Key"
                disabled={saving}
              />
            </div>
            <div className="model-edit-row">
              <label className="model-edit-label">模型 ID:</label>
              <input
                type="text"
                className="model-input"
                value={tempConfig.modelId}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, modelId: e.target.value })
                }
                placeholder="例如: qwen3.5, deepseek-v4"
                disabled={saving}
              />
            </div>
            <div className="model-edit-actions">
              <button
                className="model-btn model-btn-save"
                onClick={handleSave}
                disabled={saving || !tempConfig.url.trim() || !tempConfig.modelId.trim()}
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                className="model-btn model-btn-cancel"
                onClick={handleCancel}
                disabled={saving}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="model-info">
            <span className="model-summary" title={`${config.url} - ${config.modelId}`}>
              {config.modelId}
              {config.apiKey && <span className="model-key-indicator"> 🔑</span>}
            </span>
            <button
              className="model-btn model-btn-edit"
              onClick={() => setEditing(true)}
              title="修改模型配置"
            >
              ⚙️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
