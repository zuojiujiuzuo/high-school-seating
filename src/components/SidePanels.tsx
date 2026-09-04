import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  DoorOpen,
  FileImage,
  FileSpreadsheet,
  FileText,
  Grid3X3,
  LayoutGrid,
  Link2,
  MonitorUp,
  Palette,
  Presentation,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Unlink2,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { algorithmOptions } from "../data/mockData";
import { layoutPresets } from "../domain/layoutPresets";
import { plannedPairCount, ruleLabels } from "../domain/rules";
import type {
  ConstraintType,
  DoorPlacement,
  LayoutPresetId,
  RuleConflict,
  SeatingConstraint,
  Student,
} from "../types";

interface RosterPanelProps {
  onImport: () => void;
  onAddStudent: () => void;
  onNext: () => void;
}

export function RosterPanel({ onImport, onAddStudent, onNext }: RosterPanelProps) {
  return (
    <aside className="inspector-panel">
      <PanelHeading eyebrow="名单检查" title="数据准备" note="先处理必填项，再进入布局。" />
      <div className="health-card">
        <div className="health-ring">100<small>%</small></div>
        <div><strong>必填信息完整</strong><span>姓名、性别、班级均已识别</span></div>
      </div>
      <section className="panel-section">
        <h3>导入方式</h3>
        <button className="wide-choice is-selected" type="button" onClick={onImport}>
          <FileSpreadsheet size={19} />
          <span><strong>Excel 名单</strong><small>自动识别并预览映射</small></span>
          <ChevronRight size={17} />
        </button>
        <button className="wide-choice" type="button" onClick={onAddStudent}>
          <FileText size={19} />
          <span><strong>手动录入</strong><small>适合临时增加少量学生</small></span>
          <ChevronRight size={17} />
        </button>
      </section>
      <div className="panel-note"><ShieldCheck size={17} />所有学生数据仅保存在本机。</div>
      <div className="panel-footer">
        <button className="primary-button full-width" type="button" onClick={onNext}>名单确认，设计布局 <ArrowRight size={17} /></button>
      </div>
    </aside>
  );
}

interface LayoutPanelProps {
  preset: LayoutPresetId;
  doorPlacement: DoorPlacement;
  disabledSeatCount: number;
  groups: number;
  rows: number;
  seatsPerDesk: 1 | 2;
  aisleWidth: number;
  onPresetChange: (preset: LayoutPresetId) => void;
  onDoorPlacementChange: (placement: DoorPlacement) => void;
  onRowsChange: (rows: number) => void;
  onSeatsPerDeskChange: (seatsPerDesk: 1 | 2) => void;
  onOpenAdvanced: () => void;
  onApply: () => void;
  onNext: () => void;
}

const doorOptions: { id: DoorPlacement; label: string }[] = [
  { id: "front-left", label: "左前" },
  { id: "front-right", label: "右前" },
  { id: "back-left", label: "左后" },
  { id: "back-right", label: "右后" },
];

export function LayoutPanel({
  preset,
  doorPlacement,
  disabledSeatCount,
  groups,
  rows,
  seatsPerDesk,
  aisleWidth,
  onPresetChange,
  onDoorPlacementChange,
  onRowsChange,
  onSeatsPerDeskChange,
  onOpenAdvanced,
  onApply,
  onNext,
}: LayoutPanelProps) {
  return (
    <aside className="inspector-panel">
      <PanelHeading eyebrow="教室结构" title="布局预设" note="地点大组与学生小组相互独立。" />
      <div className="preset-grid">
        {layoutPresets.map(({ id, label }) => (
          <button className={`preset-card ${preset === id ? "is-selected" : ""}`} key={id} type="button" onClick={() => onPresetChange(id)}>
            <Grid3X3 size={20} />
            <strong>{label}</strong>
            {preset === id && <small>当前</small>}
          </button>
        ))}
      </div>
      <section className="panel-section door-section">
        <div className="section-title-row"><h3>教室门</h3><small><DoorOpen size={13} />画布实时预览</small></div>
        <div className="door-options">
          {doorOptions.map((option) => (
            <button
              className={doorPlacement === option.id ? "is-selected" : ""}
              key={option.id}
              type="button"
              onClick={() => onDoorPlacementChange(option.id)}
            >
              <DoorOpen size={16} />{option.label}
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section compact-form">
        <div className="section-title-row"><h3>网格参数</h3><button className="text-button" type="button" onClick={onOpenAdvanced}>高级编辑</button></div>
        <label>
          <span>每组排数</span>
          <span className="number-stepper">
            <button type="button" aria-label="减少每组排数" disabled={rows <= 1} onClick={() => onRowsChange(Math.max(1, rows - 1))}>−</button>
            <output>{rows || "—"}</output>
            <button type="button" aria-label="增加每组排数" disabled={rows >= 12} onClick={() => onRowsChange(Math.min(12, rows + 1))}>＋</button>
          </span>
        </label>
        <label>
          <span>每桌人数</span>
          <span className="segmented-mini">
            <button className={seatsPerDesk === 2 ? "is-active" : ""} type="button" onClick={() => onSeatsPerDeskChange(2)}>2 人</button>
            <button className={seatsPerDesk === 1 ? "is-active" : ""} type="button" onClick={() => onSeatsPerDeskChange(1)}>1 人</button>
          </span>
        </label>
        <label><span>组间走廊</span><strong className="locked-value">等宽 · {Math.round(aisleWidth)}px</strong></label>
        <label><span>禁用座位</span><strong className="disabled-count">{disabledSeatCount} 个 · 画布显示 ×</strong></label>
      </section>
      <div className="invariant-card">
        <Check size={17} />
        <div><strong>布局约束已锁定</strong><span>{groups} 组等距居中，仅保留 1 个讲台</span></div>
      </div>
      <button className="secondary-button full-width" type="button" onClick={onApply}><RotateCcw size={16} />应用并播放布局动效</button>
      <div className="panel-footer">
        <button className="primary-button full-width" type="button" onClick={onNext}>布局确认，安排规则 <ArrowRight size={17} /></button>
      </div>
    </aside>
  );
}

interface RulePanelProps {
  selectedStudents: Student[];
  selectedRule: ConstraintType;
  constraints: SeatingConstraint[];
  conflicts: RuleConflict[];
  onRuleChange: (rule: ConstraintType) => void;
  onRemoveSelected: (studentId: string) => void;
  onClearSelection: () => void;
  onAddRule: () => void;
  needsRearrange: boolean;
  onRearrange: () => void;
  onDeleteConstraintBatch: (batchId: string) => void;
}

const ruleOptions: { id: ConstraintType; icon: typeof UsersRound; note: string }[] = [
  { id: "not_desk_mate", icon: UserRoundX, note: "不能共享一张桌" },
  { id: "desk_mate", icon: UsersRound, note: "必须共享一张桌" },
  { id: "adjacent", icon: Link2, note: "位于八方向邻域" },
  { id: "not_adjacent", icon: Unlink2, note: "离开八方向邻域" },
];

export function RulePanel({
  selectedStudents,
  selectedRule,
  constraints,
  conflicts,
  onRuleChange,
  onRemoveSelected,
  onClearSelection,
  onAddRule,
  needsRearrange,
  onRearrange,
  onDeleteConstraintBatch,
}: RulePanelProps) {
  const positive = selectedRule === "desk_mate" || selectedRule === "adjacent";
  const hasOddPair = positive && selectedStudents.length > 2 && selectedStudents.length % 2 !== 0;
  const count = plannedPairCount(selectedRule, selectedStudents.length);
  const groupedConstraints = [...new Map(constraints.map((item) => [item.batchId, item])).values()].slice(-2).reverse();

  return (
    <aside className="inspector-panel rule-panel">
      <PanelHeading eyebrow="关系编排" title="自定义规则" note="选择学生，再定义他们之间的关系。" />
      <div className="selected-heading">
        <strong>已选 {selectedStudents.length} 人</strong>
        {selectedStudents.length > 0 && <button className="text-button" type="button" onClick={onClearSelection}>清除</button>}
      </div>
      <div className="student-chip-list">
        {selectedStudents.length ? selectedStudents.map((student, index) => (
          <button key={student.id} type="button" onClick={() => onRemoveSelected(student.id)} title="移出选择">
            <span>{index + 1}</span>{student.name}<b>×</b>
          </button>
        )) : <p className="selection-empty">在名单或座位图中选择至少两名学生</p>}
      </div>

      <div className="rule-choice-grid">
        {ruleOptions.map(({ id, icon: Icon, note }) => (
          <button className={`rule-choice ${selectedRule === id ? "is-selected" : ""}`} key={id} type="button" onClick={() => onRuleChange(id)}>
            <Icon size={22} strokeWidth={1.55} />
            <strong>{ruleLabels[id]}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>

      <div className="adjacency-definition">
        <LayoutGrid size={16} />
        <span><strong>相邻范围</strong>同桌 + 前后左右 + 斜角</span>
      </div>

      {positive && selectedStudents.length > 2 && (
        <div className={`pairing-preview ${hasOddPair ? "has-error" : ""}`}>
          <div className="section-title-row"><strong>配对预览</strong><small>每人本批仅出现一次</small></div>
          {selectedStudents.map((student, index) => index % 2 === 0 ? (
            <div className="pair-row" key={student.id}>
              <span>{student.name}</span><Link2 size={14} /><span>{selectedStudents[index + 1]?.name ?? "等待补选"}</span>
            </div>
          ) : null)}
        </div>
      )}

      <div className={`rule-summary ${hasOddPair ? "has-error" : ""}`}>
        {hasOddPair ? <AlertTriangle size={18} /> : <Sparkles size={18} />}
        <div>
          <strong>{hasOddPair ? "还差 1 人完成配对" : `将建立 ${count} 条两两规则`}</strong>
          <span>全部按硬约束参与自动排座</span>
        </div>
      </div>

      <button className="primary-button full-width" type="button" disabled={selectedStudents.length < 2 || hasOddPair} onClick={onAddRule}>
        添加规则
      </button>

      {constraints.length > 0 && (
        <div className={`rule-rearrange-card ${needsRearrange ? "needs-rearrange" : ""}`}>
          <div>
            <strong>{needsRearrange ? "规则已保存，座位尚未更新" : "画布已应用当前规则"}</strong>
            <small>{needsRearrange ? "点击重排后，座位才会按新规则调整。" : "继续添加或删除规则后可再次重排。"}</small>
          </div>
          <button type="button" onClick={onRearrange}>
            <RotateCcw size={16} />{needsRearrange ? "按规则重排座位" : "再次重排座位"}
          </button>
        </div>
      )}

      {groupedConstraints.length > 0 && (
        <section className="panel-section existing-rules">
          <div className="section-title-row"><h3>最近添加</h3><small>{constraints.length} 条</small></div>
          {groupedConstraints.map((constraint) => (
            <div className="existing-rule" key={constraint.batchId}>
              <span className="rule-color-mark" />
              <div><strong>{ruleLabels[constraint.type]}</strong><small>批次包含 {constraints.filter((item) => item.batchId === constraint.batchId).length} 条</small></div>
              <button type="button" onClick={() => onDeleteConstraintBatch(constraint.batchId)}>删除</button>
            </div>
          ))}
        </section>
      )}

      <div className={`diagnostic-strip ${conflicts.length ? "has-error" : ""}`}>
        {conflicts.length ? <AlertTriangle size={18} /> : <Check size={18} />}
        <span><strong>{conflicts.length ? `${conflicts.length} 处规则冲突` : "当前无冲突"}</strong>{conflicts[0]?.message ?? "所有硬约束可以同时成立"}</span>
      </div>
    </aside>
  );
}

interface GeneratePanelProps {
  algorithm: string;
  weights: {
    score: number;
    height: number;
    appearance: number;
  };
  onAlgorithmChange: (algorithm: string) => void;
  onWeightChange: (key: "score" | "height" | "appearance", value: number) => void;
  onGenerate: () => void;
}

export function GeneratePanel({ algorithm, weights, onAlgorithmChange, onWeightChange, onGenerate }: GeneratePanelProps) {
  return (
    <aside className="inspector-panel">
      <PanelHeading eyebrow="自动排座" title="生成方案" note="硬约束先校验，再比较三个候选结果。" />
      <section className="panel-section">
        <h3>选择算法</h3>
        <div className="algorithm-list">
          {algorithmOptions.map((option) => (
            <button className={algorithm === option.id ? "is-selected" : ""} key={option.id} type="button" onClick={() => onAlgorithmChange(option.id)}>
              <span className="algorithm-radio" />
              <span><strong>{option.name}</strong><small>{option.note}</small></span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section weight-section">
        <div className="section-title-row"><h3>数据权重</h3><small>自动平衡</small></div>
        <label><span>成绩</span><input type="range" min="0" max="100" value={weights.score} onChange={(event) => onWeightChange("score", Number(event.target.value))} /><output>{weights.score}%</output></label>
        <label><span>身高</span><input type="range" min="0" max="100" value={weights.height} onChange={(event) => onWeightChange("height", Number(event.target.value))} /><output>{weights.height}%</output></label>
        <label><span>颜值</span><input type="range" min="0" max="100" value={weights.appearance} onChange={(event) => onWeightChange("appearance", Number(event.target.value))} /><output>{weights.appearance}%</output></label>
      </section>
      <div className="coverage-card">
        <strong>可用数据覆盖率</strong>
        <div><span style={{ width: "91%" }} /></div>
        <small>缺失值将使用班级中位数</small>
      </div>
      <button className="ai-entry" type="button" disabled><Sparkles size={17} /><span><strong>AI 自然语言排座</strong><small>计划于 v1.1 提供</small></span></button>
      <p className="ai-review-note">AI 座位方案仅供参考，最终座位由老师人工确认。</p>
      <div className="panel-footer">
        <button className="primary-button full-width generate-button" type="button" onClick={onGenerate}><Sparkles size={18} />生成 3 个方案</button>
      </div>
    </aside>
  );
}

type ExportFormat = "xlsx" | "svg" | "png" | "pdf" | "pptx";

interface ExportPanelProps {
  format: ExportFormat;
  showGender: boolean;
  showStudentNo: boolean;
  showGroupBoundaries: boolean;
  fileName: string;
  theme: "paper" | "ink";
  appTheme: "minimal" | "cute";
  onFormatChange: (format: ExportFormat) => void;
  onShowGenderChange: (value: boolean) => void;
  onShowStudentNoChange: (value: boolean) => void;
  onShowGroupBoundariesChange: (value: boolean) => void;
  onFileNameChange: (value: string) => void;
  onThemeChange: (value: "paper" | "ink") => void;
  onExport: () => void;
}

const formats: { id: ExportFormat; label: string; icon: typeof FileText }[] = [
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "svg", label: "SVG", icon: FileImage },
  { id: "png", label: "PNG", icon: FileImage },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "pptx", label: "PPTX", icon: Presentation },
];

export function ExportPanel({
  format,
  showGender,
  showStudentNo,
  showGroupBoundaries,
  fileName,
  theme,
  appTheme,
  onFormatChange,
  onShowGenderChange,
  onShowStudentNoChange,
  onShowGroupBoundariesChange,
  onFileNameChange,
  onThemeChange,
  onExport,
}: ExportPanelProps) {
  const usesCanvasSnapshot = format !== "xlsx";

  return (
    <aside className="inspector-panel">
      <PanelHeading
        eyebrow="打印与分享"
        title="导出座次"
        note={usesCanvasSnapshot ? "按当前画布原样导出，不再套用打印版式。" : "Excel 使用表格式版式预览。"}
      />
      <section className="panel-section">
        <h3>文件格式</h3>
        <div className="format-grid">
          {formats.map(({ id, label, icon: Icon }) => (
            <button className={format === id ? "is-selected" : ""} key={id} type="button" onClick={() => onFormatChange(id)}>
              <Icon size={18} />{label}
            </button>
          ))}
        </div>
      </section>
      {usesCanvasSnapshot ? (
        <>
          <div className="export-mode-note">
            <MonitorUp size={18} />
            <span><strong>导出当前画面</strong><small>座位、背景、配色和画布视角都会保留。</small></span>
          </div>
          {appTheme === "cute" && (
            <div className="color-print-note" role="note">
              <Palette size={18} />
              <span><strong>建议使用彩色打印</strong><small>可爱风含浅色背景，灰度打印容易让画面层次发糊。</small></span>
            </div>
          )}
        </>
      ) : (
        <>
          <section className="panel-section compact-form">
            <h3>显示内容</h3>
            <ToggleRow label="显示性别" checked={showGender} onChange={onShowGenderChange} />
            <ToggleRow label="显示学号后 3 位" checked={showStudentNo} onChange={onShowStudentNoChange} />
            <ToggleRow label="显示小组边界" checked={showGroupBoundaries} onChange={onShowGroupBoundariesChange} />
          </section>
          <section className="panel-section">
            <h3>表格主题</h3>
            <div className="theme-options">
              <button className={theme === "paper" ? "is-selected" : ""} type="button" onClick={() => onThemeChange("paper")}><span className="paper-swatch" />暖白线稿</button>
              <button className={theme === "ink" ? "is-selected" : ""} type="button" onClick={() => onThemeChange("ink")}><span className="ink-swatch" />纯黑省墨</button>
            </div>
          </section>
        </>
      )}
      <label className="file-name-field"><span>文件名</span><input value={fileName} onChange={(event) => onFileNameChange(event.target.value)} /><small>.{format}</small></label>
      <div className="panel-footer">
        <button className="primary-button full-width" type="button" onClick={onExport}>
          <Download size={18} />{usesCanvasSnapshot ? "导出当前画面" : "导出 Excel"}
        </button>
      </div>
    </aside>
  );
}

function PanelHeading({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <header className="panel-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{note}</p>
    </header>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track" />
    </label>
  );
}

export type { ExportFormat };
