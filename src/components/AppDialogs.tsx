import { Check, Copy, Eraser, Info, Layers3, ListChecks, ListRestart, LockKeyhole, School, SlidersHorizontal, Trash2, UserRoundPlus, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ruleLabels } from "../domain/rules";
import type { GenerationWeights, LayoutConfig, SeatingCandidate, SeatingConstraint, Student } from "../types";

interface DialogFrameProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

function DialogFrame({ eyebrow, title, children, footer, onClose }: DialogFrameProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      if (!dialogRef.current?.contains(document.activeElement)) {
        dialogRef.current?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="modal interaction-dialog" role="dialog" aria-modal="true" aria-labelledby="interaction-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
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
  const [errors, setErrors] = useState<Partial<Record<"name" | "gender" | "className", string>>>({});

  const clearFieldError = (field: "name" | "gender" | "className") => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.name.trim()) nextErrors.name = "请输入学生姓名";
    if (!draft.gender) nextErrors.gender = "请选择学生性别";
    if (!draft.className.trim()) nextErrors.className = "请输入班级名称";
    setErrors(nextErrors);
    const firstInvalidField = (["name", "gender", "className"] as const).find((field) => nextErrors[field]);
    if (firstInvalidField) {
      window.requestAnimationFrame(() => document.getElementById(`student-${firstInvalidField}`)?.focus());
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
      <form id="student-editor-form" className="editor-form" onSubmit={submit} noValidate>
        <div className="dialog-intro"><UserRoundPlus size={20} /><span>姓名、性别和班级是排座所需的基础信息。</span></div>
        {Object.keys(errors).length > 0 && <p className="visually-hidden" role="alert">请完善 {Object.keys(errors).length} 个必填项</p>}
        <div className="editor-grid">
          <label>
            <span>姓名 *</span>
            <input id="student-name" name="name" autoFocus value={draft.name} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "student-name-error" : undefined} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); clearFieldError("name"); }} />
            {errors.name && <small className="field-error" id="student-name-error">{errors.name}</small>}
          </label>
          <label>
            <span>性别 *</span>
            <select id="student-gender" name="gender" value={draft.gender} aria-invalid={Boolean(errors.gender)} aria-describedby={errors.gender ? "student-gender-error" : undefined} onChange={(event) => { setDraft((current) => ({ ...current, gender: event.target.value as Student["gender"] })); clearFieldError("gender"); }}><option value="男">男</option><option value="女">女</option></select>
            {errors.gender && <small className="field-error" id="student-gender-error">{errors.gender}</small>}
          </label>
          <label>
            <span>班级 *</span>
            <input id="student-className" name="className" value={draft.className} aria-invalid={Boolean(errors.className)} aria-describedby={errors.className ? "student-className-error" : undefined} onChange={(event) => { setDraft((current) => ({ ...current, className: event.target.value })); clearFieldError("className"); }} />
            {errors.className && <small className="field-error" id="student-className-error">{errors.className}</small>}
          </label>
          <label><span>学号<small className="field-label-note">（选填）</small></span><input name="studentNo" value={draft.studentNo ?? ""} onChange={(event) => setDraft((current) => ({ ...current, studentNo: event.target.value }))} /></label>
          <label><span>成绩<small className="field-label-note">（选填）</small></span><input name="score" min="0" max="750" type="number" value={draft.score ?? ""} onChange={(event) => setDraft((current) => ({ ...current, score: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label><span>身高（cm）<small className="field-label-note">（选填）</small></span><input name="height" min="100" max="220" type="number" value={draft.height ?? ""} onChange={(event) => setDraft((current) => ({ ...current, height: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label className="span-two"><span>标签<small className="field-label-note">（选填）</small></span><input name="tags" placeholder="例如：组长候选" value={draft.tags?.[0] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value ? [event.target.value] : [] }))} /></label>
        </div>
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

export function ApplyCandidateDialog({ candidate, onClose, onConfirm }: {
  candidate: SeatingCandidate;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const violationCount = candidate.metrics?.hardRuleViolations ?? 0;
  return (
    <DialogFrame
      eyebrow="APPLY PLAN"
      title="应用当前方案？"
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={onConfirm}><Check size={16} />确认应用</button></>}
    >
      <div className={`apply-candidate-confirmation ${violationCount > 0 ? "has-warning" : ""}`}>
        <span aria-hidden="true"><Check size={22} /></span>
        <div>
          <strong>{candidate.label} · {candidate.score} 分</strong>
          <p>将当前预览应用为正式座位安排。应用后仍可使用“撤销”恢复。</p>
        </div>
      </div>
      {violationCount > 0 && <p className="apply-candidate-warning" role="note">当前方案仍有 {violationCount} 条硬规则未满足，请确认后再应用。</p>}
    </DialogFrame>
  );
}

export function StudentRuleDialog({ student, students, constraints, onClose }: {
  student: Student;
  students: Student[];
  constraints: SeatingConstraint[];
  onClose: () => void;
}) {
  const studentNames = new Map(students.map((item) => [item.id, item.name]));
  const relatedRules = constraints.filter((constraint) => (
    constraint.pair.a === student.id || constraint.pair.b === student.id
  ));

  return (
    <DialogFrame
      eyebrow="SEATING RULES"
      title={`${student.name}的排座规则`}
      onClose={onClose}
      footer={<button className="primary-button" type="button" onClick={onClose}>关闭规则</button>}
    >
      <div className="dialog-intro"><ListChecks size={20} /><span>座位左侧的深色“规”标记表示该学生参与了硬规则。</span></div>
      <div className="student-rule-dialog-list">
        {relatedRules.map((constraint) => {
          const peerId = constraint.pair.a === student.id ? constraint.pair.b : constraint.pair.a;
          return (
            <article key={constraint.id}>
              <span className="student-rule-dialog-mark" aria-hidden="true">规</span>
              <div><strong>{ruleLabels[constraint.type]}</strong><small>与 {studentNames.get(peerId) ?? "未知学生"}</small></div>
              <em>硬规则</em>
            </article>
          );
        })}
      </div>
    </DialogFrame>
  );
}

export function CreateClassDialog({ existingNames, onClose, onCreate }: {
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError("请输入班级名称");
      return;
    }
    if (existingNames.includes(normalized)) {
      setError("这个班级已经存在，请换一个名称");
      return;
    }
    onCreate(normalized);
  };
  return (
    <DialogFrame
      eyebrow="NEW CLASS"
      title="新建班级"
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" form="create-class-form"><School size={16} />创建班级</button></>}
    >
      <form id="create-class-form" className="workspace-dialog-form" onSubmit={submit}>
        <div className="dialog-intro"><School size={20} /><span>新班级会从一份空名单和标准 48 座布局开始。</span></div>
        <label className="workspace-name-field">
          <span>班级名称</span>
          <input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="例如：高二（5）班" aria-invalid={Boolean(error)} aria-describedby={error ? "create-class-error" : undefined} />
        </label>
        {error && <p className="form-error" id="create-class-error" role="alert">{error}</p>}
      </form>
    </DialogFrame>
  );
}

export type VersionCopyMode = "current" | "clean";

export function CreateVersionDialog({ existingNames, currentVersion, onClose, onCreate }: {
  existingNames: string[];
  currentVersion: string;
  onClose: () => void;
  onCreate: (name: string, mode: VersionCopyMode) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<VersionCopyMode>("current");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError("请输入版本名称");
      return;
    }
    if (existingNames.includes(normalized)) {
      setError("这个版本已经存在，请换一个名称");
      return;
    }
    onCreate(normalized, mode);
  };
  return (
    <DialogFrame
      eyebrow="NEW VERSION"
      title="新建座位版本"
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" form="create-version-form"><Layers3 size={16} />创建版本</button></>}
    >
      <form id="create-version-form" className="workspace-dialog-form" onSubmit={submit}>
        <div className="dialog-intro"><Layers3 size={20} /><span>新版本归属于当前班级，创建后会自动切换过去。</span></div>
        <label className="workspace-name-field">
          <span>版本名称</span>
          <input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="例如：日常换位 · 第5期" aria-invalid={Boolean(error)} aria-describedby={error ? "create-version-error" : undefined} />
        </label>
        {error && <p className="form-error" id="create-version-error" role="alert">{error}</p>}
        <fieldset className="version-copy-options">
          <legend>从哪里开始</legend>
          <label className={mode === "current" ? "is-selected" : ""}>
            <input type="radio" name="version-copy-mode" value="current" checked={mode === "current"} onChange={() => setMode("current")} />
            <Copy size={18} /><span><strong>复制当前版本</strong><small>保留“{currentVersion}”的名单、规则和座位</small></span><Check size={16} className="version-option-check" />
          </label>
          <label className={mode === "clean" ? "is-selected" : ""}>
            <input type="radio" name="version-copy-mode" value="clean" checked={mode === "clean"} onChange={() => setMode("clean")} />
            <ListRestart size={18} /><span><strong>保留名单与布局</strong><small>清空座位安排和规则，重新排座</small></span><Check size={16} className="version-option-check" />
          </label>
        </fieldset>
      </form>
    </DialogFrame>
  );
}

export function ClearClassDialog({ className, versionName, studentCount, onClose, onConfirm }: {
  className: string;
  versionName: string;
  studentCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogFrame
      eyebrow="CLEAR ROSTER"
      title={`清空${className}名单`}
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="danger-button" type="button" onClick={onConfirm}><Eraser size={16} />清空名单</button></>}
    >
      <div className="clear-class-warning">
        <span aria-hidden="true"><Eraser size={23} /></span>
        <div><strong>将从“{versionName}”移除 {studentCount} 名学生</strong><p>座位安排和规则会同时清空，教室布局会保留。完成后仍可立即使用“撤销”恢复。</p></div>
      </div>
    </DialogFrame>
  );
}

export function DeleteWorkspaceDialog({ kind, name, versionCount = 0, onClose, onConfirm }: {
  kind: "class" | "version";
  name: string;
  versionCount?: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isClass = kind === "class";
  return (
    <DialogFrame
      eyebrow={isClass ? "DELETE CLASS" : "DELETE VERSION"}
      title={`删除${isClass ? "班级" : "座位版本"}`}
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="danger-button" type="button" onClick={onConfirm}><Trash2 size={16} />确认删除</button></>}
    >
      <div className="clear-class-warning delete-workspace-warning">
        <span aria-hidden="true"><Trash2 size={23} /></span>
        <div>
          <strong>确定删除“{name}”吗？</strong>
          <p>{isClass
            ? `该班级的名单、规则、座位安排以及 ${versionCount} 个座位版本都会从本机删除。`
            : "该版本的规则和座位安排会从本机删除，其他版本不受影响。"} 此操作无法撤销。</p>
        </div>
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
