export const systemStudentTagGroups = [
  { label: "常用", tags: ["视力关注", "组长候选", "学科优势"] },
] as const;

export const systemStudentTags = systemStudentTagGroups.flatMap((group) => group.tags);

const systemStudentTagSet: ReadonlySet<string> = new Set(systemStudentTags);

export function isSystemStudentTag(tag: string) {
  return systemStudentTagSet.has(tag);
}
