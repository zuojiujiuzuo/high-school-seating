import type { ProjectState, UiFontSize } from "../types";
import { EXAMPLE_CLASS_NAME, initialAssignments, students } from "./mockData";

export const PROJECT_STORAGE_KEY = "banzhen-project-v2";
export const PREFERENCES_STORAGE_KEY = "banzhen-preferences-v1";
export const LEGAL_STORAGE_KEY = "banzhen-legal-notice-v1";
export const SAVED_AT_STORAGE_KEY = "banzhen-project-saved-at-v1";

export const defaultProjectState: ProjectState = {
  students,
  solutionConfirmed: false,
  assignments: initialAssignments,
  constraints: [],
  disabledSeatIds: ["seat-1-4-0", "seat-3-3-1"],
  customSeats: [],
  seatPositions: {},
  aisleWidth: 54,
  podiumPosition: { x: 487, y: 42 },
  layoutPreset: "48-seat",
  layoutConfig: { groups: 4, rows: 6, columns: 2 },
  guardianSides: [],
  doorPlacements: ["front-right"],
};

function scopedKey(prefix: string, className: string, versionName: string) {
  return `${prefix}:${encodeURIComponent(className)}:${encodeURIComponent(versionName)}`;
}

function freshProject(className: string): ProjectState {
  return {
    ...defaultProjectState,
    students: defaultProjectState.students.map((student) => ({ ...student, className })),
    assignments: { ...defaultProjectState.assignments },
    constraints: [],
    disabledSeatIds: [...defaultProjectState.disabledSeatIds],
    customSeats: [],
    seatPositions: {},
    layoutConfig: { ...defaultProjectState.layoutConfig },
    podiumPosition: { ...defaultProjectState.podiumPosition },
    guardianSides: [...defaultProjectState.guardianSides],
    doorPlacements: [...defaultProjectState.doorPlacements],
  };
}

export function createEmptyProjectState(_className: string): ProjectState {
  return {
    ...defaultProjectState,
    students: [],
    assignments: {},
    constraints: [],
    disabledSeatIds: [],
    customSeats: [],
    seatPositions: {},
    layoutConfig: { ...defaultProjectState.layoutConfig },
    podiumPosition: { ...defaultProjectState.podiumPosition },
    guardianSides: [],
    doorPlacements: [...defaultProjectState.doorPlacements],
  };
}

export function saveProjectState(className: string, versionName: string, project: ProjectState) {
  const savedAt = new Date().toISOString();
  window.localStorage.setItem(scopedKey(PROJECT_STORAGE_KEY, className, versionName), JSON.stringify(project));
  window.localStorage.setItem(scopedKey(SAVED_AT_STORAGE_KEY, className, versionName), savedAt);
  return savedAt;
}

export function deleteProjectState(className: string, versionName: string) {
  window.localStorage.removeItem(scopedKey(PROJECT_STORAGE_KEY, className, versionName));
  window.localStorage.removeItem(scopedKey(SAVED_AT_STORAGE_KEY, className, versionName));
  if (className === EXAMPLE_CLASS_NAME && versionName === "日常换位 · 第4期") {
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
  }
}

export function loadSavedAt(className: string, versionName: string) {
  const value = window.localStorage.getItem(scopedKey(SAVED_AT_STORAGE_KEY, className, versionName));
  return value ? new Date(value) : undefined;
}

export function loadProjectState(className = EXAMPLE_CLASS_NAME, versionName = "日常换位 · 第4期"): ProjectState {
  try {
    const scoped = window.localStorage.getItem(scopedKey(PROJECT_STORAGE_KEY, className, versionName));
    const legacy = className === EXAMPLE_CLASS_NAME && versionName === "日常换位 · 第4期"
      ? window.localStorage.getItem(PROJECT_STORAGE_KEY)
      : null;
    const raw = scoped ?? legacy;
    if (!raw) return freshProject(className);
    const stored = JSON.parse(raw) as Partial<ProjectState> & { doorPlacement?: ProjectState["doorPlacements"][number] };
    const guardianSides = Array.isArray(stored.guardianSides)
      ? (["left", "right"] as const).filter((side) => stored.guardianSides?.includes(side))
      : [];
    const doorPlacements = Array.isArray(stored.doorPlacements)
      ? (["front-left", "front-right", "back-left", "back-right"] as const).filter((placement) => stored.doorPlacements?.includes(placement))
      : stored.doorPlacement
        ? [stored.doorPlacement]
        : [...defaultProjectState.doorPlacements];
    return {
      ...freshProject(className),
      ...stored,
      students: Array.isArray(stored.students) ? stored.students : freshProject(className).students,
      layoutConfig: { ...defaultProjectState.layoutConfig, ...stored.layoutConfig },
      guardianSides,
      doorPlacements,
    };
  } catch {
    return freshProject(className);
  }
}

export interface Preferences {
  reducedMotion: boolean;
  showShortcutHints: boolean;
  autoLock: boolean;
  fontSize: UiFontSize;
}

export function loadPreferences(): Preferences {
  try {
    return {
      reducedMotion: false,
      showShortcutHints: true,
      autoLock: false,
      fontSize: "auto",
      ...JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}"),
    };
  } catch {
    return { reducedMotion: false, showShortcutHints: true, autoLock: false, fontSize: "auto" };
  }
}
