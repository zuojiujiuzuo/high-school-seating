import type { AssignmentMap, GenerationWeights, SeatDefinition, SeatingCandidate, SeatingConstraint, Student } from "../types";
import { rearrangeAssignments } from "./rules";

function seededShuffle<T>(items: T[], seed: number) {
  const result = [...items];
  let value = seed;
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const swapIndex = Math.floor((value / 233280) * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function alternateExtremes(items: string[]) {
  const result: string[] = [];
  let start = 0;
  let end = items.length - 1;
  while (start <= end) {
    result.push(items[start]);
    if (start !== end) result.push(items[end]);
    start += 1;
    end -= 1;
  }
  return result;
}

function varyNearbyRanks(items: string[], variant: number) {
  if (variant === 0 || items.length < 2) return [...items];

  const result: string[] = [];
  for (let start = 0; start < items.length; start += 3) {
    const cohort = items.slice(start, start + 3);
    const offset = variant % cohort.length;
    result.push(...cohort.slice(offset), ...cohort.slice(0, offset));
  }
  return result;
}

export function createCandidates(
  assignments: AssignmentMap,
  seats: SeatDefinition[],
  constraints: SeatingConstraint[],
  students: Student[],
  algorithm: string,
  weights: GenerationWeights,
  generation: number,
): SeatingCandidate[] {
  const seatIds = seats.filter((seat) => !seat.disabled).map((seat) => seat.id);
  const assignedStudentIds = seatIds.map((seatId) => assignments[seatId]).filter((id): id is string => Boolean(id));
  const assignedSet = new Set(assignedStudentIds);
  const studentIds = [
    ...assignedStudentIds,
    ...students.filter((student) => !assignedSet.has(student.id)).map((student) => student.id),
  ].slice(0, seatIds.length);
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const metric = (id: string) => {
    const student = studentMap.get(id);
    return (student?.score ?? 110) * weights.score
      + (student?.height ?? 168) * weights.height
      + (student?.appearance ?? 5) * weights.appearance;
  };
  const orderForAlgorithm = (ids: string[], seed: number, variant: number) => {
    const shuffled = seededShuffle(ids, seed);
    if (algorithm === "random") return shuffled;
    if (algorithm === "height") {
      const sorted = shuffled.sort((a, b) => (studentMap.get(a)?.height ?? 168) - (studentMap.get(b)?.height ?? 168));
      return varyNearbyRanks(sorted, variant);
    }
    if (algorithm === "score_spread") {
      const sorted = shuffled.sort((a, b) => (studentMap.get(a)?.score ?? 110) - (studentMap.get(b)?.score ?? 110));
      return alternateExtremes(varyNearbyRanks(sorted, variant));
    }
    if (algorithm === "romance_guard" || algorithm === "height_romance") {
      const sorted = algorithm === "height_romance"
        ? shuffled.sort((a, b) => (studentMap.get(a)?.height ?? 168) - (studentMap.get(b)?.height ?? 168))
        : shuffled;
      const boys = varyNearbyRanks(sorted.filter((id) => studentMap.get(id)?.gender === "男"), variant);
      const girls = varyNearbyRanks(sorted.filter((id) => studentMap.get(id)?.gender === "女"), variant);
      return Array.from({ length: Math.max(boys.length, girls.length) }, (_, index) => [boys[index], girls[index]])
        .flat()
        .filter((id): id is string => Boolean(id));
    }
    const sorted = shuffled.sort((a, b) => metric(a) - metric(b));
    return alternateExtremes(varyNearbyRanks(sorted, variant));
  };

  return [0, 1, 2].map((index) => {
    const seed = 731 + generation * 211 + index * 97;
    const ordered = orderForAlgorithm(studentIds, seed, index);
    const nextAssignments = seatIds.reduce<AssignmentMap>((result, seatId, seatIndex) => {
      if (ordered[seatIndex]) result[seatId] = ordered[seatIndex];
      return result;
    }, {});
    const constrained = rearrangeAssignments(nextAssignments, seats, constraints, seed);
    const values = ordered.map(metric);
    const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    const spread = values.reduce((sum, value) => sum + Math.abs(value - average), 0) / Math.max(values.length, 1);
    const balanceScore = Math.max(0, Math.round(100 - spread / Math.max(average, 1) * 100));
    const score = Math.max(0, Math.min(99, 84 + index * 3 + Math.round(balanceScore / 10) - constrained.violationCount * 12));
    return {
      id: `candidate-${generation}-${index}`,
      label: `方案 ${String.fromCharCode(65 + index)}`,
      score,
      assignments: constrained.assignments,
      metrics: { algorithm, hardRuleViolations: constrained.violationCount, balanceScore },
    };
  });
}
