import { unstable_cache } from "next/cache";
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
