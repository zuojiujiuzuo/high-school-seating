import { describe, expect, it } from "vitest";
import { computeEqualGroupPlacements } from "./layout";

describe("equal classroom group placement", () => {
  it("keeps every interior aisle exactly equal", () => {
    const placements = computeEqualGroupPlacements(4, 1120, 210, 60);
    const gaps = placements.slice(1).map((item, index) => item.x - (placements[index].x + placements[index].width));
    expect(new Set(gaps.map((gap) => gap.toFixed(4))).size).toBe(1);
    expect(placements[0].x).toBe(60);
    expect(placements.at(-1)!.x + placements.at(-1)!.width).toBe(1060);
  });

  it("centers a single group", () => {
    expect(computeEqualGroupPlacements(1, 1000, 200, 80)[0].x).toBe(400);
  });
});
