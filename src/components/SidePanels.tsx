import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  DoorOpen,
  FileImage,
  FileSpreadsheet,
  FileText,
  Grid3X3,
  LayoutGrid,
  Link2,
  ListChecks,
  MonitorUp,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink2,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { algorithmOptions } from "../data/mockData";
import { layoutPresets } from "../domain/layoutPresets";
import { plannedPairCount, ruleLabels } from "../domain/rules";
import { StyledTooltip } from "./StyledTooltip";
import type {
  ConstraintType,
  DoorPlacement,
  ExportVariant,
  GenerationStrategy,
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
        <div><strong>必填信息完整</strong><span>姓名、学号均已识别</span></div>
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
  doorPlacements: DoorPlacement[];
  disabledSeatCount: number;
  groups: number;
  rows: number;
  seatsPerDesk: 1 | 2;
  aisleWidth: number;
  onPresetChange: (preset: LayoutPresetId) => void;
  onDoorPlacementToggle: (placement: DoorPlacement) => void;
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
  doorPlacements,
  disabledSeatCount,
  groups,
  rows,
  seatsPerDesk,
  aisleWidth,
  onPresetChange,
  onDoorPlacementToggle,
  onRowsChange,
  onSeatsPerDeskChange,
  onOpenAdvanced,
  onApply,
  onNext,
}: LayoutPanelProps) {
  return (
    <aside className="inspector-panel layout-inspector-panel">
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
        <div className="section-title-row"><h3>教室门</h3><small><DoorOpen size={13} />可多选 · 实时预览</small></div>
        <div className="door-options">
          {doorOptions.map((option) => (
            <button
              aria-pressed={doorPlacements.includes(option.id)}
              className={doorPlacements.includes(option.id) ? "is-selected" : ""}
              key={option.id}
              type="button"
              onClick={() => onDoorPlacementToggle(option.id)}
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

interface SeatingPanelProps {
  students: Student[];
  selectedStudents: Student[];
  selectedRule: ConstraintType;
  constraints: SeatingConstraint[];
  conflicts: RuleConflict[];
  onRuleChange: (rule: ConstraintType) => void;
  onRemoveSelected: (studentId: string) => void;
  onClearSelection: () => void;
  onAddRule: () => void;
  onDeleteConstraintBatch: (batchId: string) => void;
  algorithms: GenerationStrategy[];
  hasMissingGender: boolean;
  weights: {
    score: number;
    height: number;
    appearance: number;
  };
  onAlgorithmToggle: (algorithm: GenerationStrategy) => void;
  onWeightChange: (key: "score" | "height" | "appearance", value: number) => void;
  onGenerate: () => void;
  simpleMode: boolean;
  hasGeneratedPlan: boolean;
  onConfirmAndExport: () => void;
}

const ruleOptions: { id: ConstraintType; icon: typeof UsersRound; note: string }[] = [
  { id: "not_desk_mate", icon: UserRoundX, note: "不能共享一张桌" },
  { id: "desk_mate", icon: UsersRound, note: "必须共享一张桌" },
  { id: "adjacent", icon: Link2, note: "位于八方向邻域" },
  { id: "not_adjacent", icon: Unlink2, note: "离开八方向邻域" },
];

export function SeatingPanel({
  students,
  selectedStudents,
  selectedRule,
  constraints,
  conflicts,
  onRuleChange,
  onRemoveSelected,
  onClearSelection,
  onAddRule,
  onDeleteConstraintBatch,
  algorithms,
  hasMissingGender,
  weights,
  onAlgorithmToggle,
  onWeightChange,
  onGenerate,
  simpleMode,
  hasGeneratedPlan,
  onConfirmAndExport,
}: SeatingPanelProps) {
  const hasSelectedStudents = selectedStudents.length > 0;
  const hasRuleSelection = selectedStudents.length >= 2;
  const [activeTab, setActiveTab] = useState<"rules" | "solutions">(() => hasSelectedStudents ? "rules" : "solutions");
  const hadSelectedStudentsRef = useRef(hasSelectedStudents);
  const ruleTabRef = useRef<HTMLButtonElement>(null);
  const solutionTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasSelectedStudents && !hadSelectedStudentsRef.current) setActiveTab("rules");
    hadSelectedStudentsRef.current = hasSelectedStudents;
  }, [hasSelectedStudents]);

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextTab: "rules" | "solutions" | undefined;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") nextTab = "solutions";
    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End") nextTab = "rules";
    if (!nextTab) return;
    event.preventDefault();
    setActiveTab(nextTab);
    requestAnimationFrame(() => (nextTab === "rules" ? ruleTabRef.current : solutionTabRef.current)?.focus());
  };

  const positive = selectedRule === "desk_mate" || selectedRule === "adjacent";
  const hasOddPair = positive && selectedStudents.length > 2 && selectedStudents.length % 2 !== 0;
  const count = plannedPairCount(selectedRule, selectedStudents.length);
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const constraintBatches = [...constraints.reduce((grouped, constraint) => {
    grouped.set(constraint.batchId, [...(grouped.get(constraint.batchId) ?? []), constraint]);
    return grouped;
  }, new Map<string, SeatingConstraint[]>()).entries()].map(([batchId, items]) => ({
    batchId,
    type: items[0].type,
    count: items.length,
    names: [...new Set(items.flatMap((item) => [item.pair.a, item.pair.b]))]
      .map((studentId) => studentNames.get(studentId) ?? "未知学生")
      .join("、"),
  })).reverse();
  const recentConstraintBatches = constraintBatches.slice(0, 2);

  return (
    <aside className="inspector-panel rule-panel seating-panel seating-panel-with-dock">
      <div className="seating-panel-scroll">
      <PanelHeading
        title={activeTab === "rules" ? (hasSelectedStudents ? "规则配置" : "全局规则") : "方案生成"}
        note={activeTab === "rules"
          ? hasSelectedStudents
            ? `已选中 ${selectedStudents.length} 名学生，继续选择对象并设置关系。`
            : "查看和管理当前座位方案中的全部规则。"
          : undefined}
        toolbar={(
          <div className="seating-panel-tabs" role="tablist" aria-label="排座工作区">
            <button
              ref={solutionTabRef}
              id="seating-tab-solutions"
              type="button"
              role="tab"
              aria-selected={activeTab === "solutions"}
              aria-controls="seating-solutions-panel"
              tabIndex={activeTab === "solutions" ? 0 : -1}
              onClick={() => setActiveTab("solutions")}
              onKeyDown={handleTabKeyDown}
            >
              方案
            </button>
            <button
              ref={ruleTabRef}
              id="seating-tab-rules"
              type="button"
              role="tab"
              aria-label={`规则，已保存 ${constraintBatches.length} 组`}
              aria-selected={activeTab === "rules"}
              aria-controls="seating-rules-panel"
              tabIndex={activeTab === "rules" ? 0 : -1}
              onClick={() => setActiveTab("rules")}
              onKeyDown={handleTabKeyDown}
            >
              <span>规则</span>
              {constraintBatches.length > 0 && <span className="seating-panel-tab-count">{constraintBatches.length}</span>}
            </button>
          </div>
        )}
      />
      {activeTab === "rules" && hasSelectedStudents && (
          <section id="seating-rules-panel" className="seating-work-section seating-tab-panel" role="tabpanel" aria-labelledby="seating-tab-rules" tabIndex={0}>
        <div className="section-title-row"><h3 id="seating-rules-title">设置规则</h3><small>可选</small></div>
      <div className="selected-heading">
        <strong>已选 {selectedStudents.length} 人</strong>
        {selectedStudents.length > 0 && <button className="text-button" type="button" onClick={onClearSelection}>清除</button>}
      </div>
      <div className="student-chip-list">
        {selectedStudents.length ? selectedStudents.map((student, index) => (
          <button key={student.id} type="button" onClick={() => onRemoveSelected(student.id)} aria-label={`移出选择：${student.name}`}>
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
        {!hasRuleSelection ? <UsersRound size={18} /> : hasOddPair ? <AlertTriangle size={18} /> : <Sparkles size={18} />}
        <div>
          <strong>{!hasRuleSelection ? "再选择 1 名学生" : hasOddPair ? "还差 1 人完成配对" : `将建立 ${count} 条两两规则`}</strong>
          <span>{hasRuleSelection ? "全部按硬约束参与自动排座" : "选择完成后即可添加规则"}</span>
        </div>
      </div>

      <button className="primary-button full-width" type="button" disabled={!hasRuleSelection || hasOddPair} onClick={onAddRule}>
        添加规则
      </button>

      {constraints.length > 0 && (
        <div className="rule-generation-card">
          <Sparkles size={17} />
          <div>
            <strong>规则将在生成方案时应用</strong>
            <small>新增或删除规则后，请在“方案”页签重新生成。</small>
          </div>
        </div>
      )}

      {recentConstraintBatches.length > 0 && (
        <section className="panel-section existing-rules">
          <div className="section-title-row"><h3>最近添加</h3><small>{constraints.length} 条</small></div>
          {recentConstraintBatches.map((batch) => (
            <div className="existing-rule" key={batch.batchId}>
              <span className="rule-color-mark" />
              <div><strong>{ruleLabels[batch.type]}</strong><small>批次包含 {batch.count} 条</small></div>
              <button type="button" onClick={() => onDeleteConstraintBatch(batch.batchId)}>删除</button>
            </div>
          ))}
        </section>
      )}

      <div className={`diagnostic-strip ${conflicts.length ? "has-error" : ""}`}>
        {conflicts.length ? <AlertTriangle size={18} /> : <Check size={18} />}
        <span><strong>{conflicts.length ? `${conflicts.length} 处规则冲突` : "当前无冲突"}</strong>{conflicts[0]?.message ?? "所有硬约束可以同时成立"}</span>
      </div>
      </section>
      )}

      {activeTab === "rules" && !hasSelectedStudents && (
        <section id="seating-rules-panel" className="seating-work-section seating-tab-panel global-rules-panel" role="tabpanel" aria-labelledby="seating-tab-rules" tabIndex={0}>
          <div className="section-title-row">
            <h3>已保存规则</h3>
            <small>{constraintBatches.length} 组 · {constraints.length} 条关系</small>
          </div>
          {constraintBatches.length ? (
            <>
              <div className="global-rule-list">
                {constraintBatches.map((batch) => (
                  <article key={batch.batchId}>
                    <span className={`global-rule-mark rule-${batch.type}`} />
                    <div>
                      <strong>{ruleLabels[batch.type]}</strong>
                      <small title={batch.names}>{batch.names}</small>
                      <em>{batch.count} 条关系</em>
                    </div>
                    <button
                      type="button"
                      aria-label={`删除“${ruleLabels[batch.type]}”规则`}
                      onClick={() => onDeleteConstraintBatch(batch.batchId)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
              <div className={`diagnostic-strip global-rule-diagnostic ${conflicts.length ? "has-error" : ""}`}>
                {conflicts.length ? <AlertTriangle size={18} /> : <Check size={18} />}
                <span><strong>{conflicts.length ? `${conflicts.length} 处规则冲突` : "当前无冲突"}</strong>{conflicts[0]?.message ?? "所有硬约束可以同时成立"}</span>
              </div>
              <p className="global-rule-note">规则会在生成方案时统一应用；删除后，画布关系标记会立即同步。</p>
            </>
          ) : (
            <div className="global-rules-empty">
              <ListChecks size={25} />
              <strong>还没有已保存的规则</strong>
              <small>先在画布中选择学生，再回到这里配置关系。</small>
            </div>
          )}
        </section>
      )}

      {activeTab === "solutions" && (
      <section id="seating-solutions-panel" className="seating-work-section seating-tab-panel solution-generation-panel" role="tabpanel" aria-labelledby="seating-tab-solutions" tabIndex={0}>
        <div className="section-title-row generation-strategy-heading">
          <span className="generation-strategy-title">
            <h3 id="seating-generation-title">组合策略</h3>
            <button
              className="generation-strategy-help has-styled-tooltip"
              type="button"
              aria-label="组合策略说明：硬规则优先；随机排座会打乱座位，成绩均匀会平衡区域成绩，小组均衡会综合成绩和身高，身高模式会让低个靠前高个靠后，标签策略会让视力关注学生靠前并将组长候选和学科优势学生均匀分组，男女分坐会优先安排同性同桌，防早恋模式会分散高关注异性组合"
            >
              <CircleHelp size={15} strokeWidth={1.8} />
              <StyledTooltip
                label="系统策略规则"
                description="硬规则始终优先。随机排座会打乱座位；成绩均匀会平衡区域成绩；小组均衡会综合成绩与身高；身高模式让低个靠前、高个靠后；标签策略让“视力关注”优先靠前，并将“组长候选”和各学科优势均匀分到大组；男女分坐优先安排同性同桌；防早恋模式会分散高关注异性组合。"
                side="bottom"
              />
            </button>
          </span>
          <small>可多选</small>
        </div>
        <div className="algorithm-list">
          {algorithmOptions.map((option) => {
            const selected = algorithms.includes(option.id);
            const unavailable = (option.id === "romance_guard" || option.id === "gender_separated") && hasMissingGender;
            return (
              <div className="algorithm-option" key={option.id}>
                <button
                  aria-pressed={selected}
                  className={`algorithm-choice ${selected ? "is-selected" : ""} ${unavailable ? "is-unavailable" : ""} ${option.id === "tag_balanced" ? "has-inline-help" : ""}`}
                  disabled={unavailable}
                  type="button"
                  onClick={() => onAlgorithmToggle(option.id)}
                >
                  <span className="algorithm-check">{selected && <Check size={10} strokeWidth={2.5} />}</span>
                  <span><strong>{option.name}</strong><small>{unavailable ? "学生信息无性别，请用模板重新补充学生信息" : option.note}</small></span>
                </button>
                {option.id === "tag_balanced" && (
                  <button
                    className="algorithm-tag-help has-styled-tooltip"
                    type="button"
                    aria-label="标签策略说明：只读取系统标签。视力关注学生优先靠前，组长候选和各学科优势学生尽量均匀分到各大组。可在名单中编辑学生、右键学生，或导入同名标签进行设置；自定义标签不参与排座。"
                  >
                    <CircleHelp size={16} strokeWidth={2} aria-hidden="true" />
                    <StyledTooltip
                      label="标签策略如何工作"
                      description="只读取系统标签：“视力关注”优先靠前；“组长候选”和语文、数学、英语、物理、化学、生物优势尽量均匀分到各大组。可在名单中编辑学生、右键学生，或导入同名标签进行设置。手动输入的自定义标签仅用于记录和检索，不参与排座。"
                      side="bottom"
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
      </section>
      )}
      </div>
      {(activeTab === "solutions" || simpleMode) && <div className={`seating-generate-dock ${simpleMode ? "is-simple" : ""}`}>
        <button className={`${simpleMode ? "secondary-button" : "primary-button"} full-width generate-button seating-generate-button`} type="button" onClick={onGenerate}><Sparkles size={18} />{hasGeneratedPlan ? "重新生成方案" : "生成方案"}</button>
        {simpleMode && (
          <button
            className="primary-button full-width generate-button seating-confirm-export-button"
            type="button"
            title={hasGeneratedPlan ? "确认当前预览方案并选择导出格式" : "确认当前座位并选择导出格式"}
            onClick={onConfirmAndExport}
          >
            <Download size={18} />确认方案并导出
          </button>
        )}
      </div>}
    </aside>
  );
}

type ExportFormat = "xlsx" | "png" | "pdf";

interface ExportPanelProps {
  format: ExportFormat;
  showGender: boolean;
  showStudentNo: boolean;
  showGroupBoundaries: boolean;
  fileName: string;
  theme: "paper" | "ink";
  appTheme: "minimal" | "cute";
  variant: ExportVariant;
  onFormatChange: (format: ExportFormat) => void;
  onShowGenderChange: (value: boolean) => void;
  onShowStudentNoChange: (value: boolean) => void;
  onShowGroupBoundariesChange: (value: boolean) => void;
  onFileNameChange: (value: string) => void;
  onThemeChange: (value: "paper" | "ink") => void;
  onVariantChange: (variant: ExportVariant) => void;
  onExport: () => void;
  onBack?: () => void;
}

const formats: { id: ExportFormat; label: string; icon: typeof FileText }[] = [
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "png", label: "PNG", icon: FileImage },
  { id: "pdf", label: "PDF", icon: FileText },
];

export function ExportPanel({
  format,
  showGender,
  showStudentNo,
  showGroupBoundaries,
  fileName,
  theme,
  appTheme,
  variant,
  onFormatChange,
  onShowGenderChange,
  onShowStudentNoChange,
  onShowGroupBoundariesChange,
  onFileNameChange,
  onThemeChange,
  onVariantChange,
  onExport,
  onBack,
}: ExportPanelProps) {
  const isVisualFormat = format !== "xlsx";

  return (
    <aside className="inspector-panel">
      <PanelHeading
        eyebrow="打印与分享"
        title="导出座次"
        note={isVisualFormat ? "PDF 与 PNG 均提供普通版和精简版。" : "Excel 使用表格式版式预览。"}
        toolbar={onBack ? <button className="text-button export-back-button" type="button" onClick={onBack}><ArrowLeft size={14} />返回排座</button> : undefined}
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
      {isVisualFormat ? (
        <>
          <section className="panel-section">
            <h3>导出版式</h3>
            <div className="export-variant-options" role="group" aria-label="导出版式">
              <button className={variant === "standard" ? "is-selected" : ""} type="button" onClick={() => onVariantChange("standard")}>
                <strong>普通版</strong><small>保留当前画布视角与配色</small>
              </button>
              <button className={variant === "compact" ? "is-selected" : ""} type="button" onClick={() => onVariantChange("compact")}>
                <strong>精简版</strong><small>纯白底，仅保留座次信息</small>
              </button>
            </div>
            <div className="export-mode-note">
              <MonitorUp size={18} />
              <span><strong>{variant === "standard" ? "导出当前画面" : "生成精简座次表"}</strong><small>{variant === "standard" ? "座位、背景、配色和画布视角都会保留。" : "自动居中座位并放大姓名，适合直接打印。"}</small></span>
            </div>
            {variant === "standard" && appTheme === "cute" && (
              <div className="color-print-note" role="note">
                <Palette size={18} />
                <span><strong>建议使用彩色打印</strong><small>可爱风含浅色背景，灰度打印容易让画面层次发糊。</small></span>
              </div>
            )}
          </section>
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
      <label className="file-name-field"><span>文件名</span><input value={fileName} onChange={(event) => onFileNameChange(event.target.value)} /><small>{isVisualFormat ? `_${variant === "compact" ? "精简版" : "普通版"}` : ""}.{format}</small></label>
      <div className="panel-footer">
        <button className="primary-button full-width" type="button" onClick={onExport}>
          <Download size={18} />{isVisualFormat ? `导出${variant === "compact" ? "精简版" : "普通版"}` : "导出 Excel"}
        </button>
      </div>
    </aside>
  );
}

function PanelHeading({ eyebrow, title, note, toolbar }: { eyebrow?: string; title: string; note?: string; toolbar?: ReactNode }) {
  return (
    <header className={`panel-heading ${!eyebrow && toolbar ? "has-toolbar-only" : ""} ${note ? "has-note" : "is-compact"}`}>
      <div className={`panel-heading-top ${!eyebrow ? "is-toolbar-only" : ""}`}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {toolbar}
      </div>
      <h2>{title}</h2>
      {note && <p>{note}</p>}
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
