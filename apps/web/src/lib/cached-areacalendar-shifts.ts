import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createDatabase } from "@schichtwerk/database";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { createClientWithAccessToken } from "@/lib/supabase/access-token";

/** Fallback-TTL: nur falls Tag-Revalidation einmal nicht greift. */
export const AREA_CALENDAR_SHIFTS_CACHE_REVALIDATE_SECONDS = 30;

export function areaCalendarShiftsCacheTag(
  orgId: string,
  locationId: string,
  weekStart: string
) {
  return `shifts:${orgId}:${locationId}:${weekStart}` as const;
}

/** Invalidates all location/week shift caches for an organization. */
export function areaCalendarOrgShiftsCacheTag(orgId: string) {
  return `shifts-org:${orgId}` as const;
}

/** Invalidates all week ranges for one location (z. B. nach Mobile-Bestätigung). */
export function areaCalendarLocationShiftsCacheTag(
  orgId: string,
  locationId: string
) {
  return `shifts-loc:${orgId}:${locationId}` as const;
}

export function areaCalendarShiftCacheTags(input: {
  organizationId: string;
  locationId: string;
  weekStart: string;
}): readonly string[] {
  return [
    areaCalendarShiftsCacheTag(
      input.organizationId,
      input.locationId,
      input.weekStart
    ),
    areaCalendarLocationShiftsCacheTag(input.organizationId, input.locationId),
    areaCalendarOrgShiftsCacheTag(input.organizationId),
  ];
}

/** Kalenderwoche + Vorgängerwoche (Nachtschicht über Mitternacht). */
export function weekStartsForShiftCacheInvalidation(shiftDate: string): string[] {
  const weekStart = toISODate(startOfWeek(parseISODate(shiftDate)));
  const previous = parseISODate(weekStart);
  previous.setDate(previous.getDate() - 7);
  return [toISODate(previous), weekStart];
}

export function revalidateAreaCalendarShiftCacheTags(input: {
  organizationId: string;
  locationId?: string | null;
  weekStarts?: readonly string[];
}) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/bereich-kalender", "layout");
  revalidateTag(areaCalendarOrgShiftsCacheTag(input.organizationId));

  if (!input.locationId) return;

  revalidateTag(
    areaCalendarLocationShiftsCacheTag(input.organizationId, input.locationId)
  );

  const seen = new Set<string>();
  for (const weekStart of input.weekStarts ?? []) {
    for (const resolvedWeekStart of weekStartsForShiftCacheInvalidation(weekStart)) {
      const key = `${input.locationId}:${resolvedWeekStart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      revalidateTag(
        areaCalendarShiftsCacheTag(
          input.organizationId,
          input.locationId,
          resolvedWeekStart
        )
      );
    }
  }
}

/** Nach Schichtänderungen (auch Mobile-API): Planungs-/Bereich-Kalender-Cache leeren. */
export function revalidateAreaCalendarShiftsAfterChange(input: {
  organizationId: string;
  shifts: { locationId: string | null; shiftDate: string }[];
}) {
  const weekStartsByLocation = new Map<string, Set<string>>();

  for (const shift of input.shifts) {
    if (!shift.locationId || !shift.shiftDate) continue;
    const weekStarts = weekStartsByLocation.get(shift.locationId) ?? new Set<string>();
    weekStarts.add(shift.shiftDate);
    weekStartsByLocation.set(shift.locationId, weekStarts);
  }

  if (weekStartsByLocation.size === 0) {
    revalidateAreaCalendarShiftCacheTags({ organizationId: input.organizationId });
    return;
  }

  for (const [locationId, weekStarts] of weekStartsByLocation) {
    revalidateAreaCalendarShiftCacheTags({
      organizationId: input.organizationId,
      locationId,
      weekStarts: [...weekStarts],
    });
  }
}

export async function getCachedAreaCalendarShifts(
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
  const tags = areaCalendarShiftCacheTags({
    organizationId: orgId,
    locationId,
    weekStart,
  });

  return unstable_cache(
    async () => {
      const db = createDatabase(createClientWithAccessToken(accessToken));
      return db.listAreaCalendarShifts(orgId, from, to, locationId);
    },
    ["areacalendar-shifts", orgId, locationId, weekStart, from, to],
    {
      tags: [...tags],
      revalidate: AREA_CALENDAR_SHIFTS_CACHE_REVALIDATE_SECONDS,
    }
  )();
}
