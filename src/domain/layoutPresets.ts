import type { LayoutConfig, LayoutPresetId, SeatDefinition } from "../types";

export interface LayoutPresetDefinition {
  id: LayoutPresetId;
  label: string;
  groups: number;
  rows: number;
  columns: 0 | 1 | 2;
}

export const layoutPresets: LayoutPresetDefinition[] = [
  { id: "48-seat", label: "48 座 · 四大组", groups: 4, rows: 6, columns: 2 },
  { id: "54-seat", label: "54 座 · 三大组", groups: 3, rows: 9, columns: 2 },
  { id: "60-seat", label: "60 座 · 五大组", groups: 5, rows: 6, columns: 2 },
  { id: "exam", label: "考试单列", groups: 6, rows: 8, columns: 1 },
  { id: "paired", label: "双人桌分组", groups: 6, rows: 4, columns: 2 },
  { id: "blank", label: "空白自定义", groups: 0, rows: 0, columns: 0 },
];

export function getLayoutPreset(id: LayoutPresetId) {
  return layoutPresets.find((preset) => preset.id === id) ?? layoutPresets[0];
}

export function createPresetSeats(id: LayoutPresetId): SeatDefinition[] {
  const preset = getLayoutPreset(id);
  if (preset.columns === 0 || preset.groups === 0 || preset.rows === 0) return [];
  return createGridSeats({ groups: preset.groups, rows: preset.rows, columns: preset.columns });
}

export function createGridSeats(config: LayoutConfig): SeatDefinition[] {
  return Array.from({ length: config.groups }, (_, group) =>
    Array.from({ length: config.rows }, (__, row) =>
      Array.from({ length: config.columns }, (___, column) => ({
        id: `seat-${group}-${row}-${column}`,
        group,
        row,
        column,
        deskId: config.columns === 1 ? `desk-${group}-${row}-single` : `desk-${group}-${row}`,
      })),
    ).flat(),
  ).flat();
}
