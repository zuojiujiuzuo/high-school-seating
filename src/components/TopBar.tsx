import {
  ALargeSmall,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Eraser,
  FlipHorizontal2,
  Layers3,
  Palette,
  Plus,
  Redo2,
  Settings2,
  ShieldAlert,
  Trash2,
  Undo2,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { AppTheme, UiFontSize } from "../types";
import { licenseStateLabel, type LicenseStatus } from "../data/license";
import { BrandIcon } from "./BrandIcon";

interface TopBarProps {
  currentClass: string;
  currentVersion: string;
  classes: string[];
  versions: string[];
  savedAt: string;
  saveStatus: "saved" | "saving" | "error";
  legalAcknowledged: boolean;
  licenseStatus: LicenseStatus;
  theme: AppTheme;
  fontSize: UiFontSize;
  canUndo: boolean;
  canRedo: boolean;
  printMode: boolean;
  onClassChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  onCreateClass: () => void;
  onImportClassFile: (file: File) => Promise<void>;
  onClearClass: () => void;
  onDeleteClass: () => void;
  onCreateVersion: () => void;
  onDeleteVersion: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePrint: () => void;
  onOpenSettings: () => void;
  onOpenLicense: () => void;
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
  licenseStatus,
  theme,
  fontSize,
  canUndo,
  canRedo,
  printMode,
  onClassChange,
  onVersionChange,
  onCreateClass,
  onImportClassFile,
  onClearClass,
  onDeleteClass,
  onCreateVersion,
  onDeleteVersion,
  onUndo,
  onRedo,
  onTogglePrint,
  onOpenSettings,
  onOpenLicense,
  onOpenOnboarding,
  onOpenLegal,
  onThemeChange,
  onFontSizeChange,
}: TopBarProps) {
  const classFileInputRef = useRef<HTMLInputElement>(null);
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
            { label: "导入班级", description: "从迁移用 .zj 文件恢复", icon: <UploadCloud size={16} />, onSelect: () => classFileInputRef.current?.click() },
            { label: "清空当前班级名单", icon: <Eraser size={16} />, tone: "danger", onSelect: onClearClass },
            { label: "删除当前班级", icon: <Trash2 size={16} />, tone: "danger", disabled: classes.length <= 1, disabledReason: "至少保留一个班级", onSelect: onDeleteClass },
          ]}
        />
        <input
          ref={classFileInputRef}
          className="visually-hidden"
          type="file"
          accept=".zj,application/octet-stream"
          aria-label="导入班级 .zj 迁移文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onImportClassFile(file).catch(() => undefined);
          }}
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
        <button className="icon-button" type="button" aria-label="设置" title="设置" onClick={onOpenSettings}>
          <Settings2 size={18} />
        </button>
      </div>

      <div className="save-state" aria-label={`保存状态：${saveLabel}`}>
        <Cloud size={17} />
        <span>{saveLabel}</span>
        <time>{savedAt}</time>
      </div>

      <button
        className={`license-status-button is-${licenseStatus.state}`}
        type="button"
        aria-label={`授权状态：${licenseStateLabel(licenseStatus.state)}${licenseStatus.licenseId ? `，${licenseStatus.licenseId}` : ""}`}
        title="查看正版授权信息"
        onClick={onOpenLicense}
      >
        <BadgeCheck size={17} aria-hidden="true" />
      </button>

      <FontSizePicker value={fontSize} onChange={onFontSizeChange} />

      <ThemePicker value={theme} onChange={onThemeChange} />

      <button className="legal-notice-button" type="button" onClick={onOpenLegal}>
        <ShieldAlert size={17} />
        <span>免责声明</span>
        {!legalAcknowledged && <i aria-hidden="true" />}
      </button>
    </header>
  );
}

const themeOptions: Array<{ value: AppTheme; label: string }> = [
  { value: "minimal", label: "简约主题" },
  { value: "cute", label: "猫爪主题" },
];

const fontSizeOptions: Array<{ value: UiFontSize; label: string }> = [
  { value: "auto", label: "自动字体" },
  { value: "standard", label: "标准字体" },
  { value: "large", label: "大字" },
  { value: "xlarge", label: "超大字" },
];

function FontSizePicker({ value, onChange }: { value: UiFontSize; onChange: (fontSize: UiFontSize) => void }) {
  return (
    <ToolbarChoicePicker
      className="font-size-picker"
      label="字体大小"
      value={value}
      options={fontSizeOptions}
      icon={<ALargeSmall size={17} aria-hidden="true" />}
      onChange={onChange}
    />
  );
}

function ThemePicker({ value, onChange }: { value: AppTheme; onChange: (theme: AppTheme) => void }) {
  return (
    <ToolbarChoicePicker
      className="theme-picker"
      label="界面主题"
      value={value}
      options={themeOptions}
      icon={<Palette size={17} aria-hidden="true" />}
      renderPrefix={(option) => <span className={`theme-option-swatch is-${option.value}`} aria-hidden="true" />}
      onChange={onChange}
    />
  );
}

function ToolbarChoicePicker<T extends string>({ className, label, value, options, icon, renderPrefix, onChange }: {
  className: string;
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  icon: ReactNode;
  renderPrefix?: (option: { value: T; label: string }) => ReactNode;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  const focusOption = (index: number) => {
    window.requestAnimationFrame(() => {
      const options = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']");
      options?.[(index + options.length) % options.length]?.focus();
    });
  };

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    return () => {
      window.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  const choose = (nextValue: T) => {
    setOpen(false);
    if (nextValue !== value) onChange(nextValue);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div
      className={`toolbar-choice-picker ${className} ${open ? "is-open" : ""}`}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        className="toolbar-choice-trigger"
        type="button"
        aria-label={`${label}：${selected.label}`}
        title={`${label}：${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) focusOption(options.findIndex((option) => option.value === value));
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const selectedIndex = options.findIndex((option) => option.value === value);
          setOpen(true);
          focusOption(selectedIndex + (event.key === "ArrowDown" ? 1 : -1));
        }}
      >
        {icon}
      </button>
      {open && (
        <div
          className={`toolbar-choice-menu ${renderPrefix ? "has-prefix" : ""}`}
          id={menuId}
          role="menu"
          aria-label={`选择${label}`}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']")];
            const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
            const nextIndex = event.key === "Home"
              ? 0
              : event.key === "End"
                ? options.length - 1
                : currentIndex + (event.key === "ArrowDown" ? 1 : -1);
            options[(nextIndex + options.length) % options.length]?.focus();
          }}
        >
          {options.map((option) => (
            <button
              className={option.value === value ? "is-current" : ""}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              tabIndex={option.value === value ? 0 : -1}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              {renderPrefix?.(option)}
              <span>{option.label}</span>
              <Check size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PickerAction {
  label: string;
  description?: string;
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
                className={`${action.tone === "danger" ? "is-danger" : ""} ${action.description ? "has-description" : ""}`.trim()}
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
                {action.icon}
                <span className="workspace-picker-action-copy">
                  <strong>{action.label}</strong>
                  {action.description && <small>{action.description}</small>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
