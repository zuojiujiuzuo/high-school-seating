import type {
  AssignmentMap,
  GenerationOptions,
  GenerationStrategy,
  GenerationWeights,
  SeatDefinition,
  SeatingCandidate,
  SeatingConstraint,
  Student,
} from "../types";
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

function normalize(value: number, min: number, max: number) {
  return (value - min) / Math.max(max - min, 1);
}

function arrangeDeskPartners(
  studentIds: string[],
  seats: SeatDefinition[],
  studentMap: Map<string, Student>,
  separateGenders: boolean,
  romanceGuard: boolean,
) {
  if (!separateGenders && !romanceGuard) return studentIds;

  const remaining = [...studentIds];
  const result: string[] = [];
  for (let seatIndex = 0; seatIndex < seats.length && remaining.length; seatIndex += 1) {
    const first = remaining.shift();
    if (!first) break;
    result.push(first);

    const nextSeat = seats[seatIndex + 1];
    if (!nextSeat || nextSeat.deskId !== seats[seatIndex].deskId || !remaining.length) continue;

    const firstStudent = studentMap.get(first);
    let partnerIndex = 0;
    let partnerPenalty = Number.POSITIVE_INFINITY;
    remaining.forEach((candidateId, candidateIndex) => {
      const candidate = studentMap.get(candidateId);
      const mixedGender = firstStudent?.gender !== candidate?.gender;
      const separationPenalty = separateGenders && mixedGender ? 10_000 : 0;
      const romancePenalty = romanceGuard && mixedGender
        ? ((firstStudent?.appearance ?? 5) + (candidate?.appearance ?? 5)) * 3
        : 0;
      const penalty = separationPenalty + romancePenalty + candidateIndex;
      if (penalty < partnerPenalty) {
        partnerPenalty = penalty;
        partnerIndex = candidateIndex;
      }
    });
    result.push(remaining.splice(partnerIndex, 1)[0]);
    seatIndex += 1;
  }
  return [...result, ...remaining];
}

export function createCandidates(
  assignments: AssignmentMap,
  seats: SeatDefinition[],
  constraints: SeatingConstraint[],
  students: Student[],
  options: GenerationOptions,
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
  const strategies: GenerationStrategy[] = options.strategies.length ? options.strategies : ["random"];
  const strategySet = new Set(strategies);
  const metric = (id: string) => {
    const student = studentMap.get(id);
    return (student?.score ?? 110) * weights.score
      + (student?.height ?? 168) * weights.height
      + (student?.appearance ?? 5) * weights.appearance;
  };
  const orderForAlgorithm = (ids: string[], seed: number, variant: number) => {
    const shuffled = seededShuffle(ids, seed);
    let ordered = shuffled;
    const usesMeasuredStrategy = strategySet.has("height")
      || strategySet.has("score_spread")
      || strategySet.has("group_balanced");

    if (usesMeasuredStrategy) {
      const combinedMetric = (id: string) => {
        const student = studentMap.get(id);
        const values: number[] = [];
        if (strategySet.has("score_spread")) {
          values.push(normalize(student?.score ?? 110, 0, 150));
        }
        if (strategySet.has("group_balanced")) {
          const weightTotal = Math.max(weights.score + weights.height + weights.appearance, 1);
          values.push((
            normalize(student?.score ?? 110, 0, 150) * weights.score
            + normalize(student?.height ?? 168, 140, 200) * weights.height
            + normalize(student?.appearance ?? 5, 1, 10) * weights.appearance
          ) / weightTotal);
        }
        if (strategySet.has("height")) {
          values.push(normalize(student?.height ?? 168, 140, 200));
        }
        return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
      };
      const sorted = shuffled.sort((a, b) => combinedMetric(a) - combinedMetric(b));
      const varied = varyNearbyRanks(sorted, variant);
      ordered = strategySet.has("height") ? varied : alternateExtremes(varied);
    }

    return arrangeDeskPartners(
      ordered,
      seats.filter((seat) => !seat.disabled),
      studentMap,
      options.separateGenders,
      strategySet.has("romance_guard"),
    );
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
      metrics: {
        algorithm: strategies.join(" + "),
        strategies: [...strategies],
        separateGenders: options.separateGenders,
        hardRuleViolations: constrained.violationCount,
        balanceScore,
      },
    };
  });
}
