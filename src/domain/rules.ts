import type {
  AssignmentMap,
  ConstraintType,
  RuleConflict,
  SeatDefinition,
  SeatingConstraint,
  StudentPair,
} from "../types";

const positiveRuleTypes = new Set<ConstraintType>(["desk_mate", "adjacent"]);

export function normalizePair(a: string, b: string): StudentPair {
  return a < b ? { a, b } : { a: b, b: a };
}

export function pairKey(pair: StudentPair): string {
  const normalized = normalizePair(pair.a, pair.b);
  return `${normalized.a}::${normalized.b}`;
}

export function allPairs(studentIds: string[]): StudentPair[] {
  const unique = [...new Set(studentIds)];
  const pairs: StudentPair[] = [];

  for (let left = 0; left < unique.length; left += 1) {
    for (let right = left + 1; right < unique.length; right += 1) {
      pairs.push(normalizePair(unique[left], unique[right]));
    }
  }

  return pairs;
}

export function constraintsForSelectedStudents(
  constraints: SeatingConstraint[],
  selectedStudentIds: string[],
): SeatingConstraint[] {
  if (!constraints.length || !selectedStudentIds.length) return [];

  const selected = new Set(selectedStudentIds);
  return constraints.filter(({ pair }) => selected.has(pair.a) || selected.has(pair.b));
}

export function sequentialPairs(studentIds: string[]): StudentPair[] {
  const unique = [...new Set(studentIds)];
  if (unique.length % 2 !== 0) return [];

  const pairs: StudentPair[] = [];
  for (let index = 0; index < unique.length; index += 2) {
    pairs.push(normalizePair(unique[index], unique[index + 1]));
  }
  return pairs;
}

export function plannedPairCount(type: ConstraintType, selectedCount: number): number {
  if (selectedCount < 2) return 0;
  return positiveRuleTypes.has(type)
    ? Math.floor(selectedCount / 2)
    : (selectedCount * (selectedCount - 1)) / 2;
}

export function buildConstraints(
  type: ConstraintType,
  studentIds: string[],
  explicitPairs?: StudentPair[],
): SeatingConstraint[] {
  const batchId = crypto.randomUUID();
  const pairs = explicitPairs ?? (positiveRuleTypes.has(type) ? sequentialPairs(studentIds) : allPairs(studentIds));

  return pairs.map((pair) => ({
    id: crypto.randomUUID(),
    type,
    pair: normalizePair(pair.a, pair.b),
    hard: true,
    batchId,
    createdAt: Date.now(),
  }));
}

export function findRuleConflicts(constraints: SeatingConstraint[]): RuleConflict[] {
  const byPair = new Map<string, SeatingConstraint[]>();
  constraints.forEach((constraint) => {
    const key = pairKey(constraint.pair);
    byPair.set(key, [...(byPair.get(key) ?? []), constraint]);
  });

  const conflicts: RuleConflict[] = [];
  byPair.forEach((pairConstraints, key) => {
    const types = new Set(pairConstraints.map((constraint) => constraint.type));
    const deskConflict = types.has("desk_mate") && types.has("not_desk_mate");
    const adjacentConflict = types.has("adjacent") && types.has("not_adjacent");
    const deskVersusDistanceConflict = types.has("desk_mate") && types.has("not_adjacent");

    if (deskConflict || adjacentConflict || deskVersusDistanceConflict) {
      conflicts.push({
        pairKey: key,
        constraintIds: pairConstraints.map((constraint) => constraint.id),
        message: deskConflict
          ? "同一对学生不能同时指定同桌和不坐同桌"
          : adjacentConflict
            ? "同一对学生不能同时指定相邻和不相邻"
            : "指定同桌属于相邻关系，不能同时指定不相邻",
      });
    }
  });

  return conflicts;
}

export function areSeatsAdjacent(
  first: { row: number; column: number; group: number; deskId: string },
  second: { row: number; column: number; group: number; deskId: string },
): boolean {
  if (first.deskId === second.deskId) return true;
  if (first.group !== second.group) return false;
  return Math.max(Math.abs(first.row - second.row), Math.abs(first.column - second.column)) === 1;
}

export function isConstraintSatisfied(
  constraint: SeatingConstraint,
  assignments: AssignmentMap,
  seats: SeatDefinition[],
): boolean {
  const seatById = new Map(seats.map((seat) => [seat.id, seat]));
  const seatByStudent = new Map<string, SeatDefinition>();
  Object.entries(assignments).forEach(([seatId, studentId]) => {
    const seat = seatById.get(seatId);
    if (seat && studentId) seatByStudent.set(studentId, seat);
  });

  const first = seatByStudent.get(constraint.pair.a);
  const second = seatByStudent.get(constraint.pair.b);
  if (!first || !second) return false;

  const deskMates = first.deskId === second.deskId;
  const adjacent = areSeatsAdjacent(first, second);
  switch (constraint.type) {
    case "desk_mate":
      return deskMates;
    case "not_desk_mate":
      return !deskMates;
    case "adjacent":
      return adjacent;
    case "not_adjacent":
      return !adjacent;
  }
}

export function countRuleViolations(
  assignments: AssignmentMap,
  seats: SeatDefinition[],
  constraints: SeatingConstraint[],
): number {
  if (!constraints.length) return 0;

  const seatById = new Map(seats.map((seat) => [seat.id, seat]));
  const seatByStudent = new Map<string, SeatDefinition>();
  Object.entries(assignments).forEach(([seatId, studentId]) => {
    const seat = seatById.get(seatId);
    if (seat && studentId) seatByStudent.set(studentId, seat);
  });

  return constraints.reduce((count, constraint) => {
    const first = seatByStudent.get(constraint.pair.a);
    const second = seatByStudent.get(constraint.pair.b);
    if (!first || !second) return count + 1;

    const deskMates = first.deskId === second.deskId;
    const adjacent = areSeatsAdjacent(first, second);
    const satisfied = constraint.type === "desk_mate"
      ? deskMates
      : constraint.type === "not_desk_mate"
        ? !deskMates
        : constraint.type === "adjacent"
          ? adjacent
          : !adjacent;
    return count + (satisfied ? 0 : 1);
  }, 0);
}

export interface RearrangementResult {
  assignments: AssignmentMap;
  violationCount: number;
  movedStudentCount: number;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/**
 * Reorders the current classroom with a deterministic multi-start local search.
 * The search only swaps seats touched by a custom rule, so unrelated students
 * move only when they make room for a constrained student.
 */
export function rearrangeAssignments(
  assignments: AssignmentMap,
  seats: SeatDefinition[],
  constraints: SeatingConstraint[],
  seed = 20260904,
): RearrangementResult {
  const seatIds = seats.filter((seat) => !seat.disabled).map((seat) => seat.id);
  const originalValues = seatIds.map((seatId) => assignments[seatId]);
  const constrainedStudentIds = new Set(
    constraints.flatMap((constraint) => [constraint.pair.a, constraint.pair.b]),
  );

  const seen = new Set(originalValues.filter((studentId): studentId is string => Boolean(studentId)));
  const baseline = [...originalValues];
  constrainedStudentIds.forEach((studentId) => {
    if (seen.has(studentId)) return;
    const emptyIndex = baseline.findIndex((value) => !value);
    if (emptyIndex >= 0) {
      baseline[emptyIndex] = studentId;
      seen.add(studentId);
    }
  });

  const toAssignments = (values: Array<string | undefined>): AssignmentMap => seatIds.reduce<AssignmentMap>(
    (result, seatId, index) => {
      if (values[index]) result[seatId] = values[index];
      return result;
    },
    {},
  );
  const score = (values: Array<string | undefined>) => countRuleViolations(
    toAssignments(values),
    seats,
    constraints,
  );

  if (!constraints.length) {
    return { assignments: toAssignments(baseline), violationCount: 0, movedStudentCount: 0 };
  }

  const random = createSeededRandom(seed);
  let bestValues = [...baseline];
  let bestScore = score(bestValues);

  for (let restart = 0; restart < 14 && bestScore > 0; restart += 1) {
    let current = restart === 0 ? [...baseline] : shuffleWithRandom(baseline, random);
    let currentScore = score(current);
    if (currentScore < bestScore) {
      bestValues = [...current];
      bestScore = currentScore;
    }

    for (let iteration = 0; iteration < seatIds.length && currentScore > 0; iteration += 1) {
      const constrainedIndexes = current
        .map((studentId, index) => studentId && constrainedStudentIds.has(studentId) ? index : -1)
        .filter((index) => index >= 0);
      let nextScore = currentScore;
      let nextSwap: [number, number] | undefined;

      constrainedIndexes.forEach((fromIndex) => {
        for (let toIndex = 0; toIndex < current.length; toIndex += 1) {
          if (fromIndex === toIndex) continue;
          [current[fromIndex], current[toIndex]] = [current[toIndex], current[fromIndex]];
          const candidateScore = score(current);
          [current[fromIndex], current[toIndex]] = [current[toIndex], current[fromIndex]];
          if (candidateScore < nextScore) {
            nextScore = candidateScore;
            nextSwap = [fromIndex, toIndex];
          }
        }
      });

      if (!nextSwap) break;
      const [fromIndex, toIndex] = nextSwap;
      [current[fromIndex], current[toIndex]] = [current[toIndex], current[fromIndex]];
      currentScore = nextScore;
      if (currentScore < bestScore) {
        bestValues = [...current];
        bestScore = currentScore;
      }
    }
  }

  const nextAssignments = toAssignments(bestValues);
  const originalSeatByStudent = new Map<string, string>();
  Object.entries(assignments).forEach(([seatId, studentId]) => {
    if (studentId) originalSeatByStudent.set(studentId, seatId);
  });
  const movedStudentCount = Object.entries(nextAssignments).reduce((count, [seatId, studentId]) => (
    studentId && originalSeatByStudent.get(studentId) !== seatId ? count + 1 : count
  ), 0);

  return {
    assignments: nextAssignments,
    violationCount: bestScore,
    movedStudentCount,
  };
}

export const ruleLabels: Record<ConstraintType, string> = {
  not_desk_mate: "不坐同桌",
  desk_mate: "指定同桌",
  adjacent: "指定相邻",
  not_adjacent: "指定不相邻",
};
