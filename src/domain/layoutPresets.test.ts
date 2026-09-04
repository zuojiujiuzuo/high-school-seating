import { describe, expect, it } from "vitest";
import { createPresetSeats, getLayoutPreset } from "./layoutPresets";

describe("layout presets", () => {
  it.each([
    ["48-seat", 48, 4],
    ["54-seat", 54, 3],
    ["60-seat", 60, 5],
    ["exam", 48, 6],
    ["paired", 48, 6],
    ["blank", 0, 0],
  ] as const)("builds %s with the expected capacity and groups", (id, capacity, groups) => {
    const seats = createPresetSeats(id);
    expect(seats).toHaveLength(capacity);
    expect(new Set(seats.map((seat) => seat.group)).size).toBe(groups);
  });

  it("keeps exam seats as one-person desks", () => {
    const seats = createPresetSeats("exam");
    expect(getLayoutPreset("exam").columns).toBe(1);
    expect(seats.every((seat) => seat.column === 0)).toBe(true);
  });
});
