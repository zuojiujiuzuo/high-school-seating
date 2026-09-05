import { describe, expect, it } from "vitest";
import { inferLegacyScoreMaximum, normalizeStoredScoreGrade, parseScoreGrade, scoreGradeValue } from "./scoreGrades";

describe("score grades", () => {
  it("accepts only A through D as editable grades", () => {
    expect(parseScoreGrade("a")).toBe("A");
    expect(parseScoreGrade("D")).toBe("D");
    expect(parseScoreGrade("95")).toBeUndefined();
    expect(parseScoreGrade("E")).toBeUndefined();
  });

  it("migrates legacy numeric scores without losing their relative band", () => {
    const maximum = inferLegacyScoreMaximum([135, 112, 95, 55]);
    expect(maximum).toBe(150);
    expect(normalizeStoredScoreGrade(135, maximum)).toBe("A");
    expect(normalizeStoredScoreGrade(112, maximum)).toBe("B");
    expect(normalizeStoredScoreGrade(95, maximum)).toBe("C");
    expect(normalizeStoredScoreGrade(55, maximum)).toBe("D");
    expect(normalizeStoredScoreGrade(95, inferLegacyScoreMaximum([95, 80, 72]))).toBe("A");
  });

  it("keeps grade order available to seating calculations", () => {
    expect(scoreGradeValue("A")).toBeGreaterThan(scoreGradeValue("B"));
    expect(scoreGradeValue("B")).toBeGreaterThan(scoreGradeValue("C"));
    expect(scoreGradeValue("C")).toBeGreaterThan(scoreGradeValue("D"));
  });
});
