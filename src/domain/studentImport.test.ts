import { describe, expect, it } from "vitest";
import { parseStudentTags } from "./studentImport";

describe("student tag import", () => {
  it("splits common Chinese and English separators and removes duplicates", () => {
    expect(parseStudentTags("组长候选、视力关注, 体育委员；组长候选")).toEqual([
      "组长候选",
      "视力关注",
      "体育委员",
    ]);
  });

  it("returns no tags for an empty cell", () => {
    expect(parseStudentTags("  ")).toEqual([]);
    expect(parseStudentTags(null)).toEqual([]);
  });
});
