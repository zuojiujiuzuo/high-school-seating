import type { AssignmentMap } from "../types";

export function moveAssignmentGroup(
  assignments: AssignmentMap,
  sourceSeatIds: string[],
  targetSeatIds: string[],
): AssignmentMap {
  if (
    sourceSeatIds.length === 0
    || sourceSeatIds.length !== targetSeatIds.length
    || new Set(sourceSeatIds).size !== sourceSeatIds.length
    || new Set(targetSeatIds).size !== targetSeatIds.length
  ) {
    return assignments;
  }

  const next = { ...assignments };
  const sourceStudents = sourceSeatIds.map((seatId) => assignments[seatId]);
  const sourceSet = new Set(sourceSeatIds);
  const targetSet = new Set(targetSeatIds);
  const sourceOnly = sourceSeatIds.filter((seatId) => !targetSet.has(seatId));
  const targetOnly = targetSeatIds.filter((seatId) => !sourceSet.has(seatId));

  new Set([...sourceSeatIds, ...targetSeatIds]).forEach((seatId) => {
    delete next[seatId];
  });

  targetSeatIds.forEach((seatId, index) => {
    const studentId = sourceStudents[index];
    if (studentId) next[seatId] = studentId;
  });

  sourceOnly.forEach((seatId, index) => {
    const displacedStudentId = assignments[targetOnly[index]];
    if (displacedStudentId) next[seatId] = displacedStudentId;
  });

  return next;
}
