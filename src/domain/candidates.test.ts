import { describe, expect, it } from "vitest";
import type { AssignmentMap, GenerationStrategy, GenerationWeights, Student } from "../types";
import { createGridSeats } from "./layoutPresets";
import { createCandidates } from "./candidates";

const students: Student[] = Array.from({ length: 8 }, (_, index) => ({
  id: `s-${index}`,
  name: `学生${index}`,
  gender: index % 2 ? "女" : "男",
  className: "测试班",
  score: (["A", "B", "C", "D"] as const)[index % 4],
  height: 150 + index * 4,
  appearance: index + 1,
}));
const seats = createGridSeats({ groups: 2, rows: 2, columns: 2 });
const assignments = seats.reduce<AssignmentMap>((result, seat, index) => ({ ...result, [seat.id]: students[index].id }), {});
const weights: GenerationWeights = { score: 72, height: 58, appearance: 25 };
const options = (strategies: GenerationStrategy[]) => ({ strategies });

describe("candidate generation", () => {
  it("returns one scored candidate with inspectable metrics", () => {
    const candidates = createCandidates(assignments, seats, [], students, options(["group_balanced"]), weights, 1);
    expect(candidates).toHaveLength(1);
    expect(candidates.every((candidate) => (
      candidate.metrics?.strategies.length === 1
      && candidate.metrics.strategies[0] === "group_balanced"
    ))).toBe(true);
    expect(Object.keys(candidates[0].assignments)).toHaveLength(8);
  });

  it.each<GenerationStrategy>(["group_balanced", "height", "score_spread", "tag_balanced", "gender_separated", "romance_guard"])(
    "returns a different candidate after regenerating with %s",
    (algorithm) => {
      const first = createCandidates(assignments, seats, [], students, options([algorithm]), weights, 1)[0];
      const second = createCandidates(assignments, seats, [], students, options([algorithm]), weights, 2)[0];

      expect(first.assignments).not.toEqual(second.assignments);
    },
  );

  it("changes candidate ids and ordering for a new generation", () => {
    const first = createCandidates(assignments, seats, [], students, options(["random"]), weights, 1);
    const second = createCandidates(assignments, seats, [], students, options(["random"]), weights, 2);
    expect(first[0].id).not.toBe(second[0].id);
    expect(first[0].assignments).not.toEqual(second[0].assignments);
  });

  it("includes unseated roster students when the layout has capacity", () => {
    const partialAssignments: AssignmentMap = Object.fromEntries(
      seats.slice(0, 6).map((seat, index) => [seat.id, students[index].id]),
    );
    const candidates = createCandidates(partialAssignments, seats, [], students, options(["group_balanced"]), weights, 1);
    expect(new Set(Object.values(candidates[0].assignments))).toEqual(new Set(students.map((student) => student.id)));
  });

  it("combines multiple strategies and records the active combination", () => {
    const candidates = createCandidates(
      assignments,
      seats,
      [],
      students,
      options(["score_spread", "height"]),
      weights,
      1,
    );

    expect(candidates[0].metrics?.strategies).toEqual(["score_spread", "height"]);
  });

  it("keeps desk mates the same gender when gender separation is enabled", () => {
    const candidate = createCandidates(
      assignments,
      seats,
      [],
      students,
      options(["group_balanced", "gender_separated"]),
      weights,
      1,
    )[0];
    const studentById = new Map(students.map((student) => [student.id, student]));
    const seatsByDesk = new Map<string, typeof seats>();
    seats.forEach((seat) => {
      seatsByDesk.set(seat.deskId, [...(seatsByDesk.get(seat.deskId) ?? []), seat]);
    });

    seatsByDesk.forEach((deskSeats) => {
      const deskStudents = deskSeats.map((seat) => studentById.get(candidate.assignments[seat.id] ?? "")).filter(Boolean);
      if (deskStudents.length === 2) expect(deskStudents[0]?.gender).toBe(deskStudents[1]?.gender);
    });
  });

  it("applies the built-in tag strategy without per-tag configuration", () => {
    const taggedStudents = students.map((student, index) => ({
      ...student,
      tags: [
        ...(index < 4 ? ["视力关注"] : []),
        ...(index % 2 === 0 ? ["组长候选"] : []),
        ...(index % 2 === 1 ? ["学科优势"] : []),
      ],
    }));
    const candidate = createCandidates(
      assignments,
      seats,
      [],
      taggedStudents,
      options(["tag_balanced"]),
      weights,
      1,
    )[0];
    const seatByStudent = new Map(
      Object.entries(candidate.assignments).map(([seatId, studentId]) => [studentId, seats.find((seat) => seat.id === seatId)]),
    );

    expect(taggedStudents.filter((student) => student.tags.includes("视力关注"))
      .every((student) => seatByStudent.get(student.id)?.row === 0)).toBe(true);
    const leaderCounts = [0, 1].map((group) => taggedStudents.filter((student) => (
      student.tags.includes("组长候选") && seatByStudent.get(student.id)?.group === group
    )).length);
    const subjectCounts = [0, 1].map((group) => taggedStudents.filter((student) => (
      student.tags.includes("学科优势") && seatByStudent.get(student.id)?.group === group
    )).length);
    expect(leaderCounts).toEqual([2, 2]);
    expect(subjectCounts).toEqual([2, 2]);
  });

  it("ignores custom tags even when their names end with 优势", () => {
    const baseline = createCandidates(
      assignments,
      seats,
      [],
      students,
      options(["tag_balanced"]),
      weights,
      1,
    )[0];
    const customTaggedStudents = students.map((student, index) => ({
      ...student,
      tags: index < 4 ? ["自定义优势"] : [],
    }));
    const withCustomTags = createCandidates(
      assignments,
      seats,
      [],
      customTaggedStudents,
      options(["tag_balanced"]),
      weights,
      1,
    )[0];

    expect(withCustomTags.assignments).toEqual(baseline.assignments);
  });
});
