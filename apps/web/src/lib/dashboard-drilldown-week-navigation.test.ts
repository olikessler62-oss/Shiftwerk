import { describe, expect, it } from "vitest";
import {
  planDashboardDrilldownWeekTransition,
  resolveDashboardDrilldownDayIndex,
} from "./dashboard-drilldown-week-navigation";

const CURRENT_WEEK = "2026-06-23";
const NEXT_WEEK = "2026-06-30";

describe("resolveDashboardDrilldownDayIndex", () => {
  it("keeps the selected day in the current week", () => {
    expect(resolveDashboardDrilldownDayIndex("day", 6)).toBe(6);
  });

  it("keeps the selected day in other weeks too", () => {
    expect(resolveDashboardDrilldownDayIndex("day", 6)).toBe(6);
    expect(resolveDashboardDrilldownDayIndex("area", 3)).toBe(3);
  });

  it("returns null in week overview", () => {
    expect(resolveDashboardDrilldownDayIndex("week", 6)).toBeNull();
  });
});

describe("planDashboardDrilldownWeekTransition", () => {
  it("saves current-week drilldown and switches to Monday when leaving", () => {
    const plan = planDashboardDrilldownWeekTransition({
      previousWeekStart: CURRENT_WEEK,
      nextWeekStart: NEXT_WEEK,
      currentWeekStart: CURRENT_WEEK,
      view: { level: "day", dayIndex: 6 },
      areaDetailScopeByAreaId: { area1: "week" },
      savedSnapshot: null,
    });

    expect(plan).toEqual({
      savedSnapshot: {
        dayIndex: 6,
        areaDetailScopeByAreaId: { area1: "week" },
      },
      nextDayIndex: 0,
    });
  });

  it("uses today in the current week when returning from another week", () => {
    const savedSnapshot = {
      dayIndex: 6,
      areaDetailScopeByAreaId: { area1: "day" },
    };

    const plan = planDashboardDrilldownWeekTransition({
      previousWeekStart: NEXT_WEEK,
      nextWeekStart: CURRENT_WEEK,
      currentWeekStart: CURRENT_WEEK,
      view: { level: "day", dayIndex: 0 },
      areaDetailScopeByAreaId: {},
      savedSnapshot,
      currentWeekTodayDayIndex: 2,
    });

    expect(plan).toEqual({
      savedSnapshot,
      nextDayIndex: 2,
      restoreAreaScopes: { area1: "day" },
    });
  });

  it("falls back to saved drilldown day when today is outside the week", () => {
    const savedSnapshot = {
      dayIndex: 6,
      areaDetailScopeByAreaId: { area1: "week" },
    };

    const plan = planDashboardDrilldownWeekTransition({
      previousWeekStart: NEXT_WEEK,
      nextWeekStart: CURRENT_WEEK,
      currentWeekStart: CURRENT_WEEK,
      view: { level: "day", dayIndex: 0 },
      areaDetailScopeByAreaId: {},
      savedSnapshot,
      currentWeekTodayDayIndex: null,
    });

    expect(plan).toEqual({
      savedSnapshot,
      nextDayIndex: 6,
      restoreAreaScopes: { area1: "week" },
    });
  });

  it("anchors to Monday when moving between non-current weeks", () => {
    const plan = planDashboardDrilldownWeekTransition({
      previousWeekStart: NEXT_WEEK,
      nextWeekStart: "2026-07-07",
      currentWeekStart: CURRENT_WEEK,
      view: { level: "day", dayIndex: 0 },
      areaDetailScopeByAreaId: {},
      savedSnapshot: null,
    });

    expect(plan).toEqual({
      savedSnapshot: null,
      nextDayIndex: 0,
    });
  });
});
