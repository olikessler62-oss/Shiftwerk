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

/** Selected day index while in day/area drilldown; null in week overview. */
export function resolveDashboardDrilldownDayIndex(
  viewLevel: DashboardDrilldownViewLevel,
  viewDayIndex: number
): number | null {
  if (viewLevel === "week") {
    return null;
  }
  return viewDayIndex;
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
  currentWeekTodayDayIndex = null,
}: {
  previousWeekStart: string;
  nextWeekStart: string;
  currentWeekStart: string;
  view: DashboardDrilldownView;
  areaDetailScopeByAreaId: Record<string, DashboardAreaDetailScope>;
  savedSnapshot: CurrentWeekDrilldownSnapshot | null;
  /** Mo=0 … So=6 in der aktuellen Planungswoche — für Tag-Scope nach Rückkehr. */
  currentWeekTodayDayIndex?: number | null;
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

  if (!wasCurrentWeek && isNowCurrentWeek) {
    const nextDayIndex =
      currentWeekTodayDayIndex ??
      savedSnapshot?.dayIndex ??
      0;

    return {
      savedSnapshot,
      nextDayIndex,
      ...(savedSnapshot
        ? { restoreAreaScopes: savedSnapshot.areaDetailScopeByAreaId }
        : {}),
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
