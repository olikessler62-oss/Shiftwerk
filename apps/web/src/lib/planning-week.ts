import { redirect } from "next/navigation";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { resolvePlanningWeekStart } from "@schichtwerk/database";

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
