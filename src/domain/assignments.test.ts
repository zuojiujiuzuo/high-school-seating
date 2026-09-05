import { describe, expect, it } from "vitest";
import { moveAssignmentGroup } from "./assignments";

describe("moveAssignmentGroup", () => {
  it("swaps a selected block with the occupied destination block", () => {
    expect(moveAssignmentGroup(
      { a: "student-a", b: "student-b", c: "student-c", d: "student-d" },
      ["a", "b"],
      ["c", "d"],
    )).toEqual({
      a: "student-c",
      b: "student-d",
      c: "student-a",
      d: "student-b",
    });
  });

  it("rotates assignments when the source and destination overlap", () => {
    expect(moveAssignmentGroup(
      { a: "student-a", b: "student-b", c: "student-c" },
      ["a", "b"],
      ["b", "c"],
    )).toEqual({
      a: "student-c",
      b: "student-a",
      c: "student-b",
    });
  });

  it("keeps an empty destination paired with an empty source", () => {
    expect(moveAssignmentGroup(
      { a: "student-a", b: "student-b", c: "student-c" },
      ["a", "b"],
      ["c", "d"],
    )).toEqual({
      a: "student-c",
      c: "student-a",
      d: "student-b",
    });
  });
});
