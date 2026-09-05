import { SCORE_GRADES } from "./scoreGrades";
import type { Student } from "../types";

export type StudentTableSortKey = "name" | "gender" | "className" | "studentNo" | "score" | "height" | "tags";
export type StudentTableSortDirection = "ascending" | "descending";

export interface StudentTableSort {
  key: StudentTableSortKey;
  direction: StudentTableSortDirection;
}

export function nextStudentTableSort(current: StudentTableSort | undefined, key: StudentTableSortKey): StudentTableSort | undefined {
  if (current?.key !== key) return { key, direction: "ascending" };
  if (current.direction === "ascending") return { key, direction: "descending" };
  return undefined;
}

const textCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

const scoreRank = new Map(SCORE_GRADES.map((grade, index) => [grade, index]));

function optionalValue(value: string | number | undefined) {
  return typeof value === "string" ? value.trim() || undefined : value;
}

function valueFor(student: Student, key: StudentTableSortKey): string | number | undefined {
  switch (key) {
    case "name":
      return optionalValue(student.name);
    case "gender":
      return student.gender === "未填写" ? undefined : student.gender;
    case "className":
      return optionalValue(student.className);
    case "studentNo":
      return optionalValue(student.studentNo);
    case "score":
      return student.score ? scoreRank.get(student.score) : undefined;
    case "height":
      return student.height;
    case "tags":
      return optionalValue(student.tags?.join("、"));
  }
}

function compareValues(left: string | number | undefined, right: string | number | undefined) {
  const leftMissing = left === undefined;
  const rightMissing = right === undefined;
  if (leftMissing || rightMissing) {
    if (leftMissing === rightMissing) return 0;
    return leftMissing ? 1 : -1;
  }
  if (typeof left === "number" && typeof right === "number") return left - right;
  return textCollator.compare(String(left), String(right));
}

export function sortStudentsForTable(students: readonly Student[], sort: StudentTableSort | undefined) {
  if (!sort) return [...students];

  return students
    .map((student, originalIndex) => ({ student, originalIndex }))
    .sort((left, right) => {
      const leftValue = valueFor(left.student, sort.key);
      const rightValue = valueFor(right.student, sort.key);
      const compared = compareValues(leftValue, rightValue);

      // Keep incomplete values at the bottom in both directions.
      if (leftValue === undefined || rightValue === undefined) {
        return compared || left.originalIndex - right.originalIndex;
      }

      return (sort.direction === "ascending" ? compared : -compared)
        || left.originalIndex - right.originalIndex;
    })
    .map(({ student }) => student);
}
