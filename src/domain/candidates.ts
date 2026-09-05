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
import { scoreGradeValue } from "./scoreGrades";
import { isSystemStudentTag } from "./studentTags";

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
      const hasKnownGenders = firstStudent?.gender !== "未填写" && candidate?.gender !== "未填写";
      const mixedGender = hasKnownGenders && firstStudent?.gender !== candidate?.gender;
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

function systemTagsForStudent(student?: Student) {
  return (student?.tags ?? []).filter(isSystemStudentTag);
}

function systemTagPenalty(
  order: string[],
  seats: SeatDefinition[],
  studentMap: Map<string, Student>,
  separateGenders: boolean,
  romanceGuard: boolean,
) {
  const regularGroups = [...new Set(seats.filter((seat) => !seat.guardian && seat.group >= 0).map((seat) => seat.group))];
  const countsByTag = new Map<string, Map<number, number>>();
  const studentsByDesk = new Map<string, Student[]>();
  let penalty = 0;

  order.forEach((studentId, index) => {
    const student = studentMap.get(studentId);
    const seat = seats[index];
    if (!student || !seat) return;
    studentsByDesk.set(seat.deskId, [...(studentsByDesk.get(seat.deskId) ?? []), student]);

    const systemTags = systemTagsForStudent(student);
    if (!systemTags.length) return;
    if (seat.guardian || seat.group < 0) penalty += 50_000;
    if (systemTags.includes("视力关注")) penalty += Math.max(0, seat.row) * 1_000;

    systemTags.filter((tag) => tag === "组长候选" || tag.endsWith("优势")).forEach((tag) => {
      const groupCounts = countsByTag.get(tag) ?? new Map<number, number>();
      groupCounts.set(seat.group, (groupCounts.get(seat.group) ?? 0) + 1);
      countsByTag.set(tag, groupCounts);
    });
  });

  countsByTag.forEach((groupCounts) => {
    regularGroups.forEach((group) => {
      const count = groupCounts.get(group) ?? 0;
      penalty += count * count * 200;
    });
  });

  studentsByDesk.forEach((deskStudents) => {
    if (deskStudents.length < 2) return;
    const [first, second] = deskStudents;
    const gendersKnown = first.gender !== "未填写" && second.gender !== "未填写";
    const mixedGender = gendersKnown && first.gender !== second.gender;
    if (separateGenders && mixedGender) penalty += 100_000;
    if (romanceGuard && mixedGender) penalty += ((first.appearance ?? 5) + (second.appearance ?? 5)) * 30;
  });

  return penalty;
}

function arrangeBySystemTags(
  studentIds: string[],
  seats: SeatDefinition[],
  studentMap: Map<string, Student>,
  separateGenders: boolean,
  romanceGuard: boolean,
) {
  if (!studentIds.some((id) => systemTagsForStudent(studentMap.get(id)).length)) return studentIds;

  let current = [...studentIds];
  let currentPenalty = systemTagPenalty(current, seats, studentMap, separateGenders, romanceGuard);
  const maxPasses = Math.min(studentIds.length, 12);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let bestPenalty = currentPenalty;
    let bestSwap: [number, number] | undefined;

    for (let sourceIndex = 0; sourceIndex < current.length; sourceIndex += 1) {
      if (!systemTagsForStudent(studentMap.get(current[sourceIndex])).length) continue;
      for (let targetIndex = 0; targetIndex < current.length; targetIndex += 1) {
        if (sourceIndex === targetIndex) continue;
        [current[sourceIndex], current[targetIndex]] = [current[targetIndex], current[sourceIndex]];
        const candidatePenalty = systemTagPenalty(current, seats, studentMap, separateGenders, romanceGuard);
        [current[sourceIndex], current[targetIndex]] = [current[targetIndex], current[sourceIndex]];
        if (candidatePenalty < bestPenalty) {
          bestPenalty = candidatePenalty;
          bestSwap = [sourceIndex, targetIndex];
        }
      }
    }

    if (!bestSwap) break;
    [current[bestSwap[0]], current[bestSwap[1]]] = [current[bestSwap[1]], current[bestSwap[0]]];
    currentPenalty = bestPenalty;
  }

  return current;
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
  const separateGenders = strategySet.has("gender_separated");
  const metric = (id: string) => {
    const student = studentMap.get(id);
    return scoreGradeValue(student?.score) * weights.score
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
          values.push(normalize(scoreGradeValue(student?.score), 0, 150));
        }
        if (strategySet.has("group_balanced")) {
          const weightTotal = Math.max(weights.score + weights.height + weights.appearance, 1);
          values.push((
            normalize(scoreGradeValue(student?.score), 0, 150) * weights.score
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

    const partnerArranged = arrangeDeskPartners(
      ordered,
      seats.filter((seat) => !seat.disabled),
      studentMap,
      separateGenders,
      strategySet.has("romance_guard"),
    );
    return strategySet.has("tag_balanced")
      ? arrangeBySystemTags(
        partnerArranged,
        seats.filter((seat) => !seat.disabled),
        studentMap,
        separateGenders,
        strategySet.has("romance_guard"),
      )
      : partnerArranged;
  };

  return [generation].map(() => {
    const seed = 731 + generation * 211;
    const variant = Math.abs(generation - 1) % 3;
    const ordered = orderForAlgorithm(studentIds, seed, variant);
    const nextAssignments = seatIds.reduce<AssignmentMap>((result, seatId, seatIndex) => {
      if (ordered[seatIndex]) result[seatId] = ordered[seatIndex];
      return result;
    }, {});
    const constrained = rearrangeAssignments(nextAssignments, seats, constraints, seed);
    const values = ordered.map(metric);
    const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    const spread = values.reduce((sum, value) => sum + Math.abs(value - average), 0) / Math.max(values.length, 1);
    const balanceScore = Math.max(0, Math.round(100 - spread / Math.max(average, 1) * 100));
    const score = Math.max(0, Math.min(99, 84 + Math.round(balanceScore / 10) - constrained.violationCount * 12));
    return {
      id: `candidate-${generation}`,
      label: "方案",
      score,
      assignments: constrained.assignments,
      metrics: {
        algorithm: strategies.join(" + "),
        strategies: [...strategies],
        separateGenders,
        hardRuleViolations: constrained.violationCount,
        balanceScore,
      },
    };
  });
}
