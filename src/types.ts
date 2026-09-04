export type Gender = "男" | "女";

export interface Student {
  id: string;
  name: string;
  gender: Gender;
  className: string;
  studentNo?: string;
  score?: number;
  height?: number;
  appearance?: number;
  notes?: string;
  tags?: string[];
}

export interface SeatDefinition {
  id: string;
  group: number;
  row: number;
  column: number;
  deskId: string;
  disabled?: boolean;
  /** Optional free-form canvas position used by the layout editor. */
  canvasX?: number;
  canvasY?: number;
  guardian?: "left" | "right";
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export type AssignmentMap = Record<string, string | undefined>;

export type ConstraintType =
  | "not_desk_mate"
  | "desk_mate"
  | "adjacent"
  | "not_adjacent";

export interface StudentPair {
  a: string;
  b: string;
}

export interface SeatingConstraint {
  id: string;
  type: ConstraintType;
  pair: StudentPair;
  hard: true;
  batchId: string;
  createdAt: number;
}

export interface ProjectState {
  students: Student[];
  solutionConfirmed: boolean;
  assignments: AssignmentMap;
  constraints: SeatingConstraint[];
  disabledSeatIds: string[];
  customSeats: SeatDefinition[];
  seatPositions: Record<string, CanvasPoint>;
  aisleWidth: number;
  podiumPosition: CanvasPoint;
  layoutPreset: LayoutPresetId;
  layoutConfig: LayoutConfig;
  doorPlacement: DoorPlacement;
}

export type WizardStep = "roster" | "layout" | "rules" | "generate" | "export";

export type LayoutPresetId = "48-seat" | "54-seat" | "60-seat" | "exam" | "paired" | "blank";

export type DoorPlacement = "front-left" | "front-right" | "back-left" | "back-right";

export type AppTheme = "minimal" | "cute";

export interface LayoutConfig {
  groups: number;
  rows: number;
  columns: 1 | 2;
}

export interface GenerationWeights {
  score: number;
  height: number;
  appearance: number;
}

export interface SeatingCandidate {
  id: string;
  label: string;
  score: number;
  assignments: AssignmentMap;
  metrics?: {
    algorithm: string;
    hardRuleViolations: number;
    balanceScore: number;
  };
}

export interface RuleConflict {
  pairKey: string;
  constraintIds: string[];
  message: string;
}
