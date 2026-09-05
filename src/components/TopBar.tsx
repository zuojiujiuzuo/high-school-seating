import {
  ALargeSmall,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Eraser,
  FlipHorizontal2,
  Layers3,
  Palette,
  PawPrint,
  Plus,
  Redo2,
  Settings2,
  ShieldAlert,
  Trash2,
  Undo2,
  UsersRound,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { AppTheme, UiFontSize } from "../types";
import { BrandIcon } from "./BrandIcon";

interface TopBarProps {
  currentClass: string;
  currentVersion: string;
  classes: string[];
  versions: string[];
  savedAt: string;
  saveStatus: "saved" | "saving" | "error";
  legalAcknowledged: boolean;
  theme: AppTheme;
  fontSize: UiFontSize;
  canUndo: boolean;
  canRedo: boolean;
  printMode: boolean;
  onClassChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  onCreateClass: () => void;
  onClearClass: () => void;
  onDeleteClass: () => void;
  onCreateVersion: () => void;
  onDeleteVersion: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePrint: () => void;
  onOpenSettings: () => void;
  onOpenOnboarding: () => void;
  onOpenLegal: () => void;
  onThemeChange: (theme: AppTheme) => void;
  onFontSizeChange: (fontSize: UiFontSize) => void;
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
  fontSize,
  canUndo,
  canRedo,
  printMode,
  onClassChange,
  onVersionChange,
  onCreateClass,
  onClearClass,
  onDeleteClass,
  onCreateVersion,
  onDeleteVersion,
  onUndo,
  onRedo,
  onTogglePrint,
  onOpenSettings,
  onOpenOnboarding,
  onOpenLegal,
  onThemeChange,
  onFontSizeChange,
}: TopBarProps) {
  const saveLabel = {
    saved: "本地已保存",
    saving: "正在保存",
    error: "保存失败",
  }[saveStatus];

  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="班阵，佐玖小工具 1.0">
        <BrandIcon className="brand-icon" />
        <span className="brand-wordmark-stack" aria-hidden="true">
          <span className="brand-wordmark" />
          <span className="brand-version">佐玖小工具 1.0</span>
        </span>
      </div>

      <div className="workspace-switchers" data-tour-target="workspaces">
        <WorkspacePicker
          className="class-picker"
          label="当前班级"
          value={currentClass}
          options={classes}
          icon={<UsersRound size={16} />}
          onChange={onClassChange}
          actions={[
            { label: "新建班级", icon: <Plus size={16} />, onSelect: onCreateClass },
            { label: "清空当前班级名单", icon: <Eraser size={16} />, tone: "danger", onSelect: onClearClass },
            { label: "删除当前班级", icon: <Trash2 size={16} />, tone: "danger", disabled: classes.length <= 1, disabledReason: "至少保留一个班级", onSelect: onDeleteClass },
          ]}
        />
        <WorkspacePicker
          className="plan-picker"
          label="座位版本"
          value={currentVersion}
          options={versions}
          icon={<Layers3 size={16} />}
          onChange={onVersionChange}
          actions={[
            { label: "新建座位版本", icon: <Plus size={16} />, onSelect: onCreateVersion },
            { label: "删除当前座位版本", icon: <Trash2 size={16} />, tone: "danger", disabled: versions.length <= 1, disabledReason: "至少保留一个座位版本", onSelect: onDeleteVersion },
          ]}
        />
      </div>

      <div className="topbar-spacer" />

      <div className="top-actions" role="toolbar" aria-label="历史记录与视图">
        <button className="icon-text-button" type="button" aria-label="撤销" title="撤销" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={18} />
          <span>撤销</span>
        </button>
        <button className="icon-text-button" type="button" aria-label="重做" title="重做" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={18} />
          <span>重做</span>
        </button>
        <span className="toolbar-divider" />
        <button className={`icon-text-button ${printMode ? "is-active" : ""}`} type="button" aria-label={printMode ? "返回编辑" : "纯净视图"} title={printMode ? "返回编辑" : "纯净视图"} onClick={onTogglePrint}>
          <FlipHorizontal2 size={18} />
          <span>{printMode ? "返回编辑" : "纯净视图"}</span>
        </button>
        <button className="icon-button" type="button" aria-label="打开新手导览" onClick={onOpenOnboarding}>
          <CircleHelp size={18} />
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

      <div className="font-size-switcher" role="group" aria-label="界面字体大小">
        <ALargeSmall size={16} aria-hidden="true" />
        {([
          ["auto", "自动"],
          ["standard", "标准"],
          ["large", "大字"],
        ] as const).map(([value, label]) => (
          <button
            className={fontSize === value ? "is-active" : ""}
            type="button"
            aria-pressed={fontSize === value}
            key={value}
            onClick={() => onFontSizeChange(value)}
          >
            {label}
          </button>
        ))}
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

interface PickerAction {
  label: string;
  icon: ReactNode;
  tone?: "danger";
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}

function WorkspacePicker({ label, value, options, icon, actions, className, onChange }: {
  label: string;
  value: string;
  options: string[];
  icon: ReactNode;
  actions: PickerAction[];
  className?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const focusTrigger = () => window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(".workspace-picker-trigger")?.focus());

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(".workspace-picker-trigger")?.focus();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus());
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const offset = event.key === "ArrowDown" ? 1 : -1;
    items[(currentIndex + offset + items.length) % items.length]?.focus();
  };

  return (
    <div className={`workspace-picker ${className ?? ""} ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        className="select-like workspace-picker-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="workspace-picker-value"><small>{label}</small><strong>{value}</strong></span>
        <ChevronDown className="workspace-picker-chevron" size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="workspace-picker-menu" id={menuId} role="menu" aria-label={label} onKeyDown={moveFocus}>
          <div className="workspace-picker-menu-heading">{icon}<span>选择{label.replace("当前", "")}</span></div>
          <div className="workspace-picker-options">
            {options.map((option) => (
              <button
                className={option === value ? "is-current" : ""}
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={option === value}
                onClick={() => {
                  setOpen(false);
                  if (option !== value) onChange(option);
                  focusTrigger();
                }}
              >
                <span>{option}</span>{option === value && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="workspace-picker-actions">
            {actions.map((action) => (
              <button
                className={action.tone === "danger" ? "is-danger" : ""}
                disabled={action.disabled}
                aria-label={action.disabled && action.disabledReason ? `${action.label}，${action.disabledReason}` : action.label}
                title={action.disabled ? action.disabledReason : undefined}
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              >
                {action.icon}<span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
