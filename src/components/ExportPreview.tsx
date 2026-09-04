import type { AssignmentMap, SeatDefinition, Student } from "../types";

interface ExportPreviewProps {
  students: Student[];
  seats: SeatDefinition[];
  assignments: AssignmentMap;
  showGender: boolean;
  showStudentNo: boolean;
  showGroupBoundaries: boolean;
  className: string;
  versionName: string;
  theme: "paper" | "ink";
}

export function ExportPreview({
  students,
  seats,
  assignments,
  showGender,
  showStudentNo,
  showGroupBoundaries,
  className,
  versionName,
  theme,
}: ExportPreviewProps) {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const groupIds = [...new Set(seats.map((seat) => seat.group))].sort((left, right) => left - right);
  const gradeName = className.replace(/[（(].*$/, "").replace(/班$/, "");

  return (
    <section className="export-preview-shell">
      <div className="preview-ruler preview-ruler-top" />
      <div className="preview-ruler preview-ruler-left" />
      <article className={`print-sheet theme-${theme} ${showGroupBoundaries ? "show-group-boundaries" : "hide-group-boundaries"}`}>
        <header className="print-header">
          <div>
            <span>{gradeName}年级</span>
            <h1>{className}座次表</h1>
          </div>
          <p>{versionName}<br />2026 年秋季学期</p>
        </header>
        <div className="print-front-label">黑板 / 教室前方</div>
        <div className="print-podium">讲台</div>
        <div
          className="print-groups"
          style={{
            gridTemplateColumns: `repeat(${Math.max(groupIds.length, 1)}, minmax(0, 1fr))`,
            gap: groupIds.length > 4 ? "2%" : "5.6%",
          }}
        >
          {groupIds.map((group) => {
            const groupSeats = seats
              .filter((seat) => seat.group === group)
              .sort((left, right) => left.row - right.row || left.column - right.column);
            const rowCount = Math.max(1, ...groupSeats.map((seat) => seat.row + 1));
            const columnCount = Math.max(1, ...groupSeats.map((seat) => seat.column + 1));

            return (
              <div
                className={`print-group ${showGroupBoundaries ? "has-boundary" : "without-boundary"}`}
                key={group}
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
                  borderColor: showGroupBoundaries ? undefined : "transparent",
                }}
              >
                {groupSeats.map((seat) => {
                  const student = studentMap.get(assignments[seat.id] ?? "");
                  return (
                    <div
                      className={`print-seat ${seat.disabled ? "is-disabled" : ""}`}
                      key={seat.id}
                      style={{ gridColumn: seat.column + 1, gridRow: seat.row + 1 }}
                    >
                      <strong aria-label={seat.disabled ? "停用座位" : undefined}>{seat.disabled ? "×" : student?.name ?? "空位"}</strong>
                      {!seat.disabled && student && (showGender || showStudentNo) && (
                        <small>
                          {showGender ? student.gender : ""}
                          {showGender && showStudentNo ? " · " : ""}
                          {showStudentNo ? student.studentNo?.slice(-3) : ""}
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <footer className="print-footer">
          <span>班主任：李老师</span>
          <span>班阵 · 本地生成</span>
        </footer>
      </article>
      <div className="preview-status">A4 横向 · 1 页 · 实时预览</div>
    </section>
  );
}
