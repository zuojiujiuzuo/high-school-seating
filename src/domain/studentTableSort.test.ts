import { describe, expect, it } from "vitest";
import type { Student } from "../types";
import { nextStudentTableSort, sortStudentsForTable } from "./studentTableSort";

const students: Student[] = [
  { id: "1", name: "学生10", gender: "男", className: "高二10班", studentNo: "10", score: "C", height: 181, tags: ["体育委员"] },
  { id: "2", name: "学生2", gender: "女", className: "高二2班", studentNo: "2", score: "A", height: 158, tags: ["视力关注"] },
  { id: "3", name: "学生20", gender: "未填写", className: "", tags: [] },
];

describe("student table sorting", () => {
  it("cycles from ascending to descending and then back to the default order", () => {
    const ascending = nextStudentTableSort(undefined, "height");
    const descending = nextStudentTableSort(ascending, "height");

    expect(ascending).toEqual({ key: "height", direction: "ascending" });
    expect(descending).toEqual({ key: "height", direction: "descending" });
    expect(nextStudentTableSort(descending, "height")).toBeUndefined();
    expect(sortStudentsForTable(students, undefined)).toEqual(students);
  });

  it("uses natural ordering for text and student numbers", () => {
    expect(sortStudentsForTable(students, { key: "name", direction: "ascending" }).map((student) => student.id))
      .toEqual(["2", "1", "3"]);
    expect(sortStudentsForTable(students, { key: "studentNo", direction: "descending" }).map((student) => student.id))
      .toEqual(["1", "2", "3"]);
  });

  it("sorts grades and numeric heights in both directions", () => {
    expect(sortStudentsForTable(students, { key: "score", direction: "ascending" }).map((student) => student.id))
      .toEqual(["2", "1", "3"]);
    expect(sortStudentsForTable(students, { key: "height", direction: "descending" }).map((student) => student.id))
      .toEqual(["1", "2", "3"]);
  });

  it("keeps incomplete values at the bottom", () => {
    expect(sortStudentsForTable(students, { key: "gender", direction: "ascending" }).at(-1)?.id).toBe("3");
    expect(sortStudentsForTable(students, { key: "className", direction: "descending" }).at(-1)?.id).toBe("3");
    expect(sortStudentsForTable(students, { key: "tags", direction: "descending" }).at(-1)?.id).toBe("3");
  });
});
