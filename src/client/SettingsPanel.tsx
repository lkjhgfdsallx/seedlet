import { useState } from "react";
import WorkspaceConfig from "./WorkspaceConfig";
import ModelConfig from "./ModelConfig";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"workspace" | "model">("workspace");

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div className="settings-overlay" onClick={onClose} />
      
      {/* 侧边栏面板 */}
      <div className="settings-panel">
        <div className="settings-header">
          <h2>⚙️ 设置</h2>
          <button className="settings-close" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        {/* 标签页切换 */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === "workspace" ? "active" : ""}`}
            onClick={() => setActiveTab("workspace")}
          >
            📁 工作区
          </button>
          <button
            className={`settings-tab ${activeTab === "model" ? "active" : ""}`}
            onClick={() => setActiveTab("model")}
          >
            🤖 模型
          </button>
        </div>

        {/* 内容区域 */}
        <div className="settings-content">
          {activeTab === "workspace" && (
            <div className="settings-section">
              <h3 className="settings-section-title">工作区配置</h3>
              <p className="settings-section-desc">
                配置 Agent 的工作目录，所有文件操作都将在此目录下进行。
              </p>
              <WorkspaceConfig />
            </div>
          )}
          
          {activeTab === "model" && (
            <div className="settings-section">
              <h3 className="settings-section-title">模型配置</h3>
              <p className="settings-section-desc">
                配置 AI 模型的 API 地址、密钥和模型 ID。
              </p>
              <ModelConfig />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
