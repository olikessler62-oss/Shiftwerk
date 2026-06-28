export type DashboardDrilldownViewLevel = "week" | "day" | "area";

export type DashboardDrilldownView =
  | { level: "week" }
  | { level: "day"; dayIndex: number }
  | { level: "area"; dayIndex: number; areaId: string };

export type DashboardAreaDetailScope = "day" | "week";

export type CurrentWeekDrilldownSnapshot = {
  dayIndex: number;
  areaDetailScopeByAreaId: Record<string, DashboardAreaDetailScope>;
};

/** Monday (index 0) for non-current weeks; preserved day index in the current week. */
export function resolveDashboardDrilldownDayIndex(
  viewLevel: DashboardDrilldownViewLevel,
  viewDayIndex: number,
  isCurrentWeek: boolean
): number | null {
  if (viewLevel === "week") {
    return null;
  }
  return isCurrentWeek ? viewDayIndex : 0;
}

export type DashboardDrilldownWeekTransitionPlan = {
  savedSnapshot: CurrentWeekDrilldownSnapshot | null;
  nextDayIndex?: number;
  restoreAreaScopes?: Record<string, DashboardAreaDetailScope>;
};

export function planDashboardDrilldownWeekTransition({
  previousWeekStart,
  nextWeekStart,
  currentWeekStart,
  view,
  areaDetailScopeByAreaId,
  savedSnapshot,
}: {
  previousWeekStart: string;
  nextWeekStart: string;
  currentWeekStart: string;
  view: DashboardDrilldownView;
  areaDetailScopeByAreaId: Record<string, DashboardAreaDetailScope>;
  savedSnapshot: CurrentWeekDrilldownSnapshot | null;
}): DashboardDrilldownWeekTransitionPlan | null {
  if (previousWeekStart === nextWeekStart || view.level === "week") {
    return null;
  }

  const wasCurrentWeek = previousWeekStart === currentWeekStart;
  const isNowCurrentWeek = nextWeekStart === currentWeekStart;

  if (wasCurrentWeek && !isNowCurrentWeek) {
    return {
      savedSnapshot: {
        dayIndex: view.dayIndex,
        areaDetailScopeByAreaId: { ...areaDetailScopeByAreaId },
      },
      nextDayIndex: 0,
    };
  }

  if (!wasCurrentWeek && isNowCurrentWeek && savedSnapshot) {
    return {
      savedSnapshot,
      nextDayIndex: savedSnapshot.dayIndex,
      restoreAreaScopes: savedSnapshot.areaDetailScopeByAreaId,
    };
  }

  if (!isNowCurrentWeek) {
    return {
      savedSnapshot,
      nextDayIndex: 0,
    };
  }

  return null;
}
