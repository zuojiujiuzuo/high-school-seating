import { CirclePlus, GripVertical, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Student } from "../types";

interface RosterSidebarProps {
  students: Student[];
  selectedIds: string[];
  title?: string;
  onToggleStudent: (studentId: string, additive: boolean) => void;
  onOpenImport: () => void;
  onAddStudent: () => void;
}

export function RosterSidebar({
  students,
  selectedIds,
  title = "待入座名单",
  onToggleStudent,
  onOpenImport,
  onAddStudent,
}: RosterSidebarProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectionAnchorRef = useRef<string | undefined>(undefined);
  const filtered = useMemo(
    () => students.filter((student) => student.name.includes(query) || student.studentNo?.includes(query)),
    [query, students],
  );

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const selectStudent = (studentId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = filtered.findIndex((student) => student.id === selectionAnchorRef.current);
      const studentIndex = filtered.findIndex((student) => student.id === studentId);
      if (anchorIndex >= 0 && studentIndex >= 0) {
        const start = Math.min(anchorIndex, studentIndex);
        const end = Math.max(anchorIndex, studentIndex);
        filtered.slice(start, end + 1).forEach((student) => {
          if (!selectedIds.includes(student.id)) onToggleStudent(student.id, true);
        });
        selectionAnchorRef.current = studentId;
        return;
      }
    }

    onToggleStudent(studentId, event.metaKey || event.ctrlKey);
    selectionAnchorRef.current = studentId;
  };

  return (
    <aside className="roster-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">ROSTER</span>
          <h2>{title}</h2>
        </div>
        <span className="count-badge">{students.length} 人</span>
      </div>

      <label className="search-field">
        <Search size={17} />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索姓名或学号"
          aria-label="搜索学生"
          aria-keyshortcuts="Control+K Meta+K"
        />
        <kbd>Ctrl/⌘ K</kbd>
      </label>

      <div className="roster-list" role="listbox" aria-multiselectable="true">
        {filtered.length ? (
          filtered.map((student) => {
            const selected = selectedIds.includes(student.id);
            return (
              <button
                className={`roster-row ${selected ? "is-selected" : ""}`}
                key={student.id}
                type="button"
                role="option"
                aria-selected={selected}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-banzhen-student", student.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={(event) => selectStudent(student.id, event)}
              >
                <GripVertical className="drag-handle" size={15} />
                <span className={`gender-dot gender-${student.gender}`} />
                <span className="roster-name">{student.name}</span>
                <span className="roster-meta">{student.height ? `${student.height}cm` : "—"}</span>
              </button>
            );
          })
        ) : (
          <div className="empty-list">没有匹配的学生</div>
        )}
      </div>

      <div className="sidebar-bottom-actions">
        <button className="quiet-action" type="button" onClick={onOpenImport}>
          <Upload size={16} />
          导入名单
        </button>
        <button className="quiet-action" type="button" onClick={onAddStudent}>
          <CirclePlus size={16} />
          添加学生
        </button>
      </div>

      <p className="sidebar-tip">拖拽学生到空座位，或按住 Ctrl / Shift 进行多选。</p>
    </aside>
  );
}
