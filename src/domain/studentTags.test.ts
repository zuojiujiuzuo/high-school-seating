import { describe, expect, it } from "vitest";
import { isSystemStudentTag, systemStudentTags } from "./studentTags";

describe("student system tags", () => {
  it("recognizes only the built-in tags used by the seating strategy", () => {
    expect(systemStudentTags).toEqual([
      "视力关注",
      "组长候选",
      "语文优势",
      "数学优势",
      "英语优势",
      "物理优势",
      "化学优势",
      "生物优势",
    ]);
    expect(systemStudentTags.every(isSystemStudentTag)).toBe(true);
  });

  it.each(["自定义优势", "重点关注", "需要鼓励", "靠窗"])("does not treat custom tag %s as a system tag", (tag) => {
    expect(isSystemStudentTag(tag)).toBe(false);
  });
});
