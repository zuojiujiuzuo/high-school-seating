import { Check, Filter, MoreHorizontal, PencilLine, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Student } from "../types";

interface StudentRosterBoardProps {
  students: Student[];
  selectedIds: string[];
  unseatedStudentIds: string[];
  onSelectionChange: (studentIds: string[]) => void;
  onOpenImport: () => void;
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (student: Student) => void;
  onBatchEdit: (studentIds: string[]) => void;
}

type RosterTab = "all" | "missing" | "unseated";
type GenderFilter = "all" | Student["gender"];

const PAGE_SIZE = 13;

function isStudentIncomplete(student: Student) {
  return !student.name.trim()
    || !student.gender
    || !student.className.trim()
    || !student.studentNo?.trim()
    || student.score == null
    || student.height == null;
}

function hasRequiredFields(student: Student) {
  return Boolean(student.name.trim() && student.gender && student.className.trim());
}

export function StudentRosterBoard({
  students,
  selectedIds,
  unseatedStudentIds,
  onSelectionChange,
  onOpenImport,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onBatchEdit,
}: StudentRosterBoardProps) {
  const [activeTab, setActiveTab] = useState<RosterTab>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [page, setPage] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string>();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const unseatedSet = useMemo(() => new Set(unseatedStudentIds), [unseatedStudentIds]);
  const missingCount = useMemo(() => students.filter(isStudentIncomplete).length, [students]);
  const requiredCompleteCount = useMemo(() => students.filter(hasRequiredFields).length, [students]);
  const heightCovered = useMemo(() => students.filter((student) => student.height != null).length, [students]);
  const scoreCovered = useMemo(() => students.filter((student) => student.score != null).length, [students]);
  const requiredCompleteness = students.length
    ? Math.round((requiredCompleteCount / students.length) * 100)
    : 0;

  const filteredStudents = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return students.filter((student) => {
      if (activeTab === "missing" && !isStudentIncomplete(student)) return false;
      if (activeTab === "unseated" && !unseatedSet.has(student.id)) return false;
      if (gender !== "all" && student.gender !== gender) return false;
      if (!normalizedKeyword) return true;
      return student.name.toLocaleLowerCase().includes(normalizedKeyword)
        || student.studentNo?.toLocaleLowerCase().includes(normalizedKeyword)
        || student.tags?.some((tag) => tag.toLocaleLowerCase().includes(normalizedKeyword));
    });
  }, [activeTab, gender, keyword, students, unseatedSet]);

  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const pageStudents = filteredStudents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageStudentIds = pageStudents.map((student) => student.id);
  const selectedOnPageCount = pageStudentIds.filter((studentId) => selectedIds.includes(studentId)).length;
  const allOnPageSelected = pageStudentIds.length > 0 && selectedOnPageCount === pageStudentIds.length;

  useEffect(() => {
    setPage(0);
  }, [activeTab, gender, keyword]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPageCount > 0 && !allOnPageSelected;
    }
  }, [allOnPageSelected, selectedOnPageCount]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-roster-menu]")) setOpenMenuId(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(undefined);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const toggleStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange(selectedIds.includes(studentId) ? selectedIds : [...selectedIds, studentId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== studentId));
    }
  };

  const toggleCurrentPage = (checked: boolean) => {
    const idsOnPage = new Set(pageStudentIds);
    if (checked) {
      onSelectionChange([...new Set([...selectedIds, ...pageStudentIds])]);
    } else {
      onSelectionChange(selectedIds.filter((id) => !idsOnPage.has(id)));
    }
  };

  const firstVisibleIndex = filteredStudents.length ? page * PAGE_SIZE + 1 : 0;
  const lastVisibleIndex = Math.min((page + 1) * PAGE_SIZE, filteredStudents.length);

  return (
    <section className="roster-board page-surface">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">STEP 01 · STUDENTS</span>
          <h1>先把名单理清楚</h1>
          <p>
            已识别 {students.length} 名学生，
            {requiredCompleteCount === students.length
              ? "必填信息完整，可以进入布局设计。"
              : `还有 ${students.length - requiredCompleteCount} 名学生需要补全必填信息。`}
          </p>
        </div>
        <div className="title-actions">
          <button className="secondary-button" type="button" onClick={onOpenImport}>
            <Upload size={17} />
            导入 Excel
          </button>
          <button className="primary-button" type="button" onClick={onAddStudent}>
            <Plus size={17} />
            添加学生
          </button>
        </div>
      </div>

      <div className="data-summary-strip">
        <div><strong>{students.length}</strong><span>学生总数</span></div>
        <div><strong>{requiredCompleteness}%</strong><span>必填完整度</span></div>
        <div><strong>{heightCovered}/{students.length}</strong><span>身高覆盖</span></div>
        <div><strong>{scoreCovered}/{students.length}</strong><span>成绩覆盖</span></div>
        <span className="summary-ok">
          <Check size={16} />
          {requiredCompleteCount === students.length ? "数据可以用于排座" : "请先补全必填信息"}
        </span>
      </div>

      <div className="table-toolbar">
        <div className="segmented-control" aria-label="名单筛选">
          <button className={activeTab === "all" ? "is-active" : ""} type="button" aria-pressed={activeTab === "all"} onClick={() => setActiveTab("all")}>全部 {students.length}</button>
          <button className={activeTab === "missing" ? "is-active" : ""} type="button" aria-pressed={activeTab === "missing"} onClick={() => setActiveTab("missing")}>信息缺失 {missingCount}</button>
          <button className={activeTab === "unseated" ? "is-active" : ""} type="button" aria-pressed={activeTab === "unseated"} onClick={() => setActiveTab("unseated")}>未入座 {unseatedStudentIds.length}</button>
        </div>
        <button className={`quiet-action ${filterOpen ? "is-active" : ""}`} type="button" aria-expanded={filterOpen} aria-controls="roster-filter-panel" onClick={() => setFilterOpen((current) => !current)}><Filter size={16} />筛选</button>
        <button className="quiet-action" type="button" disabled={selectedIds.length === 0} onClick={() => onBatchEdit(selectedIds)}><PencilLine size={16} />批量编辑{selectedIds.length ? ` (${selectedIds.length})` : ""}</button>
      </div>

      {filterOpen && (
        <div className="roster-filter-panel" id="roster-filter-panel">
          <label>
            <span>关键词</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、学号或标签" />
          </label>
          <label>
            <span>性别</span>
            <select value={gender} onChange={(event) => setGender(event.target.value as GenderFilter)}>
              <option value="all">全部</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </label>
          <button className="text-button" type="button" disabled={!keyword && gender === "all"} onClick={() => { setKeyword(""); setGender("all"); }}>清除筛选</button>
        </div>
      )}

      <div className="student-table-wrap">
        <table className="student-table">
          <thead>
            <tr>
              <th>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allOnPageSelected}
                  disabled={pageStudentIds.length === 0}
                  onChange={(event) => toggleCurrentPage(event.target.checked)}
                  aria-label="选择当前页学生"
                />
              </th>
              <th>姓名</th>
              <th>性别</th>
              <th>学号</th>
              <th>成绩</th>
              <th>身高</th>
              <th>标签</th>
              <th aria-label="更多操作" />
            </tr>
          </thead>
          <tbody>
            {pageStudents.map((student) => {
              const selected = selectedIds.includes(student.id);
              return (
                <tr className={selected ? "is-selected" : ""} key={student.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleStudent(student.id, event.target.checked)}
                      aria-label={`选择${student.name}`}
                    />
                  </td>
                  <td><strong>{student.name}</strong></td>
                  <td><span className={`gender-label gender-${student.gender}`}>{student.gender}</span></td>
                  <td className="mono-data">{student.studentNo}</td>
                  <td>{student.score ?? <span className="missing-value">待补充</span>}</td>
                  <td>{student.height != null ? `${student.height} cm` : <span className="missing-value">待补充</span>}</td>
                  <td>
                    {student.tags?.length ? <span className="tag">{student.tags[0]}</span> : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="table-row-menu" data-roster-menu>
                      <button
                        className="icon-button table-more"
                        type="button"
                        aria-label={`${student.name}的更多操作`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === student.id}
                        onClick={() => setOpenMenuId((current) => current === student.id ? undefined : student.id)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {openMenuId === student.id && (
                        <div className="table-row-menu-popover" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setOpenMenuId(undefined); onEditStudent(student); }}><PencilLine size={15} />编辑学生</button>
                          <button className="danger-action" type="button" role="menuitem" onClick={() => { setOpenMenuId(undefined); onDeleteStudent(student); }}><Trash2 size={15} />删除学生</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!pageStudents.length && (
              <tr>
                <td className="student-table-empty" colSpan={8}>没有符合当前筛选条件的学生</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        显示 {firstVisibleIndex}–{lastVisibleIndex}，共 {filteredStudents.length} 人
        <span className="table-pagination">
          每页 {PAGE_SIZE} 条
          <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>上一页</button>
          <span>第 {page + 1}/{pageCount} 页</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>下一页</button>
        </span>
      </div>
    </section>
  );
}
