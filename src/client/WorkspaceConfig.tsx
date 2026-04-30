import { useState, useEffect } from "react";

interface WorkspaceInfo {
  workspacePath: string;
  explicitlySet: boolean;
  defaultPath: string;
}

interface Props {
  onWorkspaceChange?: (path: string) => void;
}

export default function WorkspaceConfig({ onWorkspaceChange }: Props) {
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [inputPath, setInputPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/workspace")
      .then((res) => res.json())
      .then((data: WorkspaceInfo) => {
        setWorkspaceInfo(data);
        setInputPath(data.workspacePath);
        // 如果用户没有显式配置工作区，显示提醒
        if (!data.explicitlySet) {
          setShowWarning(true);
        }
      })
      .catch(() => {
        // 忽略加载失败
      });
  }, []);

  const handleSave = async (skipWarning = false) => {
    if (!inputPath.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: inputPath.trim(), skipWarning })
      });
      if (res.ok) {
        const data: WorkspaceInfo = await res.json();
        setWorkspaceInfo(data);
        setEditing(false);
        setShowWarning(!data.explicitlySet);
        setDismissed(false);
        onWorkspaceChange?.(data.workspacePath);
      }
    } catch {
      // 忽略保存失败
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleUseDefault = async () => {
    if (!workspaceInfo) return;
    setInputPath(workspaceInfo.defaultPath);
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: workspaceInfo.defaultPath, skipWarning: true })
      });
      if (res.ok) {
        const data: WorkspaceInfo = await res.json();
        setWorkspaceInfo(data);
        setEditing(false);
        setShowWarning(false);
        setDismissed(true);
        onWorkspaceChange?.(data.workspacePath);
      }
    } catch {
      // 忽略保存失败
    } finally {
      setSaving(false);
    }
  };

  if (!workspaceInfo) return null;

  return (
    <div className="workspace-config">
      {/* 未配置工作区时的提醒横幅 */}
      {showWarning && !dismissed && (
        <div className="workspace-warning">
          <span className="workspace-warning-icon">⚠️</span>
          <span className="workspace-warning-text">
            尚未配置工作区路径，当前使用项目默认路径：
            <code>{workspaceInfo.workspacePath}</code>
          </span>
          <button
            className="workspace-warning-btn workspace-warning-btn-primary"
            onClick={() => setEditing(true)}
          >
            去配置
          </button>
          <button
            className="workspace-warning-btn workspace-warning-btn-secondary"
            onClick={handleUseDefault}
            disabled={saving}
          >
            使用默认路径
          </button>
          <button
            className="workspace-warning-btn workspace-warning-btn-dismiss"
            onClick={handleDismiss}
          >
            ✕
          </button>
        </div>
      )}

      {/* 工作区路径显示/编辑区域 */}
      <div className="workspace-display">
        <span className="workspace-label">📁</span>
        {editing ? (
          <div className="workspace-edit">
            <input
              type="text"
              className="workspace-input"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              placeholder="输入工作区绝对路径..."
              disabled={saving}
            />
            <button
              className="workspace-btn workspace-btn-save"
              onClick={() => handleSave(false)}
              disabled={saving || !inputPath.trim()}
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              className="workspace-btn workspace-btn-cancel"
              onClick={() => {
                setEditing(false);
                setInputPath(workspaceInfo.workspacePath);
              }}
              disabled={saving}
            >
              取消
            </button>
          </div>
        ) : (
          <div className="workspace-info">
            <span className="workspace-path" title={workspaceInfo.workspacePath}>
              {workspaceInfo.workspacePath}
            </span>
            {workspaceInfo.explicitlySet && (
              <span className="workspace-badge">已配置</span>
            )}
            <button
              className="workspace-btn workspace-btn-edit"
              onClick={() => setEditing(true)}
              title="修改工作区路径"
            >
              ⚙️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
