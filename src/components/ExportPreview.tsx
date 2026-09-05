import type { CSSProperties } from "react";
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
  const classroomSeats = seats.filter((seat) => !seat.guardian);
  const guardianSeats = new Map(seats.filter((seat) => seat.guardian).map((seat) => [seat.guardian, seat]));
  const groupIds = [...new Set(classroomSeats.map((seat) => seat.group))].sort((left, right) => left - right);
  const gradeName = className.replace(/[（(].*$/, "").replace(/班$/, "");
  const renderSeat = (seat: SeatDefinition, style?: CSSProperties) => {
    const student = studentMap.get(assignments[seat.id] ?? "");
    return (
      <div
        className={`print-seat ${seat.disabled ? "is-disabled" : ""}`}
        key={seat.id}
        style={style}
      >
        {!seat.disabled && student?.isClassRepresentative && (
          <span className="print-seat-representative" aria-label="课代表">课</span>
        )}
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
  };

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
        <div className="print-front-row">
          <div className="print-guardian-slot is-left">
            {guardianSeats.get("left") && <><span>左护法</span>{renderSeat(guardianSeats.get("left")!)}</>}
          </div>
          <div className="print-podium">讲台</div>
          <div className="print-guardian-slot is-right">
            {guardianSeats.get("right") && <><span>右护法</span>{renderSeat(guardianSeats.get("right")!)}</>}
          </div>
        </div>
        <div
          className="print-groups"
          style={{
            gridTemplateColumns: `repeat(${Math.max(groupIds.length, 1)}, minmax(0, 1fr))`,
            gap: groupIds.length > 4 ? "2%" : "5.6%",
          }}
        >
          {groupIds.map((group) => {
            const groupSeats = classroomSeats
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
                {groupSeats.map((seat) => renderSeat(seat, { gridColumn: seat.column + 1, gridRow: seat.row + 1 }))}
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
