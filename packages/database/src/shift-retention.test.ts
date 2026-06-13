import { describe, expect, it } from "vitest";
import {
  clampShiftQueryFromDate,
  earliestPlanningWeekStartISO,
  resolvePlanningWeekStart,
  shiftHotCutoffISO,
  shiftPurgeCutoffISO,
} from "./shift-retention";

const REF = new Date(2026, 5, 5); // 2026-06-05

describe("shiftHotCutoffISO", () => {
  it("returns date 13 months before reference", () => {
    expect(shiftHotCutoffISO(REF)).toBe("2025-05-05");
  });
});

describe("earliestPlanningWeekStartISO", () => {
  it("returns monday of week containing hot cutoff", () => {
    expect(earliestPlanningWeekStartISO(REF)).toBe("2025-05-05");
  });

  it("returns monday of week containing hot cutoff when cutoff is mid-week", () => {
    const ref = new Date(2026, 5, 11); // 2026-06-11 → cutoff 2025-05-11 (Sun)
    expect(earliestPlanningWeekStartISO(ref)).toBe("2025-05-05");
  });
});

describe("resolvePlanningWeekStart", () => {
  it("clamps week before earliest allowed", () => {
    const result = resolvePlanningWeekStart("2024-01-01", REF);
    expect(result.clamped).toBe(true);
    expect(result.weekStart).toBe("2025-05-05");
  });

  it("keeps allowed week", () => {
    const result = resolvePlanningWeekStart("2026-06-02", REF);
    expect(result.clamped).toBe(false);
    expect(result.weekStart).toBe("2026-06-02");
  });
});

describe("shiftPurgeCutoffISO", () => {
  it("returns date 25 months before reference", () => {
    expect(shiftPurgeCutoffISO(REF)).toBe("2024-05-05");
  });
});

describe("clampShiftQueryFromDate", () => {
  it("raises from to cutoff when too old", () => {
    expect(clampShiftQueryFromDate("2020-01-01", REF)).toBe("2025-05-05");
  });

  it("keeps from when within window", () => {
    expect(clampShiftQueryFromDate("2026-06-01", REF)).toBe("2026-06-01");
  });
});
