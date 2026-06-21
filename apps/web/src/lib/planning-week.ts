import { redirect } from "next/navigation";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { resolvePlanningWeekStart } from "@schichtwerk/database";

export type PlanningPagePathname = "/bereich-kalender" | "/dashboard";

/** Woche, Standort und Bereich beim Wechsel zwischen Planungsseiten erhalten. */
export const PLANNING_PRESERVED_QUERY_KEYS = ["week", "location", "area"] as const;

export function buildPlanningPageUrl(
  pathname: PlanningPagePathname,
  searchParams: URLSearchParams
): string {
  const params = new URLSearchParams();
  for (const key of PLANNING_PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function planningWeekStartFromParam(weekParam: string | undefined): string {
  if (!weekParam) {
    return toISODate(startOfWeek(new Date()));
  }
  return toISODate(startOfWeek(parseISODate(weekParam)));
}

export function resolveManagerPlanningWeek(weekParam: string | undefined): string {
  const normalized = planningWeekStartFromParam(weekParam);
  return resolvePlanningWeekStart(normalized).weekStart;
}

/** Redirect wenn `week` in der URL älter als das Hot-Fenster ist. */
export function redirectIfPlanningWeekClamped(
  pathname: "/bereich-kalender" | "/dashboard",
  weekParam: string | undefined,
  queryParams: Record<string, string | undefined>
): string {
  if (!weekParam) {
    return resolveManagerPlanningWeek(undefined);
  }

  const normalized = planningWeekStartFromParam(weekParam);
  const { weekStart, clamped } = resolvePlanningWeekStart(normalized);

  if (clamped) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (key === "week" || !value) continue;
      params.set(key, value);
    }
    params.set("week", weekStart);
    redirect(`${pathname}?${params.toString()}`);
  }

  return weekStart;
}
