import { CirclePlus, GripVertical, PencilLine, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Student } from "../types";
import { StudentQuickTags } from "./StudentQuickTags";

interface RosterSidebarProps {
  students: Student[];
  selectedIds: string[];
  title?: string;
  onToggleStudent: (studentId: string, additive: boolean) => void;
  onAddStudentTag: (studentId: string, tag: string) => void;
  onDeleteStudent: (student: Student) => void;
  onOpenImport: () => void;
  onAddStudent: () => void;
  onOpenStudentInfo: () => void;
}

export function RosterSidebar({
  students,
  selectedIds,
  title = "待入座名单",
  onToggleStudent,
  onAddStudentTag,
  onDeleteStudent,
  onOpenImport,
  onAddStudent,
  onOpenStudentInfo,
}: RosterSidebarProps) {
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ studentId: string; x: number; y: number }>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectionAnchorRef = useRef<string | undefined>(undefined);
  const contextMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!contextMenu) return;
    const focusFrame = window.requestAnimationFrame(() => {
      contextMenuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")?.focus();
    });
    const closeFromOutside = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(undefined);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(undefined);
    };
    const closeMenu = () => setContextMenu(undefined);
    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("keydown", closeFromKeyboard);
    document.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("keydown", closeFromKeyboard);
      document.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [contextMenu]);

  const openContextMenu = (studentId: string, x: number, y: number) => {
    const menuWidth = 248;
    const menuHeight = 330;
    setContextMenu({
      studentId,
      x: Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12)),
    });
  };

  const handleContextMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)")];
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex].focus();
  };

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

  const contextMenuStudent = contextMenu
    ? students.find((student) => student.id === contextMenu.studentId)
    : undefined;

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

      <div className="roster-list" role="list" aria-label="待入座学生">
        {filtered.length ? (
          filtered.map((student) => {
            const selected = selectedIds.includes(student.id);
            return (
              <div
                className={`roster-row ${selected ? "is-selected" : ""}`}
                key={student.id}
                role="listitem"
                onContextMenu={(event) => {
                  event.preventDefault();
                  openContextMenu(student.id, event.clientX, event.clientY);
                }}
              >
                <button
                  className="roster-select-button"
                  type="button"
                  draggable
                  aria-pressed={selected}
                  aria-label={`${selected ? "取消选择" : "选择"}${student.name}`}
                  onClick={(event) => selectStudent(student.id, event)}
                  onKeyDown={(event) => {
                    if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      openContextMenu(student.id, rect.left + 28, rect.top + 28);
                    }
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-banzhen-student", student.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <GripVertical className="drag-handle" size={15} aria-hidden="true" />
                  <span className={`gender-dot gender-${student.gender}`} aria-hidden="true" />
                  <span className="roster-name">{student.name}</span>
                  {student.height && <span className="roster-meta">{student.height}cm</span>}
                </button>
                <button
                  className="roster-delete-button"
                  type="button"
                  draggable={false}
                  aria-label={`删除学生${student.name}`}
                  title={`删除${student.name}`}
                  onClick={() => onDeleteStudent(student)}
                >
                  <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty-list">没有匹配的学生</div>
        )}
      </div>

      {contextMenu && contextMenuStudent && (
        <div
          className="student-context-menu roster-student-context-menu"
          ref={contextMenuRef}
          role="menu"
          aria-label={`${contextMenuStudent.name}的操作`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onKeyDown={handleContextMenuKeyDown}
        >
          <div className="student-context-menu-header">
            <span aria-hidden="true">{contextMenuStudent.name.slice(0, 1)}</span>
            <div>
              <strong>{contextMenuStudent.name}</strong>
              <small>{contextMenuStudent.tags?.length ? contextMenuStudent.tags.join(" · ") : "暂未添加标签"}</small>
            </div>
          </div>
          <StudentQuickTags
            key={contextMenuStudent.id}
            studentName={contextMenuStudent.name}
            tags={contextMenuStudent.tags}
            onToggleTag={(tag) => onAddStudentTag(contextMenuStudent.id, tag)}
          />
          <button
            className="student-context-menu-danger"
            type="button"
            role="menuitem"
            onClick={() => {
              onDeleteStudent(contextMenuStudent);
              setContextMenu(undefined);
            }}
          >
            <Trash2 size={16} />
            <span><strong>删除学生</strong><small>删除前会再次确认</small></span>
          </button>
        </div>
      )}

      <div className="sidebar-bottom-actions">
        <button className="quiet-action" type="button" data-tour-target="roster-import" onClick={onOpenImport}>
          <Upload size={16} />
          导入名单
        </button>
        <button className="quiet-action" type="button" onClick={onAddStudent}>
          <CirclePlus size={16} />
          添加学生
        </button>
        <button className="quiet-action" type="button" onClick={onOpenStudentInfo}>
          <PencilLine size={16} />
          补充信息
        </button>
      </div>

      <p className="sidebar-tip">拖拽学生到空座位，或按住 Ctrl / Shift 进行多选。</p>
    </aside>
  );
}
