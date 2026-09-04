import { describe, expect, it } from "vitest";
import type { AssignmentMap, GenerationWeights, Student } from "../types";
import { createGridSeats } from "./layoutPresets";
import { createCandidates } from "./candidates";

const students: Student[] = Array.from({ length: 8 }, (_, index) => ({
  id: `s-${index}`,
  name: `学生${index}`,
  gender: index % 2 ? "女" : "男",
  className: "测试班",
  score: 80 + index * 5,
  height: 150 + index * 4,
  appearance: index + 1,
}));
const seats = createGridSeats({ groups: 2, rows: 2, columns: 2 });
const assignments = seats.reduce<AssignmentMap>((result, seat, index) => ({ ...result, [seat.id]: students[index].id }), {});
const weights: GenerationWeights = { score: 72, height: 58, appearance: 25 };

describe("candidate generation", () => {
  it("returns three scored candidates with inspectable metrics", () => {
    const candidates = createCandidates(assignments, seats, [], students, "group_balanced", weights, 1);
    expect(candidates).toHaveLength(3);
    expect(candidates.every((candidate) => candidate.metrics?.algorithm === "group_balanced")).toBe(true);
    expect(Object.keys(candidates[0].assignments)).toHaveLength(8);
  });

  it.each(["group_balanced", "height", "score_spread", "romance_guard", "height_romance"])(
    "returns visibly different candidates for %s",
    (algorithm) => {
      const candidates = createCandidates(assignments, seats, [], students, algorithm, weights, 1);
      const assignmentVariants = new Set(candidates.map((candidate) => JSON.stringify(candidate.assignments)));

      expect(assignmentVariants.size).toBe(3);
    },
  );

  it("changes candidate ids and ordering for a new generation", () => {
    const first = createCandidates(assignments, seats, [], students, "random", weights, 1);
    const second = createCandidates(assignments, seats, [], students, "random", weights, 2);
    expect(first[0].id).not.toBe(second[0].id);
    expect(first[0].assignments).not.toEqual(second[0].assignments);
  });

  it("includes unseated roster students when the layout has capacity", () => {
    const partialAssignments: AssignmentMap = Object.fromEntries(
      seats.slice(0, 6).map((seat, index) => [seat.id, students[index].id]),
    );
    const candidates = createCandidates(partialAssignments, seats, [], students, "group_balanced", weights, 1);
    expect(new Set(Object.values(candidates[0].assignments))).toEqual(new Set(students.map((student) => student.id)));
  });
});
