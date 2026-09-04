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
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { algorithmOptions } from "../data/mockData";
import { layoutPresets } from "../domain/layoutPresets";
import { plannedPairCount, ruleLabels } from "../domain/rules";
import type {
  ConstraintType,
  DoorPlacement,
  GuardianSide,
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
  doorPlacements: DoorPlacement[];
  guardianSides: GuardianSide[];
  disabledSeatCount: number;
  groups: number;
  rows: number;
  seatsPerDesk: 1 | 2;
  aisleWidth: number;
  onPresetChange: (preset: LayoutPresetId) => void;
  onDoorPlacementToggle: (placement: DoorPlacement) => void;
  onGuardianToggle: (side: GuardianSide) => void;
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
  guardianSides,
  disabledSeatCount,
  groups,
  rows,
  seatsPerDesk,
  aisleWidth,
  onPresetChange,
  onDoorPlacementToggle,
  onGuardianToggle,
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
      <section className="panel-section guardian-section">
        <div className="section-title-row"><h3>讲台护法座</h3><small>可选普通座位</small></div>
        <div className="guardian-options">
          {(["left", "right"] as const).map((side) => {
            const selected = guardianSides.includes(side);
            return (
              <button
                aria-pressed={selected}
                className={selected ? "is-selected" : ""}
                key={side}
                type="button"
                onClick={() => onGuardianToggle(side)}
              >
                <UsersRound size={17} />
                <span><strong>{side === "left" ? "左护法" : "右护法"}</strong><small>讲台{side === "left" ? "左" : "右"}侧</small></span>
                {selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
        <p className="guardian-note">计入可用座位，可正常入座、换位、禁用与导出。</p>
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
  separateGenders: boolean;
  weights: {
    score: number;
    height: number;
    appearance: number;
  };
  onAlgorithmToggle: (algorithm: GenerationStrategy) => void;
  onSeparateGendersChange: (value: boolean) => void;
  onWeightChange: (key: "score" | "height" | "appearance", value: number) => void;
  onGenerate: () => void;
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
  separateGenders,
  weights,
  onAlgorithmToggle,
  onSeparateGendersChange,
  onWeightChange,
  onGenerate,
}: SeatingPanelProps) {
  const hasRuleSelection = selectedStudents.length >= 2;
  const [activeTab, setActiveTab] = useState<"rules" | "solutions">(() => hasRuleSelection ? "rules" : "solutions");
  const wasMultiSelectionRef = useRef(hasRuleSelection);
  const ruleTabRef = useRef<HTMLButtonElement>(null);
  const solutionTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasRuleSelection && !wasMultiSelectionRef.current) setActiveTab("rules");
    if (!hasRuleSelection && activeTab === "rules") setActiveTab("solutions");
    wasMultiSelectionRef.current = hasRuleSelection;
  }, [activeTab, hasRuleSelection]);

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!hasRuleSelection) return;
    let nextTab: "rules" | "solutions" | undefined;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") nextTab = "rules";
    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End") nextTab = "solutions";
    if (!nextTab) return;
    event.preventDefault();
    setActiveTab(nextTab);
    requestAnimationFrame(() => (nextTab === "rules" ? ruleTabRef.current : solutionTabRef.current)?.focus());
  };

  if (selectedStudents.length === 1) {
    const student = selectedStudents[0];
    const studentNames = new Map(students.map((item) => [item.id, item.name]));
    const relatedRules = constraints.filter((constraint) => (
      constraint.pair.a === student.id || constraint.pair.b === student.id
    ));
    const details = [
      ["性别", student.gender],
      ["班级", student.className],
      ["学号", student.studentNo || "未填写"],
      ["成绩", student.score ?? "未填写"],
      ["身高", student.height ? `${student.height} cm` : "未填写"],
      ["颜值", student.appearance ?? "未填写"],
    ];

    return (
      <aside className="inspector-panel seating-panel student-inspector-panel">
        <PanelHeading eyebrow="学生信息" title={student.name} note="当前选中 1 名学生；继续选择其他学生后进入规则配置。" />
        <div className="student-profile-card">
          <span aria-hidden="true">{student.name.slice(0, 1)}</span>
          <div><strong>{student.name}</strong><small>{student.className} · {student.gender}</small></div>
          <button className="text-button" type="button" onClick={onClearSelection}>取消选择</button>
        </div>
        <section className="panel-section student-detail-section" aria-labelledby="student-basic-title">
          <div className="section-title-row"><h3 id="student-basic-title">基本信息</h3><small>名单资料</small></div>
          <dl className="student-detail-grid">
            {details.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>
        <section className="panel-section student-detail-section" aria-labelledby="student-tags-title">
          <div className="section-title-row"><h3 id="student-tags-title">标签与备注</h3></div>
          <div className="student-detail-tags">
            {student.tags?.length ? student.tags.map((tag) => <span key={tag}>{tag}</span>) : <small>暂无标签</small>}
          </div>
          {student.notes && <p className="student-detail-note">{student.notes}</p>}
        </section>
        <section className="panel-section student-detail-section" aria-labelledby="student-rules-title">
          <div className="section-title-row"><h3 id="student-rules-title">关联规则</h3><small>{relatedRules.length} 条</small></div>
          {relatedRules.length ? (
            <div className="student-related-rules">
              {relatedRules.map((constraint) => {
                const peerId = constraint.pair.a === student.id ? constraint.pair.b : constraint.pair.a;
                return (
                  <div key={constraint.id}>
                    <span aria-hidden="true">规</span>
                    <strong>{ruleLabels[constraint.type]}</strong>
                    <small>与 {studentNames.get(peerId) ?? "未知学生"}</small>
                  </div>
                );
              })}
            </div>
          ) : <p className="student-detail-empty">该学生暂未设置排座规则。</p>}
        </section>
        <div className="student-multi-select-hint"><UsersRound size={17} /><span><strong>需要设置规则？</strong>在画布中再选择至少 1 名学生。</span></div>
      </aside>
    );
  }

  const positive = selectedRule === "desk_mate" || selectedRule === "adjacent";
  const hasOddPair = positive && selectedStudents.length > 2 && selectedStudents.length % 2 !== 0;
  const count = plannedPairCount(selectedRule, selectedStudents.length);
  const groupedConstraints = [...new Map(constraints.map((item) => [item.batchId, item])).values()].slice(-2).reverse();

  return (
    <aside className="inspector-panel rule-panel seating-panel seating-panel-with-dock">
      <div className="seating-panel-scroll">
      <PanelHeading
        eyebrow="排座工作台"
        title={activeTab === "rules" ? "规则配置" : "方案生成"}
        note={activeTab === "rules" ? "为已选学生建立排座约束。" : "组合策略和数据权重，生成候选方案。"}
        toolbar={(
          <div className="seating-panel-tabs" role="tablist" aria-label="排座工作区">
            <button
              ref={ruleTabRef}
              id="seating-tab-rules"
              type="button"
              role="tab"
              aria-selected={activeTab === "rules"}
              aria-controls="seating-rules-panel"
              aria-disabled={!hasRuleSelection}
              tabIndex={activeTab === "rules" ? 0 : -1}
              title={hasRuleSelection ? undefined : "选择至少两名学生后可设置规则"}
              onClick={() => {
                if (hasRuleSelection) setActiveTab("rules");
              }}
              onKeyDown={handleTabKeyDown}
            >
              规则
            </button>
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
          </div>
        )}
      />
      {activeTab === "rules" && hasRuleSelection && (
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
        <div className="rule-generation-card">
          <Sparkles size={17} />
          <div>
            <strong>规则将在生成方案时应用</strong>
            <small>新增或删除规则后，请在“方案”页签重新生成。</small>
          </div>
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
      </section>
      )}

      {activeTab === "solutions" && (
      <section id="seating-solutions-panel" className="seating-work-section seating-tab-panel" role="tabpanel" aria-labelledby="seating-tab-solutions" tabIndex={0}>
        <div className="section-title-row"><h3 id="seating-generation-title">生成方案</h3><small>比较 3 个候选</small></div>
        <p className="section-note">生成时先满足已保存的硬规则，再按数据权重比较班级分布。</p>
        <div className="section-title-row generation-strategy-heading"><h3>组合策略</h3><small>可多选</small></div>
        <div className="algorithm-list">
          {algorithmOptions.map((option) => {
            const selected = algorithms.includes(option.id);
            return (
              <button aria-pressed={selected} className={selected ? "is-selected" : ""} key={option.id} type="button" onClick={() => onAlgorithmToggle(option.id)}>
                <span className="algorithm-check">{selected && <Check size={10} strokeWidth={2.5} />}</span>
                <span><strong>{option.name}</strong><small>{option.note}</small></span>
              </button>
            );
          })}
        </div>
        <label className="toggle-row generation-gender-toggle">
          <span className="generation-toggle-copy"><strong>男女分坐</strong><small>优先安排同性同桌，人数不均时保留最少混排</small></span>
          <input type="checkbox" checked={separateGenders} onChange={(event) => onSeparateGendersChange(event.target.checked)} />
          <span className="toggle-track" />
        </label>
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
      {activeTab === "solutions" && <div className="seating-generate-dock">
        <button className="primary-button full-width generate-button seating-generate-button" type="button" onClick={onGenerate}><Sparkles size={18} />生成 3 个方案</button>
      </div>}
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

function PanelHeading({ eyebrow, title, note, toolbar }: { eyebrow: string; title: string; note: string; toolbar?: ReactNode }) {
  return (
    <header className="panel-heading">
      <div className="panel-heading-top">
        <span className="eyebrow">{eyebrow}</span>
        {toolbar}
      </div>
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
