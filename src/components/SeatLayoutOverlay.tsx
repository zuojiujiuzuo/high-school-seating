import {
  Check,
  Eye,
  Grid3X3,
  PencilLine,
  Rows3,
  Save,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { getLayoutPreset, layoutPresets } from "../domain/layoutPresets";
import type { LayoutConfig, LayoutPresetId } from "../types";

interface SeatLayoutOverlayProps {
  config: LayoutConfig;
  preset: LayoutPresetId;
  required?: boolean;
  onClose: () => void;
  onApplyCustom: (config: LayoutConfig) => void;
  onApplyPreset: (preset: LayoutPresetId) => void;
}

const fixedPresets = layoutPresets.filter((item) => item.id !== "blank");
export const CUSTOM_LAYOUT_TEMPLATES_STORAGE_KEY = "banzhen-custom-layout-templates-v1";

export interface CustomLayoutTemplate {
  id: string;
  name: string;
  config: LayoutConfig;
}

export function loadCustomTemplates(): CustomLayoutTemplate[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CUSTOM_LAYOUT_TEMPLATES_STORAGE_KEY) ?? "[]") as CustomLayoutTemplate[];
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => (
      typeof item?.id === "string"
      && typeof item.name === "string"
      && Number.isFinite(item.config?.groups)
      && Number.isFinite(item.config?.rows)
      && (item.config?.columns === 1 || item.config?.columns === 2)
    ));
  } catch {
    return [];
  }
}

export function saveCustomLayoutTemplate(requestedName: string, config: LayoutConfig) {
  const templates = loadCustomTemplates();
  const name = requestedName.trim() || `自定义模板 ${templates.length + 1}`;
  const existing = templates.find((item) => item.name === name);
  const template: CustomLayoutTemplate = {
    id: existing?.id ?? `custom-layout-${Date.now()}`,
    name,
    config: { ...config },
  };
  const nextTemplates = existing
    ? templates.map((item) => item.id === existing.id ? template : item)
    : [...templates, template];
  window.localStorage.setItem(CUSTOM_LAYOUT_TEMPLATES_STORAGE_KEY, JSON.stringify(nextTemplates));
  return { template, templates: nextTemplates, updated: Boolean(existing) };
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function SeatLayoutOverlay({
  config,
  preset,
  required = false,
  onClose,
  onApplyCustom,
  onApplyPreset,
}: SeatLayoutOverlayProps) {
  const [draft, setDraft] = useState(config);
  const [draftPreset, setDraftPreset] = useState<LayoutPresetId>(preset);
  const [customTemplates, setCustomTemplates] = useState<CustomLayoutTemplate[]>(loadCustomTemplates);
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState<string>();
  const [templateName, setTemplateName] = useState("");
  const [templateFeedback, setTemplateFeedback] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !required) {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        "button, input, [tabindex]:not([tabindex='-1'])",
      )].filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>(".layout-type-card.is-selected")?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, required]);

  const updateDimension = (key: "groups" | "rows", value: number) => {
    const nextValue = key === "groups"
      ? clamp(value, 1, 8, draft.groups || 1)
      : clamp(value, 1, 12, draft.rows || 1);
    setDraft((current) => ({ ...current, [key]: nextValue }));
    setDraftPreset("blank");
    setSelectedCustomTemplateId(undefined);
  };

  const choosePreset = (id: LayoutPresetId) => {
    const definition = getLayoutPreset(id);
    setDraft({
      groups: definition.groups,
      rows: definition.rows,
      columns: definition.columns as 1 | 2,
    });
    setDraftPreset(id);
    setSelectedCustomTemplateId(undefined);
  };

  const chooseCustomTemplate = (template: CustomLayoutTemplate) => {
    setDraft({ ...template.config });
    setDraftPreset("blank");
    setSelectedCustomTemplateId(template.id);
    setTemplateFeedback(undefined);
  };

  const saveCustomTemplate = () => {
    try {
      const result = saveCustomLayoutTemplate(templateName, draft);
      setCustomTemplates(result.templates);
      setDraftPreset("blank");
      setSelectedCustomTemplateId(result.template.id);
      setTemplateName("");
      setTemplateFeedback(result.updated ? `已更新“${result.template.name}”` : `已保存“${result.template.name}”`);
    } catch {
      setTemplateFeedback("保存失败，请检查浏览器存储权限");
    }
  };

  const deleteCustomTemplate = (template: CustomLayoutTemplate) => {
    const nextTemplates = customTemplates.filter((item) => item.id !== template.id);
    try {
      window.localStorage.setItem(CUSTOM_LAYOUT_TEMPLATES_STORAGE_KEY, JSON.stringify(nextTemplates));
      setCustomTemplates(nextTemplates);
      if (selectedCustomTemplateId === template.id) setSelectedCustomTemplateId(undefined);
      setTemplateFeedback(`已删除“${template.name}”`);
    } catch {
      setTemplateFeedback("删除失败，请检查浏览器存储权限");
    }
  };

  const apply = () => {
    if (draftPreset !== "blank") onApplyPreset(draftPreset);
    else onApplyCustom(draft);
  };

  const capacity = draft.groups * draft.rows * draft.columns;

  return (
    <div className={`layout-designer-backdrop ${required ? "is-required" : ""}`} role="presentation" onMouseDown={required ? undefined : onClose}>
      <section
        ref={dialogRef}
        className="layout-designer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="layout-designer-header">
          <div>
            <span className="eyebrow">{required ? "INITIAL SEAT LAYOUT" : "SEAT LAYOUT"}</span>
            <h2 id={titleId}>{required ? "选择初始座位布局" : "设计座位布局"}</h2>
            <p>{required ? "选择并确认后，将在画布中生成这间教室的初始座位。" : "调整桌型、行列和教室网格。"}</p>
          </div>
          {!required && (
            <button className="layout-designer-close" type="button" onClick={onClose} aria-label="关闭座位布局">
              <X size={20} />
            </button>
          )}
        </header>

        <div className="layout-designer-body">
          {previewOpen ? (
            <LayoutPreview config={draft} />
          ) : (
            <>
          <section className="layout-designer-section" aria-label="选择类型">
            <div className="layout-type-grid">
              <button
                className={`layout-type-card ${draft.columns === 2 ? "is-selected" : ""}`}
                type="button"
                aria-pressed={draft.columns === 2}
                onClick={() => { setDraft((current) => ({ ...current, columns: 2 })); setDraftPreset("blank"); setSelectedCustomTemplateId(undefined); }}
              >
                <span className="layout-type-icon"><UsersRound size={24} /></span>
                <span><strong>同桌</strong><small>每桌 2 人，适合日常排座</small></span>
                <i aria-hidden="true">{draft.columns === 2 && <Check size={14} />}</i>
              </button>
              <button
                className={`layout-type-card ${draft.columns === 1 ? "is-selected" : ""}`}
                type="button"
                aria-pressed={draft.columns === 1}
                onClick={() => { setDraft((current) => ({ ...current, columns: 1 })); setDraftPreset("blank"); setSelectedCustomTemplateId(undefined); }}
              >
                <span className="layout-type-icon"><UserRound size={23} /></span>
                <span><strong>单桌</strong><small>每桌 1 人，适合考试与独立座位</small></span>
                <i aria-hidden="true">{draft.columns === 1 && <Check size={14} />}</i>
              </button>
            </div>
          </section>

          <section className="layout-designer-section" aria-label="设置几排几列">
            <div className="layout-dimension-row">
              <label>
                <span><Grid3X3 size={16} />几列</span>
                <input type="number" min="1" max="8" value={draft.groups} onChange={(event) => updateDimension("groups", Number(event.target.value))} />
                <small>1–8 列</small>
              </label>
              <span className="layout-dimension-times">×</span>
              <label>
                <span><Rows3 size={16} />几排</span>
                <input type="number" min="1" max="12" value={draft.rows} onChange={(event) => updateDimension("rows", Number(event.target.value))} />
                <small>1–12 排</small>
              </label>
              <div className="layout-capacity-live" aria-live="polite">
                <strong>{capacity}</strong>
                <span>总座位</span>
              </div>
            </div>
          </section>

          <div className="layout-template-divider"><span>固定模板</span></div>

          <section className="layout-template-grid" aria-label="固定座位布局模板">
            {fixedPresets.map((item) => (
              <button
                className={draftPreset === item.id ? "is-selected" : ""}
                type="button"
                key={item.id}
                aria-pressed={draftPreset === item.id}
                onClick={() => choosePreset(item.id)}
              >
                <LayoutMiniature groups={item.groups} rows={item.rows} columns={item.columns as 1 | 2} />
                <span><strong>{item.label}</strong><small>{item.groups} 列 × {item.rows} 排 · 每桌 {item.columns} 人</small></span>
                <i aria-hidden="true">{draftPreset === item.id && <Check size={13} />}</i>
              </button>
            ))}
          </section>

          <div className="layout-template-divider"><span>我的模板</span></div>

          <div className="layout-custom-template-save">
            <label>
              <span>模板名称</span>
              <input
                value={templateName}
                maxLength={24}
                placeholder={`例如：${draft.groups} 列常规教室`}
                onChange={(event) => { setTemplateName(event.target.value); setTemplateFeedback(undefined); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveCustomTemplate();
                  }
                }}
              />
            </label>
            <button className="secondary-button" type="button" onClick={saveCustomTemplate}><Save size={15} />保存当前布局</button>
            {templateFeedback && <small role="status">{templateFeedback}</small>}
          </div>

          {customTemplates.length ? (
            <section className="layout-custom-template-grid" aria-label="自定义座位布局模板">
              {customTemplates.map((template) => (
                <div className={selectedCustomTemplateId === template.id ? "is-selected" : ""} key={template.id}>
                  <button className="layout-custom-template-select" type="button" aria-pressed={selectedCustomTemplateId === template.id} onClick={() => chooseCustomTemplate(template)}>
                    <LayoutMiniature {...template.config} />
                    <span><strong>{template.name}</strong><small>{template.config.groups} 列 × {template.config.rows} 排 · 每桌 {template.config.columns} 人</small></span>
                    <i aria-hidden="true">{selectedCustomTemplateId === template.id && <Check size={13} />}</i>
                  </button>
                  <button className="layout-custom-template-delete" type="button" aria-label={`删除自定义模板：${template.name}`} onClick={() => deleteCustomTemplate(template)}><Trash2 size={13} /></button>
                </div>
              ))}
            </section>
          ) : (
            <p className="layout-custom-template-empty">调整上方桌型和行列后，可保存为自己的常用模板。</p>
          )}
            </>
          )}
        </div>

        <footer className="layout-designer-footer">
          <p><strong>{draft.columns === 2 ? "同桌" : "单桌"}</strong><span> · {draft.groups} 列 × {draft.rows} 排</span></p>
          <div>
            <button className="secondary-button" type="button" aria-pressed={previewOpen} onClick={() => setPreviewOpen((current) => !current)}>
              {previewOpen ? <PencilLine size={16} /> : <Eye size={16} />}
              {previewOpen ? "返回编辑" : "预览布局"}
            </button>
            {!required && <button className="secondary-button" type="button" onClick={onClose}>取消</button>}
            <button className="primary-button" type="button" onClick={apply}><Check size={16} />{required ? "确认生成初始座位" : "应用布局"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function LayoutMiniature({ groups, rows, columns }: LayoutConfig) {
  const visibleGroups = Math.min(groups, 6);
  const visibleRows = Math.min(rows, 5);
  return (
    <span className={`layout-miniature ${columns === 1 ? "is-single" : ""}`} aria-hidden="true">
      {Array.from({ length: visibleGroups }, (_, group) => (
        <i key={group}>
          {Array.from({ length: visibleRows }, (__, row) => <b key={row} />)}
        </i>
      ))}
    </span>
  );
}

function LayoutPreview({ config }: { config: LayoutConfig }) {
  const capacity = config.groups * config.rows * config.columns;
  return (
    <section className="layout-live-preview" aria-label="当前座位布局预览">
      <header>
        <span>当前布局预览</span>
        <strong>{config.groups} 列 × {config.rows} 排 · 每桌 {config.columns} 人 · 共 {capacity} 座</strong>
      </header>
      <div className="layout-preview-classroom">
        <div className="layout-preview-front">
          <strong>讲台</strong>
        </div>
        <div className="layout-preview-groups" style={{ gridTemplateColumns: `repeat(${config.groups}, minmax(0, 1fr))` }}>
          {Array.from({ length: config.groups }, (_, group) => (
            <div className="layout-preview-group" key={group}>
              <small>第 {group + 1} 组</small>
              <div>
                {Array.from({ length: config.rows }, (__, row) => (
                  <span className={`layout-preview-desk ${config.columns === 1 ? "is-single" : ""}`} key={row}>
                    {Array.from({ length: config.columns }, (___, column) => <i key={column} />)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p>教室前方在上，座位按当前桌型、列数与排数等距排列。</p>
    </section>
  );
}
