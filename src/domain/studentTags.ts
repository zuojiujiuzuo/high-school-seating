export const systemStudentTagGroups = [
  { label: "常用", tags: ["视力关注", "组长候选"] },
  { label: "学科优势", tags: ["语文优势", "数学优势", "英语优势", "物理优势", "化学优势", "生物优势"] },
] as const;

export const systemStudentTags = systemStudentTagGroups.flatMap((group) => group.tags);

const systemStudentTagSet: ReadonlySet<string> = new Set(systemStudentTags);

export function isSystemStudentTag(tag: string) {
  return systemStudentTagSet.has(tag);
}
