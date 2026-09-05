import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, Copy, Eraser, Layers3, ListChecks, ListRestart, LockKeyhole, PencilLine, RotateCcw, School, Search, SlidersHorizontal, Trash2, UserRoundPlus, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { DataBackupSummary } from "../data/dataBackup";
import { ruleLabels } from "../domain/rules";
import { SCORE_GRADES } from "../domain/scoreGrades";
import { nextStudentTableSort, sortStudentsForTable, type StudentTableSort, type StudentTableSortKey } from "../domain/studentTableSort";
import { isSystemStudentTag, systemStudentTagGroups, systemStudentTags } from "../domain/studentTags";
import type { LayoutConfig, ScoreGrade, SeatingCandidate, SeatingConstraint, Student } from "../types";

interface DialogFrameProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClose: () => void;
}

interface DialogSelectOption<T extends string> {
  value: T;
  label: string;
}

export function DialogSelect<T extends string>({ id, label, value, options, className = "", placeholder = "请选择", invalid = false, onChange }: {
  id: string;
  label: string;
  value: T;
  options: readonly DialogSelectOption<T>[];
  className?: string;
  placeholder?: string;
  invalid?: boolean;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const listboxId = `${id}-options`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const focusOption = (index: number) => {
    const normalizedIndex = (index + options.length) % options.length;
    setOpen(true);
    window.requestAnimationFrame(() => {
      rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']")[normalizedIndex]?.focus();
    });
  };

  const choose = (option: DialogSelectOption<T>) => {
    onChange(option.value);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={rootRef} className={`dialog-select ${className}${open ? " is-open" : ""}`.trim()}>
      <button
        ref={triggerRef}
        id={id}
        className="dialog-select-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusOption(event.key === "ArrowDown" ? activeIndex : activeIndex - 1);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <span className={selectedOption ? "" : "dialog-select-placeholder"}>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={listboxId} className="dialog-select-menu" role="listbox" aria-label={label}>
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                className={selected ? "is-selected" : ""}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={index === activeIndex ? 0 : -1}
                key={option.value}
                onClick={() => choose(option)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    focusOption(index + (event.key === "ArrowDown" ? 1 : -1));
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    focusOption(event.key === "Home" ? 0 : options.length - 1);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    triggerRef.current?.focus();
                  } else if (event.key === "Tab") {
                    setOpen(false);
                  }
                }}
              >
                <span className="dialog-select-check" aria-hidden="true">{selected && <Check size={15} strokeWidth={2.4} />}</span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const scoreGradeOptions = SCORE_GRADES.map((grade) => ({ value: grade, label: grade }));

function DialogFrame({ eyebrow, title, children, footer, className = "", onClose }: DialogFrameProps) {
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
      <section ref={dialogRef} className={`modal interaction-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="interaction-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
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

function parseStudentTags(value: string) {
  return value.split(/[，,、;；]/).map((tag) => tag.trim()).filter(Boolean);
}

function uniqueStudentTags(tags: readonly string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
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
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"name" | "gender" | "className", string>>>({});

  const toggleTag = (tag: string) => {
    setDraft((current) => ({
      ...current,
      tags: current.tags?.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : uniqueStudentTags([...(current.tags ?? []), tag]),
    }));
  };

  const addCustomTags = () => {
    const tags = parseStudentTags(tagInput);
    if (!tags.length) return;
    setDraft((current) => ({ ...current, tags: uniqueStudentTags([...(current.tags ?? []), ...tags]) }));
    setTagInput("");
  };

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
    if (!draft.gender || draft.gender === "未填写") nextErrors.gender = "请选择学生性别";
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
      tags: uniqueStudentTags([...(draft.tags ?? []), ...parseStudentTags(tagInput)]),
    });
  };

  const customTags = (draft.tags ?? []).filter((tag) => !isSystemStudentTag(tag));

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
            <select id="student-gender" name="gender" value={draft.gender} aria-invalid={Boolean(errors.gender)} aria-describedby={errors.gender ? "student-gender-error" : undefined} onChange={(event) => { setDraft((current) => ({ ...current, gender: event.target.value as Student["gender"] })); clearFieldError("gender"); }}>{draft.gender === "未填写" && <option value="未填写" disabled>未填写（请选择）</option>}<option value="男">男</option><option value="女">女</option></select>
            {errors.gender && <small className="field-error" id="student-gender-error">{errors.gender}</small>}
          </label>
          <label>
            <span>班级 *</span>
            <input id="student-className" name="className" value={draft.className} aria-invalid={Boolean(errors.className)} aria-describedby={errors.className ? "student-className-error" : undefined} onChange={(event) => { setDraft((current) => ({ ...current, className: event.target.value })); clearFieldError("className"); }} />
            {errors.className && <small className="field-error" id="student-className-error">{errors.className}</small>}
          </label>
          <label><span>学号<small className="field-label-note">（选填）</small></span><input name="studentNo" value={draft.studentNo ?? ""} onChange={(event) => setDraft((current) => ({ ...current, studentNo: event.target.value }))} /></label>
          <div className="editor-field">
            <span>成绩等级<small className="field-label-note">（选填）</small></span>
            <DialogSelect
              id="student-score-grade"
              label="成绩等级"
              className="score-grade-select"
              value={draft.score ?? ""}
              options={scoreGradeOptions}
              placeholder="请选择 A–D"
              onChange={(score) => setDraft((current) => ({ ...current, score: score || undefined }))}
            />
          </div>
          <label><span>身高（cm）<small className="field-label-note">（选填）</small></span><input name="height" min="100" max="220" type="number" value={draft.height ?? ""} onChange={(event) => setDraft((current) => ({ ...current, height: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <fieldset className="student-tag-picker span-two">
            <legend>标签<small className="field-label-note">（选填，可多选）</small></legend>
            <div className="student-tag-input-row">
              <input
                name="tags"
                aria-label="输入自定义标签"
                placeholder="输入自定义标签，多个标签用逗号分隔"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomTags();
                  }
                }}
              />
              <button type="button" disabled={!tagInput.trim()} onClick={addCustomTags}>添加</button>
            </div>
            <div className="student-tag-groups">
              {systemStudentTagGroups.map((group) => (
                <div className="student-tag-group" key={group.label}>
                  <span>{group.label}</span>
                  <div>
                    {group.tags.map((tag) => {
                      const selected = draft.tags?.includes(tag) ?? false;
                      return (
                        <button
                          className={selected ? "is-selected" : ""}
                          type="button"
                          aria-pressed={selected}
                          key={tag}
                          onClick={() => toggleTag(tag)}
                        >
                          <span className="student-tag-option-mark">{selected && <Check size={12} strokeWidth={2} />}</span>
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {customTags.length > 0 && (
                <div className="student-tag-group">
                  <span>自定义</span>
                  <div>
                    {customTags.map((tag) => (
                      <button className="is-selected is-custom" type="button" aria-label={`移除标签${tag}`} key={tag} onClick={() => toggleTag(tag)}>
                        {tag}<X size={12} strokeWidth={2} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <small className="student-tag-picker-hint" aria-live="polite">已选择 {draft.tags?.length ?? 0} 个标签。系统标签参与标签策略；自定义标签仅用于记录和检索。</small>
          </fieldset>
        </div>
      </form>
    </DialogFrame>
  );
}

function StudentInfoInlineInput({ ariaLabel, placeholder, type = "text", inputMode, min, max, onCommit }: {
  ariaLabel: string;
  placeholder: string;
  type?: "text" | "number";
  inputMode?: "numeric";
  min?: number;
  max?: number;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const normalized = value.trim();
    if (!normalized || !inputRef.current?.checkValidity()) return;
    onCommit(normalized);
  };

  return (
    <input
      ref={inputRef}
      className="student-info-inline-input"
      type={type}
      inputMode={inputMode}
      min={min}
      max={max}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoComplete="off"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function StudentTagCombobox({ id, studentName, value, suggestions, onChange }: {
  id: string;
  studentName: string;
  value: readonly string[];
  suggestions: readonly string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedTags = uniqueStudentTags(value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSuggestions = suggestions.filter((tag) => !normalizedQuery || tag.toLocaleLowerCase().includes(normalizedQuery));
  const listboxId = `${id}-options`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const updateTags = (nextTags: readonly string[]) => onChange(uniqueStudentTags(nextTags));
  const toggleTag = (tag: string) => {
    updateTags(selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag]);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };
  const addTypedTags = () => {
    const typedTags = parseStudentTags(query);
    if (!typedTags.length) return;
    updateTags([...selectedTags, ...typedTags]);
    setQuery("");
  };
  const moveOptionFocus = (current: HTMLElement, direction: 1 | -1) => {
    const optionButtons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? [])];
    const currentIndex = optionButtons.indexOf(current as HTMLButtonElement);
    optionButtons[(currentIndex + direction + optionButtons.length) % optionButtons.length]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`student-tag-combobox${open ? " is-open" : ""}${selectedTags.length ? " has-value" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        } else if (event.key === "Tab") {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        className="student-tag-combobox-trigger"
        type="button"
        aria-label={`设置${studentName}的标签`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-popover` : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="student-tag-combobox-value">
          {selectedTags.length ? <><span>{selectedTags[0]}</span>{selectedTags.length > 1 && <small>+{selectedTags.length - 1}</small>}</> : "选择或输入"}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div id={`${id}-popover`} className="student-tag-combobox-popover" role="dialog" aria-label={`设置${studentName}的标签`}>
          <label className="student-tag-combobox-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-label="搜索或输入新标签"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded="true"
              value={query}
              placeholder="搜索或输入新标签"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTypedTags();
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  rootRef.current?.querySelector<HTMLButtonElement>("[role='option']")?.focus();
                }
              }}
            />
          </label>
          <div id={listboxId} className="student-tag-combobox-options" role="listbox" aria-label="可选标签" aria-multiselectable="true">
            {visibleSuggestions.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  className={selected ? "is-selected" : ""}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      moveOptionFocus(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
                    }
                  }}
                >
                  <span className="student-tag-combobox-check">{selected && <Check size={13} strokeWidth={2.5} />}</span>
                  <span>{tag}</span>
                  <small>{isSystemStudentTag(tag) ? "系统" : "已有"}</small>
                </button>
              );
            })}
            {!visibleSuggestions.length && <p>没有匹配的已有标签</p>}
          </div>
          <button className="student-tag-combobox-create" type="button" disabled={!parseStudentTags(query).length} onClick={addTypedTags}>
            <span>＋</span>{query.trim() ? `添加“${query.trim()}”` : "输入后添加标签"}<kbd>Enter</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

function SortableStudentHeader({ label, sortKey, sort, onSort }: {
  label: string;
  sortKey: StudentTableSortKey;
  sort: StudentTableSort | undefined;
  onSort: (key: StudentTableSortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : undefined;
  const nextAction = direction === "ascending"
    ? `按${label}降序排列`
    : direction === "descending"
      ? "恢复默认顺序"
      : `按${label}升序排列`;

  return (
    <th className="student-info-sort-cell" aria-sort={direction ?? "none"}>
      <button
        className={`student-info-sort-button${active ? " is-active" : ""}`}
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={nextAction}
        title={nextAction}
      >
        <span>{label}</span>
        {direction === "ascending" ? <ArrowUp size={14} aria-hidden="true" />
          : direction === "descending" ? <ArrowDown size={14} aria-hidden="true" />
            : <ArrowUpDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );
}

export function StudentInfoManagerDialog({ students, onClose, onEdit, onBatchEdit, onInlineUpdate }: {
  students: Student[];
  onClose: () => void;
  onEdit: (student: Student) => void;
  onBatchEdit: (studentIds: string[]) => void;
  onInlineUpdate: (studentId: string, patch: Partial<Pick<Student, "gender" | "className" | "studentNo" | "score" | "height" | "tags">>) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<StudentTableSort>();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const missingGenderCount = students.filter((student) => student.gender === "未填写").length;
  const tagSuggestions = useMemo(() => uniqueStudentTags([
    ...systemStudentTags,
    ...students.flatMap((student) => student.tags ?? []),
  ]), [students]);
  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = students.filter((student) => {
      if (!normalized) return true;
      return student.name.toLocaleLowerCase().includes(normalized)
        || student.studentNo?.toLocaleLowerCase().includes(normalized)
        || student.className.toLocaleLowerCase().includes(normalized)
        || student.tags?.some((tag) => tag.toLocaleLowerCase().includes(normalized));
    });
    return sortStudentsForTable(matches, sort);
  }, [query, sort, students]);
  const filteredIds = filteredStudents.map((student) => student.id);
  const selectedFilteredCount = filteredIds.filter((id) => selectedIds.includes(id)).length;
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedFilteredCount > 0 && !allFilteredSelected;
    }
  }, [allFilteredSelected, selectedFilteredCount]);

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedIds((current) => checked
      ? current.includes(studentId) ? current : [...current, studentId]
      : current.filter((id) => id !== studentId));
  };

  const toggleAllFiltered = (checked: boolean) => {
    const filteredSet = new Set(filteredIds);
    setSelectedIds((current) => checked
      ? [...new Set([...current, ...filteredIds])]
      : current.filter((id) => !filteredSet.has(id)));
  };

  const toggleSort = (key: StudentTableSortKey) => {
    setSort((current) => nextStudentTableSort(current, key));
  };

  return (
    <DialogFrame
      eyebrow="STUDENT DATA"
      title="补充学生信息"
      className="student-info-manager-dialog"
      onClose={onClose}
      footer={<button className="primary-button" type="button" onClick={onClose}><Check size={16} />完成</button>}
    >
      <div className="student-info-manager-summary">
        <span><strong>{missingGenderCount}</strong> 人缺少性别</span>
        <small>补全后即可启用“男女分坐”和“防早恋模式”。</small>
      </div>
      <div className="student-info-manager-toolbar">
        <div className="student-info-manager-all-count" aria-label={`全部学生 ${students.length} 人`}>
          <strong>全部学生</strong><span>{students.length}</span>
        </div>
        <label className="student-info-manager-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、学号、班级或标签" />
        </label>
        <button className="secondary-button student-info-batch-button" type="button" disabled={!selectedIds.length} onClick={() => onBatchEdit(selectedIds)}>
          <PencilLine size={16} />批量修改{selectedIds.length ? ` (${selectedIds.length})` : ""}
        </button>
      </div>
      <div className="student-info-manager-table-wrap">
        <table className="student-table student-info-manager-table">
          <thead>
            <tr>
              <th><input ref={selectAllRef} type="checkbox" checked={allFilteredSelected} disabled={!filteredIds.length} onChange={(event) => toggleAllFiltered(event.target.checked)} aria-label="选择当前筛选的全部学生" /></th>
              <SortableStudentHeader label="姓名" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortableStudentHeader label="性别" sortKey="gender" sort={sort} onSort={toggleSort} />
              <SortableStudentHeader label="班级" sortKey="className" sort={sort} onSort={toggleSort} />
              <SortableStudentHeader label="学号" sortKey="studentNo" sort={sort} onSort={toggleSort} />
              <SortableStudentHeader label="成绩等级" sortKey="score" sort={sort} onSort={toggleSort} />
              <SortableStudentHeader label="身高" sortKey="height" sort={sort} onSort={toggleSort} />
              <SortableStudentHeader label="标签" sortKey="tags" sort={sort} onSort={toggleSort} />
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => {
              const selected = selectedIds.includes(student.id);
              return (
                <tr className={selected ? "is-selected" : ""} key={student.id}>
                  <td><input type="checkbox" checked={selected} onChange={(event) => toggleStudent(student.id, event.target.checked)} aria-label={`选择${student.name}`} /></td>
                  <td><strong>{student.name}</strong></td>
                  <td>
                    {student.gender === "未填写" ? (
                      <DialogSelect
                        id={`student-gender-${student.id}`}
                        label={`补充${student.name}的性别`}
                        className="student-info-inline-select"
                        value={student.gender}
                        options={[{ value: "未填写", label: "请选择" }, { value: "男", label: "男" }, { value: "女", label: "女" }]}
                        onChange={(gender) => {
                          if (gender !== "未填写") onInlineUpdate(student.id, { gender });
                        }}
                      />
                    ) : <span className={`gender-label gender-${student.gender}`}>{student.gender}</span>}
                  </td>
                  <td>
                    {student.className.trim() ? student.className : (
                      <StudentInfoInlineInput ariaLabel={`补充${student.name}的班级`} placeholder="填写班级" onCommit={(className) => onInlineUpdate(student.id, { className })} />
                    )}
                  </td>
                  <td className="mono-data">
                    {student.studentNo?.trim() ? student.studentNo : (
                      <StudentInfoInlineInput ariaLabel={`补充${student.name}的学号`} placeholder="填写学号" inputMode="numeric" onCommit={(studentNo) => onInlineUpdate(student.id, { studentNo })} />
                    )}
                  </td>
                  <td>
                    <DialogSelect
                      id={`student-score-${student.id}`}
                      label={`设置${student.name}的成绩等级`}
                      className={`student-info-inline-select student-score-grade-select score-grade-select${student.score ? " is-complete" : ""}`}
                      value={student.score ?? ""}
                      options={scoreGradeOptions}
                      placeholder="请选择"
                      onChange={(score) => {
                        if (score) onInlineUpdate(student.id, { score });
                      }}
                    />
                  </td>
                  <td>
                    {student.height != null ? `${student.height} cm` : (
                      <StudentInfoInlineInput ariaLabel={`补充${student.name}的身高`} placeholder="填写身高" type="number" min={100} max={220} onCommit={(height) => onInlineUpdate(student.id, { height: Number(height) })} />
                    )}
                  </td>
                  <td>
                    <StudentTagCombobox
                      id={`student-tags-${student.id}`}
                      studentName={student.name}
                      value={student.tags ?? []}
                      suggestions={tagSuggestions}
                      onChange={(tags) => onInlineUpdate(student.id, { tags })}
                    />
                  </td>
                  <td><button className="student-info-edit-button" type="button" onClick={() => onEdit(student)}><PencilLine size={14} />修改</button></td>
                </tr>
              );
            })}
            {!filteredStudents.length && (
              <tr><td className="student-info-manager-empty" colSpan={9}>没有找到匹配的学生</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DialogFrame>
  );
}

export interface StudentBulkPatch {
  gender?: Student["gender"];
  tag?: string;
  clearTags?: boolean;
  score?: ScoreGrade;
  height?: number;
}

export function StudentBatchDialog({ count, onClose, onSave }: { count: number; onClose: () => void; onSave: (patch: StudentBulkPatch) => void }) {
  const [gender, setGender] = useState("");
  const [tag, setTag] = useState("");
  const [clearTags, setClearTags] = useState(false);
  const [score, setScore] = useState<ScoreGrade | "">("");
  const [height, setHeight] = useState("");
  return (
    <DialogFrame
      eyebrow="BATCH EDIT"
      title={`批量编辑 ${count} 名学生`}
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={() => onSave({ gender: gender ? gender as Student["gender"] : undefined, tag: tag.trim() || undefined, clearTags, score: score || undefined, height: height ? Number(height) : undefined })}>应用修改</button></>}
    >
      <div className="dialog-intro"><UsersRound size={20} /><span>留空的字段不会覆盖原值。修改会作为一次操作加入撤销历史。</span></div>
      <div className="editor-grid student-batch-grid">
        <div className="editor-field">
          <span>统一性别</span>
          <DialogSelect
            id="student-batch-gender"
            label="统一性别"
            value={gender}
            options={[{ value: "", label: "不修改" }, { value: "男", label: "男" }, { value: "女", label: "女" }]}
            onChange={setGender}
          />
        </div>
        <div className="editor-field">
          <span>统一成绩等级</span>
          <DialogSelect
            id="student-batch-score-grade"
            label="统一成绩等级"
            className="score-grade-select"
            value={score}
            options={[{ value: "", label: "不修改" }, ...scoreGradeOptions]}
            onChange={setScore}
          />
        </div>
        <label><span>统一身高</span><input type="number" min="100" max="220" value={height} onChange={(event) => setHeight(event.target.value)} /></label>
        <label><span>统一标签</span><input disabled={clearTags} value={tag} onChange={(event) => setTag(event.target.value)} placeholder="例如：靠前安排" /></label>
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
          <strong>{candidate.label}</strong>
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

export function DeleteStudentDialog({ student, relatedRuleCount, relatedStudentCount, onClose, onConfirm }: {
  student: Student;
  relatedRuleCount: number;
  relatedStudentCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ruleSummary = relatedRuleCount > 0
    ? `与 ${relatedStudentCount} 名学生关联的 ${relatedRuleCount} 条排座规则也会一并删除。`
    : "该学生当前没有关联的排座规则。";

  return (
    <DialogFrame
      eyebrow="DELETE STUDENT"
      title={`删除学生“${student.name}”？`}
      onClose={onClose}
      footer={<><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="danger-button" type="button" onClick={onConfirm}><Trash2 size={16} />删除学生</button></>}
    >
      <div className="clear-class-warning delete-workspace-warning">
        <span aria-hidden="true"><Trash2 size={23} /></span>
        <div>
          <strong>将从当前班级移除“{student.name}”</strong>
          <p>该学生的座位安排会同时移除。{ruleSummary}其他学生之间的规则不受影响，完成后可使用“撤销”恢复。</p>
        </div>
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

export function RestoreDataDialog({ fileName, exportedAt, summary, restoring, onClose, onConfirm }: {
  fileName: string;
  exportedAt: string;
  summary: DataBackupSummary;
  restoring: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const exportedDate = new Date(exportedAt);
  const dateLabel = Number.isNaN(exportedDate.getTime())
    ? "未知时间"
    : exportedDate.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <DialogFrame
      eyebrow="RESTORE DATA"
      title="恢复班阵数据"
      className="restore-data-dialog"
      onClose={restoring ? () => undefined : onClose}
      footer={<><button className="secondary-button" type="button" disabled={restoring} onClick={onClose}>取消</button><button className="danger-button" type="button" disabled={restoring} onClick={onConfirm}><RotateCcw size={16} />{restoring ? "正在恢复…" : "确认恢复"}</button></>}
    >
      <div className="restore-data-warning">
        <span aria-hidden="true"><LockKeyhole size={23} /></span>
        <div><strong>将用备份覆盖本机现有数据</strong><p>恢复完成后会自动刷新，班级、座位版本、规则、模板和界面设置都会回到备份时的状态。</p></div>
      </div>
      <dl className="restore-data-summary">
        <div><dt>备份文件</dt><dd title={fileName}>{fileName}</dd></div>
        <div><dt>导出时间</dt><dd>{dateLabel}</dd></div>
        <div><dt>数据范围</dt><dd>{summary.classCount} 个班级 · {summary.versionCount} 个座位版本 · {summary.studentRecordCount} 条学生记录</dd></div>
      </dl>
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
