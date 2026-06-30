import type { ReadonlyURLSearchParams } from "next/navigation";

export const DASHBOARD_DRILLDOWN_DAY_PARAM = "day";
export const DASHBOARD_DRILLDOWN_FOCUS_AREA_PARAM = "focusArea";

export type DashboardOverviewDrilldownUrlState = {
  dayISO: string | null;
  focusAreaId: string | null;
};

export type DashboardOverviewUrlView =
  | { level: "week" }
  | { level: "day"; dayIndex: number };

export function readDashboardOverviewDrilldownFromSearchParams(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
  weekDates: readonly string[]
): DashboardOverviewDrilldownUrlState {
  const dayISO = searchParams.get(DASHBOARD_DRILLDOWN_DAY_PARAM);
  if (!dayISO || !weekDates.includes(dayISO)) {
    return { dayISO: null, focusAreaId: null };
  }

  const focusAreaId = searchParams.get(DASHBOARD_DRILLDOWN_FOCUS_AREA_PARAM);
  return {
    dayISO,
    focusAreaId: focusAreaId?.trim() ? focusAreaId : null,
  };
}

export function resolveDashboardOverviewViewFromSearchParams(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
  weekDates: readonly string[]
): DashboardOverviewUrlView {
  const { dayISO } = readDashboardOverviewDrilldownFromSearchParams(
    searchParams,
    weekDates
  );
  if (!dayISO) {
    return { level: "week" };
  }

  return { level: "day", dayIndex: weekDates.indexOf(dayISO) };
}

export function buildDashboardOverviewDrilldownSearchParams(
  base: Pick<URLSearchParams, "toString" | "delete" | "set">,
  drilldown: DashboardOverviewDrilldownUrlState
): URLSearchParams {
  const params = new URLSearchParams(base.toString());

  if (drilldown.dayISO) {
    params.set(DASHBOARD_DRILLDOWN_DAY_PARAM, drilldown.dayISO);
  } else {
    params.delete(DASHBOARD_DRILLDOWN_DAY_PARAM);
    params.delete(DASHBOARD_DRILLDOWN_FOCUS_AREA_PARAM);
    return params;
  }

  if (drilldown.focusAreaId) {
    params.set(DASHBOARD_DRILLDOWN_FOCUS_AREA_PARAM, drilldown.focusAreaId);
  } else {
    params.delete(DASHBOARD_DRILLDOWN_FOCUS_AREA_PARAM);
  }

  return params;
}

export function buildDashboardOverviewDrilldownHref(
  pathname: string,
  base: Pick<URLSearchParams, "toString" | "delete" | "set">,
  drilldown: DashboardOverviewDrilldownUrlState
): string {
  const params = buildDashboardOverviewDrilldownSearchParams(base, drilldown);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
