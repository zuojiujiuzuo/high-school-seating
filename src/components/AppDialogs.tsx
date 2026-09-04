import { Check, Info, LockKeyhole, SlidersHorizontal, UserRoundPlus, UsersRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { GenerationWeights, LayoutConfig, SeatingCandidate, Student } from "../types";

interface DialogFrameProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

function DialogFrame({ eyebrow, title, children, footer, onClose }: DialogFrameProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal interaction-dialog" role="dialog" aria-modal="true" aria-labelledby="interaction-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div><span className="eyebrow">{eyebrow}</span><h2 id="interaction-dialog-title">{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={`关闭${title}`}><X size={19} /></button>
        </header>
        <div className="interaction-dialog-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}

interface StudentEditorDialogProps {
  student?: Student;
  defaultClassName: string;
  onClose: () => void;
  onSave: (student: Student) => void;
}

export function StudentEditorDialog({ student, defaultClassName, onClose, onSave }: StudentEditorDialogProps) {
  const [draft, setDraft] = useState<Student>(() => student ?? {
    id: "",
    name: "",
    gender: "男",
    className: defaultClassName,
    studentNo: "",
    score: undefined,
    height: undefined,
    tags: [],
  });
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("请输入学生姓名");
      return;
    }
    if (!draft.className.trim()) {
      setError("请输入班级名称");
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      className: draft.className.trim(),
      studentNo: draft.studentNo?.trim() || undefined,
      tags: draft.tags?.filter(Boolean),
    });
  };

  return (
    <DialogFrame
      eyebrow={student ? "EDIT STUDENT" : "ADD STUDENT"}
      title={student ? `编辑 ${student.name}` : "手动添加学生"}
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" form="student-editor-form"><Check size={16} />保存学生</button></>}
    >
      <form id="student-editor-form" className="editor-form" onSubmit={submit}>
        <div className="dialog-intro"><UserRoundPlus size={20} /><span>姓名、性别和班级是排座所需的基础信息。</span></div>
        <div className="editor-grid">
          <label><span>姓名 *</span><input autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label><span>性别 *</span><select value={draft.gender} onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value as Student["gender"] }))}><option value="男">男</option><option value="女">女</option></select></label>
          <label><span>班级 *</span><input value={draft.className} onChange={(event) => setDraft((current) => ({ ...current, className: event.target.value }))} /></label>
          <label><span>学号</span><input value={draft.studentNo ?? ""} onChange={(event) => setDraft((current) => ({ ...current, studentNo: event.target.value }))} /></label>
          <label><span>成绩</span><input min="0" max="750" type="number" value={draft.score ?? ""} onChange={(event) => setDraft((current) => ({ ...current, score: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label><span>身高（cm）</span><input min="100" max="220" type="number" value={draft.height ?? ""} onChange={(event) => setDraft((current) => ({ ...current, height: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label className="span-two"><span>标签</span><input placeholder="例如：组长候选" value={draft.tags?.[0] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value ? [event.target.value] : [] }))} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </DialogFrame>
  );
}

export interface StudentBulkPatch {
  tag?: string;
  clearTags?: boolean;
  score?: number;
  height?: number;
}

export function StudentBatchDialog({ count, onClose, onSave }: { count: number; onClose: () => void; onSave: (patch: StudentBulkPatch) => void }) {
  const [tag, setTag] = useState("");
  const [clearTags, setClearTags] = useState(false);
  const [score, setScore] = useState("");
  const [height, setHeight] = useState("");
  return (
    <DialogFrame
      eyebrow="BATCH EDIT"
      title={`批量编辑 ${count} 名学生`}
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={() => onSave({ tag: tag.trim() || undefined, clearTags, score: score ? Number(score) : undefined, height: height ? Number(height) : undefined })}>应用修改</button></>}
    >
      <div className="dialog-intro"><UsersRound size={20} /><span>留空的字段不会覆盖原值。修改会作为一次操作加入撤销历史。</span></div>
      <div className="editor-grid">
        <label className="span-two"><span>统一标签</span><input disabled={clearTags} value={tag} onChange={(event) => setTag(event.target.value)} placeholder="例如：靠前安排" /></label>
        <label><span>统一成绩</span><input type="number" min="0" max="750" value={score} onChange={(event) => setScore(event.target.value)} /></label>
        <label><span>统一身高</span><input type="number" min="100" max="220" value={height} onChange={(event) => setHeight(event.target.value)} /></label>
        <label className="check-field span-two"><input type="checkbox" checked={clearTags} onChange={(event) => setClearTags(event.target.checked)} /><span>清除已选学生的所有标签</span></label>
      </div>
    </DialogFrame>
  );
}

export function AdvancedLayoutDialog({ config, aisleWidth, onClose, onSave }: { config: LayoutConfig; aisleWidth: number; onClose: () => void; onSave: (config: LayoutConfig, aisleWidth: number) => void }) {
  const [draft, setDraft] = useState(config);
  const [aisle, setAisle] = useState(Math.round(aisleWidth));
  return (
    <DialogFrame
      eyebrow="LAYOUT GRID"
      title="高级编辑教室网格"
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={() => onSave(draft, aisle)}>应用到画布</button></>}
    >
      <div className="dialog-intro"><SlidersHorizontal size={20} /><span>座位容量会随参数实时重新计算，已有学生按当前顺序迁移。</span></div>
      <div className="editor-grid">
        <label><span>大组数量</span><input type="number" min="1" max="8" value={draft.groups} onChange={(event) => setDraft((current) => ({ ...current, groups: Math.max(1, Math.min(8, Number(event.target.value))) }))} /></label>
        <label><span>每组排数</span><input type="number" min="1" max="12" value={draft.rows} onChange={(event) => setDraft((current) => ({ ...current, rows: Math.max(1, Math.min(12, Number(event.target.value))) }))} /></label>
        <label><span>每桌人数</span><select value={draft.columns} onChange={(event) => setDraft((current) => ({ ...current, columns: Number(event.target.value) as 1 | 2 }))}><option value="1">1 人</option><option value="2">2 人</option></select></label>
        <label><span>等宽走廊（px）</span><input type="number" min="36" max="110" value={aisle} onChange={(event) => setAisle(Math.max(36, Math.min(110, Number(event.target.value))))} /></label>
      </div>
      <div className="layout-capacity"><strong>{draft.groups * draft.rows * draft.columns}</strong><span>个座位</span></div>
    </DialogFrame>
  );
}

export function CandidateInfoDialog({ candidates, weights, onClose }: { candidates: SeatingCandidate[]; weights: GenerationWeights; onClose: () => void }) {
  return (
    <DialogFrame eyebrow="SCORING" title="候选方案评分说明" onClose={onClose} footer={<button className="primary-button" type="button" onClick={onClose}>知道了</button>}>
      <div className="dialog-intro"><Info size={20} /><span>先扣除未满足的硬规则，再按当前数据权重比较班级分布。</span></div>
      <div className="score-weight-summary"><span>成绩 {weights.score}%</span><span>身高 {weights.height}%</span><span>综合 {weights.appearance}%</span></div>
      <div className="candidate-detail-list">
        {candidates.map((candidate) => (
          <div key={candidate.id}><strong>{candidate.label}<b>{candidate.score} 分</b></strong><span>平衡度 {candidate.metrics?.balanceScore ?? "—"} · 未满足硬规则 {candidate.metrics?.hardRuleViolations ?? 0} 条</span></div>
        ))}
      </div>
    </DialogFrame>
  );
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div><LockKeyhole size={34} /><h2 id="lock-title">班阵已自动锁定</h2><p>离开窗口后，学生信息已被遮挡。</p><button className="primary-button" type="button" onClick={onUnlock}>返回工作台</button></div>
    </div>
  );
}
