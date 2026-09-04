import { describe, expect, it } from "vitest";
import { createGuardianSeats, createPresetSeats, getLayoutPreset } from "./layoutPresets";

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

  it("creates optional ordinary seats on either side of the podium", () => {
    const seats = createGuardianSeats(["right", "left"]);

    expect(seats.map((seat) => seat.guardian)).toEqual(["left", "right"]);
    expect(seats.map((seat) => seat.id)).toEqual(["seat-guardian-left", "seat-guardian-right"]);
    expect(new Set(seats.map((seat) => seat.deskId)).size).toBe(2);
  });
});
