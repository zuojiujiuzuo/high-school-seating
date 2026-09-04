import { describe, expect, it } from "vitest";
import {
  allPairs,
  areSeatsAdjacent,
  countRuleViolations,
  findRuleConflicts,
  normalizePair,
  plannedPairCount,
  rearrangeAssignments,
  sequentialPairs,
} from "./rules";
import type { AssignmentMap, SeatDefinition, SeatingConstraint } from "../types";

function constraint(type: SeatingConstraint["type"], a = "a", b = "b"): SeatingConstraint {
  return {
    id: `${type}-${a}-${b}`,
    type,
    pair: normalizePair(a, b),
    hard: true,
    batchId: type,
    createdAt: 1,
  };
}

describe("custom seating rules", () => {
  it("expands four selected students into six pairwise negative rules", () => {
    expect(allPairs(["a", "b", "c", "d"])).toHaveLength(6);
    expect(plannedPairCount("not_adjacent", 4)).toBe(6);
  });

  it("requires an even number for positive guided pairing", () => {
    expect(sequentialPairs(["a", "b", "c"])).toEqual([]);
    expect(sequentialPairs(["a", "b", "c", "d"])).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
    ]);
  });

  it("detects direct and implied adjacency conflicts", () => {
    expect(findRuleConflicts([constraint("desk_mate"), constraint("not_desk_mate")])).toHaveLength(1);
    expect(findRuleConflicts([constraint("adjacent"), constraint("not_adjacent")])).toHaveLength(1);
    expect(findRuleConflicts([constraint("desk_mate"), constraint("not_adjacent")])).toHaveLength(1);
  });

  it("treats desk mates and eight-direction neighbors as adjacent", () => {
    expect(areSeatsAdjacent(
      { group: 0, row: 0, column: 0, deskId: "desk-a" },
      { group: 0, row: 0, column: 1, deskId: "desk-a" },
    )).toBe(true);
    expect(areSeatsAdjacent(
      { group: 0, row: 0, column: 0, deskId: "desk-a" },
      { group: 0, row: 1, column: 1, deskId: "desk-b" },
    )).toBe(true);
    expect(areSeatsAdjacent(
      { group: 0, row: 0, column: 1, deskId: "desk-a" },
      { group: 1, row: 0, column: 0, deskId: "desk-b" },
    )).toBe(false);
  });

  it("rearranges the canvas so saved custom rules affect real seats", () => {
    const seats: SeatDefinition[] = Array.from({ length: 2 }, (_, group) =>
      Array.from({ length: 2 }, (__, row) =>
        Array.from({ length: 2 }, (___, column) => ({
          id: `seat-${group}-${row}-${column}`,
          group,
          row,
          column,
          deskId: `desk-${group}-${row}`,
        })),
      ).flat(),
    ).flat();
    const assignments: AssignmentMap = Object.fromEntries(
      seats.map((seat, index) => [seat.id, `student-${index + 1}`]),
    );
    const constraints = [
      constraint("desk_mate", "student-1", "student-8"),
      constraint("not_adjacent", "student-2", "student-3"),
    ];

    expect(countRuleViolations(assignments, seats, constraints)).toBeGreaterThan(0);
    const result = rearrangeAssignments(assignments, seats, constraints, 42);
    expect(result.violationCount).toBe(0);
    expect(countRuleViolations(result.assignments, seats, constraints)).toBe(0);
    expect(result.movedStudentCount).toBeGreaterThan(0);
  });
});
