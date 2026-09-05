import {
  Check,
  CircleOff,
  Grid3X3,
  MousePointer2,
  Move,
  Save,
  Search,
  SquareDashed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { layoutPresets } from "../domain/layoutPresets";
import type { LayoutConfig, LayoutPresetId, Student } from "../types";
import { LayoutMiniature, saveCustomLayoutTemplate } from "./SeatLayoutOverlay";
import { StyledTooltip } from "./StyledTooltip";

export type ToolMode = "select" | "move" | "seat" | "aisle" | "podium" | "empty" | "disabled";

export const toolDetails: Record<ToolMode, { label: string; description: string }> = {
  select: { label: "选择", description: "点击或框选学生；拖动学生即可换座。" },
  move: { label: "移动", description: "按住左键拖动画布；在任意工具下，也可以按住鼠标滚轮拖动画布。滚动滚轮可缩放。" },
  seat: { label: "座位", description: "点击空白处添加座位；拖动已有座位调整位置。" },
  aisle: { label: "过道", description: "在画布上左右拖动，统一调整大组之间的过道宽度。" },
  podium: { label: "讲台", description: "拖动讲台，或点击教室前方区域快速移动。" },
  empty: { label: "空位", description: "点击已入座学生，将该座位清空并把学生退回名单。" },
  disabled: { label: "禁用", description: "点击座位切换禁用状态；禁用座位不会参与排座。" },
};

const tools: { id: ToolMode; icon: typeof MousePointer2 }[] = [
  { id: "select", icon: MousePointer2 },
  { id: "move", icon: Move },
  { id: "empty", icon: SquareDashed },
  { id: "disabled", icon: CircleOff },
];

interface ToolRailProps {
  active: ToolMode;
  layoutConfig: LayoutConfig;
  layoutPreset: LayoutPresetId;
  students: Student[];
  studentLocations: Record<string, string>;
  showStudentSearch: boolean;
  onChange: (tool: ToolMode) => void;
  onOpenLayout: () => void;
  onApplyPreset: (preset: LayoutPresetId) => void;
  onApplyLayout: (config: LayoutConfig) => void;
  onSelectStudent: (studentId: string) => void;
  onTemplateSaved: (message: string) => void;
}

const quickPresetIds: LayoutPresetId[] = ["48-seat", "54-seat", "exam"];

export function ToolRail({
  active,
  layoutConfig,
  layoutPreset,
  students,
  studentLocations,
  showStudentSearch,
  onChange,
  onOpenLayout,
  onApplyPreset,
  onApplyLayout,
  onSelectStudent,
  onTemplateSaved,
}: ToolRailProps) {
  const [quickRows, setQuickRows] = useState(layoutConfig.rows || 1);
  const [quickColumns, setQuickColumns] = useState(layoutConfig.groups || 1);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateError, setTemplateError] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLDivElement>(null);
  const templateNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuickRows(layoutConfig.rows || 1);
    setQuickColumns(layoutConfig.groups || 1);
  }, [layoutConfig.groups, layoutConfig.rows]);

  useEffect(() => {
    if (!searchOpen) return;
    const close = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [searchOpen]);

  useEffect(() => {
    if (!saveOpen) return;
    const frame = window.requestAnimationFrame(() => templateNameRef.current?.select());
    const close = (event: PointerEvent) => {
      if (!saveRef.current?.contains(event.target as Node)) setSaveOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", close);
    };
  }, [saveOpen]);

  const saveAsTemplate = () => {
    try {
      const result = saveCustomLayoutTemplate(templateName, layoutConfig);
      const message = result.updated ? `已更新模板“${result.template.name}”` : `已保存模板“${result.template.name}”`;
      setSaveOpen(false);
      setTemplateError("");
      onTemplateSaved(message);
    } catch {
      setTemplateError("保存失败，请检查浏览器存储权限");
    }
  };

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return students.filter((student) => (
      student.name.toLocaleLowerCase().includes(normalized)
      || student.studentNo?.toLocaleLowerCase().includes(normalized)
    )).slice(0, 7);
  }, [query, students]);

  const clamp = (value: number, min: number, max: number, fallback: number) => (
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
  );

  return (
    <aside className="tool-rail" aria-label="画布工具" data-tour-target="tools">
      {tools.map(({ id, icon: Icon }) => (
        <button
          className={`tool-button has-styled-tooltip ${active === id ? "is-active" : ""}`}
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          aria-label={`${toolDetails[id].label}：${toolDetails[id].description}`}
        >
          <Icon size={20} strokeWidth={1.65} />
          <span>{toolDetails[id].label}</span>
          <StyledTooltip
            label={toolDetails[id].label}
            description={toolDetails[id].description}
            side="top"
          />
        </button>
      ))}
      <span className="tool-rail-divider" />
      <div className="layout-tool">
        <button
          className="tool-button layout-tool-trigger"
          type="button"
          aria-label="座位布局：悬浮可快速选择模板，点击打开完整布局"
          onClick={onOpenLayout}
        >
          <Grid3X3 size={20} strokeWidth={1.65} />
          <span className="tool-button-label-two-line" aria-hidden="true">
            <span>座位</span>
            <span>布局</span>
          </span>
        </button>
        <div className="layout-quick-popover" role="group" aria-label="快速座位布局">
          <div className="layout-quick-heading">
            <span><strong>快速布局</strong><small>点击“座位布局”可完整设置</small></span>
            <Grid3X3 size={18} />
          </div>
          <div className="layout-quick-presets">
            {quickPresetIds.map((id) => {
              const item = layoutPresets.find((preset) => preset.id === id)!;
              return (
                <button className={layoutPreset === id ? "is-selected" : ""} type="button" key={id} onClick={() => onApplyPreset(id)}>
                  <LayoutMiniature groups={item.groups} rows={item.rows} columns={item.columns as 1 | 2} />
                  <span><strong>{item.label.replace(/ · .+$/, "")}</strong><small>{item.groups} 列 × {item.rows} 排</small></span>
                  {layoutPreset === id && <Check size={13} />}
                </button>
              );
            })}
          </div>
          <div className="layout-quick-custom">
            <label><span>列</span><input aria-label="座位列数" type="number" min="1" max="8" value={quickColumns} onChange={(event) => setQuickColumns(clamp(Number(event.target.value), 1, 8, quickColumns))} /></label>
            <i aria-hidden="true">×</i>
            <label><span>排</span><input aria-label="座位排数" type="number" min="1" max="12" value={quickRows} onChange={(event) => setQuickRows(clamp(Number(event.target.value), 1, 12, quickRows))} /></label>
            <button type="button" onClick={() => onApplyLayout({ groups: quickColumns, rows: quickRows, columns: layoutConfig.columns })}>应用</button>
          </div>
        </div>
      </div>

      <div className={`layout-save-tool ${saveOpen ? "is-open" : ""}`} ref={saveRef}>
        <button
          className="tool-button layout-save-trigger"
          type="button"
          aria-label="保存模板"
          aria-expanded={saveOpen}
          onClick={() => {
            if (!saveOpen) {
              setTemplateName(`${layoutConfig.groups} 列 × ${layoutConfig.rows} 排${layoutConfig.columns === 1 ? "单桌" : "同桌"}`);
              setTemplateError("");
            }
            setSaveOpen((current) => !current);
          }}
        >
          <Save size={20} strokeWidth={1.65} />
          <span className="tool-button-label-two-line" aria-hidden="true">
            <span>保存</span>
            <span>模板</span>
          </span>
        </button>
        {saveOpen && (
          <div className="layout-save-popover" role="dialog" aria-label="保存当前布局为模板">
            <div className="layout-save-heading">
              <span><strong>保存为模板</strong><small>保存当前桌型和行列配置</small></span>
              <Save size={18} />
            </div>
            <label>
              <span>模板名称</span>
              <input
                ref={templateNameRef}
                value={templateName}
                maxLength={24}
                onChange={(event) => { setTemplateName(event.target.value); setTemplateError(""); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveAsTemplate();
                  if (event.key === "Escape") setSaveOpen(false);
                }}
              />
            </label>
            {templateError && <p role="alert">{templateError}</p>}
            <button type="button" onClick={saveAsTemplate}><Save size={14} />确认保存</button>
          </div>
        )}
      </div>

      {showStudentSearch && (
        <>
          <span className="tool-rail-divider" />
          <div className={`tool-student-search ${searchOpen ? "is-open" : ""}`} ref={searchRef}>
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              placeholder="搜索学生"
              aria-label="搜索学生姓名或学号"
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  event.currentTarget.blur();
                }
                if (event.key === "Enter" && results[0]) {
                  onSelectStudent(results[0].id);
                  setSearchOpen(false);
                }
              }}
            />
            {query && <button type="button" aria-label="清空学生搜索" onClick={() => setQuery("")}><X size={14} /></button>}
            {searchOpen && query.trim() && (
              <div className="tool-search-results" role="listbox" aria-label="学生搜索结果">
                <div className="tool-search-result-heading"><span>搜索结果</span><small>{results.length ? `${results.length} 人` : "无匹配"}</small></div>
                {results.length ? results.map((student) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={student.id}
                    onClick={() => {
                      onSelectStudent(student.id);
                      setQuery(student.name);
                      setSearchOpen(false);
                    }}
                  >
                    <span className={`gender-dot gender-${student.gender}`} />
                    <span><strong>{student.name}</strong><small>{student.studentNo ?? "未填写学号"}</small></span>
                    <em>{studentLocations[student.id] ?? "待入座"}</em>
                  </button>
                )) : <p>没有找到“{query.trim()}”</p>}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
