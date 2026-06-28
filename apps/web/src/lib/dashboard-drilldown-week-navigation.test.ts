import { describe, expect, it } from "vitest";
import {
  planDashboardDrilldownWeekTransition,
  resolveDashboardDrilldownDayIndex,
} from "./dashboard-drilldown-week-navigation";

const CURRENT_WEEK = "2026-06-23";
const NEXT_WEEK = "2026-06-30";

describe("resolveDashboardDrilldownDayIndex", () => {
  it("keeps the selected day in the current week", () => {
    expect(resolveDashboardDrilldownDayIndex("day", 6, true)).toBe(6);
  });

  it("uses Monday for drilldown in other weeks", () => {
    expect(resolveDashboardDrilldownDayIndex("day", 6, false)).toBe(0);
    expect(resolveDashboardDrilldownDayIndex("area", 6, false)).toBe(0);
  });

  it("returns null in week overview", () => {
    expect(resolveDashboardDrilldownDayIndex("week", 6, true)).toBeNull();
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

  it("restores current-week drilldown when returning", () => {
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
