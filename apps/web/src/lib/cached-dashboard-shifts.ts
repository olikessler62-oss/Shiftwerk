import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createDatabase } from "@schichtwerk/database";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { createClientWithAccessToken } from "@/lib/supabase/access-token";

export function dashboardShiftsCacheTag(
  orgId: string,
  locationId: string,
  weekStart: string
) {
  return `shifts:${orgId}:${locationId}:${weekStart}` as const;
}

/** Kalenderwoche + Vorgängerwoche (Nachtschicht über Mitternacht). */
export function weekStartsForShiftCacheInvalidation(shiftDate: string): string[] {
  const weekStart = toISODate(startOfWeek(parseISODate(shiftDate)));
  const previous = parseISODate(weekStart);
  previous.setDate(previous.getDate() - 7);
  return [toISODate(previous), weekStart];
}

/** Nach Schichtänderungen (auch Mobile-API): Planungs-/Dashboard-Cache leeren. */
export function revalidateDashboardShiftsAfterChange(input: {
  organizationId: string;
  shifts: { locationId: string | null; shiftDate: string }[];
}) {
  revalidatePath("/dashboard");
  revalidatePath("/planung");

  const seen = new Set<string>();
  for (const shift of input.shifts) {
    if (!shift.locationId) continue;
    for (const weekStart of weekStartsForShiftCacheInvalidation(shift.shiftDate)) {
      const key = `${shift.locationId}:${weekStart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      revalidateTag(
        dashboardShiftsCacheTag(input.organizationId, shift.locationId, weekStart)
      );
    }
  }
}

export async function getCachedDashboardShifts(
  orgId: string,
  locationId: string,
  weekStart: string,
  from: string,
  to: string
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return [];
  }

  const accessToken = session.access_token;
  const cacheTag = dashboardShiftsCacheTag(orgId, locationId, weekStart);

  return unstable_cache(
    async () => {
      const db = createDatabase(createClientWithAccessToken(accessToken));
      return db.listDashboardShifts(orgId, from, to, locationId);
    },
    ["dashboard-shifts", orgId, locationId, weekStart, from, to],
    { tags: [cacheTag] }
  )();
}
