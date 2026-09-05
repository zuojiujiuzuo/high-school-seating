export function parseStudentTags(value: unknown) {
  if (value == null) return [];
  const tags = String(value)
    .split(/[、,，;；|\n\r]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(tags)];
}
