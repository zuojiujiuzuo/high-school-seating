import { describe, expect, it } from "vitest";
import type { ProjectState, SeatingConstraint, Student } from "../types";
import { removeStudentFromProject } from "./students";

const students: Student[] = ["a", "b", "c"].map((id) => ({
  id,
  name: id.toUpperCase(),
  gender: "未填写",
  className: "测试班",
}));

function constraint(id: string, a: string, b: string): SeatingConstraint {
  return {
    id,
    type: "not_adjacent",
    pair: { a, b },
    hard: true,
    batchId: id,
    createdAt: 1,
  };
}

const project: ProjectState = {
  students,
  solutionConfirmed: true,
  assignments: { "seat-1": "a", "seat-2": "b", "seat-3": "c" },
  constraints: [constraint("a-b", "a", "b"), constraint("b-c", "b", "c")],
  disabledSeatIds: [],
  customSeats: [],
  seatPositions: {},
  aisleWidth: 54,
  podiumPosition: { x: 0, y: 0 },
  layoutPreset: "48-seat",
  layoutConfig: { groups: 4, rows: 6, columns: 2 },
  guardianSides: [],
  doorPlacements: [],
};

describe("student removal", () => {
  it("removes the student, their seat, and every directly related rule", () => {
    const result = removeStudentFromProject(project, "a");

    expect(result.students.map((student) => student.id)).toEqual(["b", "c"]);
    expect(result.assignments).toEqual({ "seat-2": "b", "seat-3": "c" });
    expect(result.constraints).toEqual([project.constraints[1]]);
    expect(result.solutionConfirmed).toBe(false);
  });
});
