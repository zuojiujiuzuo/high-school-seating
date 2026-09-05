import type { ScoreGrade } from "../types";

export const SCORE_GRADES = ["A", "B", "C", "D"] as const satisfies readonly ScoreGrade[];

export function parseScoreGrade(value: unknown): ScoreGrade | undefined {
  const normalized = String(value ?? "").trim().toLocaleUpperCase();
  return SCORE_GRADES.includes(normalized as ScoreGrade) ? normalized as ScoreGrade : undefined;
}

export function inferLegacyScoreMaximum(values: readonly unknown[]) {
  const numericValues = values
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => typeof value === "number" ? value : Number(String(value).trim()))
    .filter((value) => Number.isFinite(value));
  const highest = Math.max(0, ...numericValues);
  return highest > 150 ? 750 : highest <= 100 ? 100 : 150;
}

export function normalizeStoredScoreGrade(value: unknown, maximum = 150): ScoreGrade | undefined {
  const grade = parseScoreGrade(value);
  if (grade) return grade;
  if (value == null || String(value).trim() === "") return undefined;

  const numeric = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric)) return undefined;
  const ratio = numeric / maximum;
  if (ratio >= 0.85) return "A";
  if (ratio >= 0.7) return "B";
  if (ratio >= 0.6) return "C";
  return "D";
}

export function scoreGradeValue(grade: ScoreGrade | undefined) {
  return grade === "A" ? 135 : grade === "B" ? 115 : grade === "C" ? 90 : grade === "D" ? 60 : 110;
}
