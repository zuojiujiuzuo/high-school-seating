import {
  ChevronDown,
  Cloud,
  FlipHorizontal2,
  Palette,
  PawPrint,
  Redo2,
  Settings2,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import type { AppTheme } from "../types";

interface TopBarProps {
  currentClass: string;
  currentVersion: string;
  classes: string[];
  versions: string[];
  savedAt: string;
  saveStatus: "saved" | "saving" | "error";
  legalAcknowledged: boolean;
  theme: AppTheme;
  canUndo: boolean;
  canRedo: boolean;
  printMode: boolean;
  onClassChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePrint: () => void;
  onOpenSettings: () => void;
  onOpenLegal: () => void;
  onThemeChange: (theme: AppTheme) => void;
}

export function TopBar({
  currentClass,
  currentVersion,
  classes,
  versions,
  savedAt,
  saveStatus,
  legalAcknowledged,
  theme,
  canUndo,
  canRedo,
  printMode,
  onClassChange,
  onVersionChange,
  onUndo,
  onRedo,
  onTogglePrint,
  onOpenSettings,
  onOpenLegal,
  onThemeChange,
}: TopBarProps) {
  const saveLabel = {
    saved: "本地已保存",
    saving: "正在保存",
    error: "保存失败",
  }[saveStatus];

  const nativeSelectStyle = {
    appearance: "none",
    border: 0,
    padding: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontWeight: "inherit",
    cursor: "pointer",
  } as const;

  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="班阵">
        <span className="brand-mark">班阵</span>
        <span className="brand-version">DESK 01</span>
      </div>

      <label className="select-like class-picker">
        <span>
          <small>当前班级</small>
          <select
            aria-label="当前班级"
            value={currentClass}
            onChange={(event) => onClassChange(event.target.value)}
            style={nativeSelectStyle}
          >
            {classes.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </label>

      <label className="select-like plan-picker">
        <span>
          <small>座位版本</small>
          <select
            aria-label="座位版本"
            value={currentVersion}
            onChange={(event) => onVersionChange(event.target.value)}
            style={nativeSelectStyle}
          >
            {versions.map((version) => <option key={version} value={version}>{version}</option>)}
          </select>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </label>

      <div className="topbar-spacer" />

      <div className="top-actions" role="toolbar" aria-label="历史记录与视图">
        <button className="icon-text-button" type="button" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={18} />
          撤销
        </button>
        <button className="icon-text-button" type="button" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={18} />
          重做
        </button>
        <span className="toolbar-divider" />
        <button className={`icon-text-button ${printMode ? "is-active" : ""}`} type="button" onClick={onTogglePrint}>
          <FlipHorizontal2 size={18} />
          {printMode ? "返回编辑" : "纯净视图"}
        </button>
        <button className="icon-button" type="button" aria-label="偏好设置" onClick={onOpenSettings}>
          <Settings2 size={18} />
        </button>
      </div>

      <div className="save-state" aria-label={`保存状态：${saveLabel}`}>
        <Cloud size={17} />
        <span>{saveLabel}</span>
        <time>{savedAt}</time>
      </div>

      <div className="theme-switcher" role="group" aria-label="界面主题">
        <Palette size={15} aria-hidden="true" />
        <button className={theme === "minimal" ? "is-active" : ""} type="button" onClick={() => onThemeChange("minimal")}>简约</button>
        <button className={theme === "cute" ? "is-active" : ""} type="button" onClick={() => onThemeChange("cute")}><PawPrint size={13} />猫爪</button>
      </div>

      <button className="legal-notice-button" type="button" onClick={onOpenLegal}>
        <ShieldAlert size={17} />
        <span>免责声明</span>
        {!legalAcknowledged && <i aria-hidden="true" />}
      </button>
    </header>
  );
}
