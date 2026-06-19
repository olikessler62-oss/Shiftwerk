import { sortProfileRecurringAvailabilityBySchedule } from "@schichtwerk/database";
import type { Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import { PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY } from "@/lib/profile-availability-label";

export type OverviewAvailabilityDisplayRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string | null;
  showEmployeeName: boolean;
  weekday: number;
  startTime: string;
  endTime: string;
};

function normalizeAvailabilityWeekday(weekday: number): number {
  return weekday === PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY ? weekday : weekday % 7;
}

/** Wochentag Mo=0 … So=6 aus ISO-Datum. */
export function weekdayFromDateISO(dateISO: string): number {
  const day = new Date(`${dateISO}T12:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

/**
 * Wiederkehrende Verfügbarkeit gilt ab heute oder künftig, wenn der nächste Termin
 * nicht vor dem heutigen Kalendertag liegt (Mo–So-Zyklus, Feiertag immer).
 */
export function availabilitySlotIsCurrentOrFuture(
  slot: Pick<ProfileRecurringAvailability, "weekday">,
  todayWeekday: number
): boolean {
  if (slot.weekday === PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY) return true;
  const weekday = normalizeAvailabilityWeekday(slot.weekday);
  return weekday >= todayWeekday || weekday < todayWeekday;
}

export function filterOverviewAvailabilities(
  availability: readonly ProfileRecurringAvailability[],
  todayISO: string
): ProfileRecurringAvailability[] {
  const todayWeekday = weekdayFromDateISO(todayISO);
  return availability.filter((slot) =>
    availabilitySlotIsCurrentOrFuture(slot, todayWeekday)
  );
}

export function buildOverviewAvailabilityDisplayRows(input: {
  availability: readonly ProfileRecurringAvailability[];
  profiles: readonly Profile[];
  todayISO: string;
}): OverviewAvailabilityDisplayRow[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const filtered = filterOverviewAvailabilities(input.availability, input.todayISO);

  const grouped = new Map<string, ProfileRecurringAvailability[]>();
  for (const slot of filtered) {
    const list = grouped.get(slot.profile_id) ?? [];
    list.push(slot);
    grouped.set(slot.profile_id, list);
  }

  const employeeIds = [...grouped.keys()].sort((a, b) => {
    const nameA = profileById.get(a)?.full_name ?? "";
    const nameB = profileById.get(b)?.full_name ?? "";
    const byName = nameA.localeCompare(nameB, "de");
    if (byName !== 0) return byName;
    return a.localeCompare(b);
  });

  const rows: OverviewAvailabilityDisplayRow[] = [];
  for (const employeeId of employeeIds) {
    const profile = profileById.get(employeeId);
    const employeeSlots = sortProfileRecurringAvailabilityBySchedule(
      grouped.get(employeeId) ?? []
    );

    employeeSlots.forEach((slot, index) => {
      rows.push({
        id: slot.id,
        employeeId,
        employeeName: profile?.full_name ?? "—",
        employeeColor: profile?.color ?? null,
        showEmployeeName: index === 0,
        weekday: slot.weekday,
        startTime: slot.start_time,
        endTime: slot.end_time,
      });
    });
  }

  return rows;
}

export function countOverviewAvailabilityEmployees(
  rows: readonly OverviewAvailabilityDisplayRow[]
): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

export type OverviewAvailabilityEmployeeJumpOption = import("@/lib/overview-employee-jump").OverviewEmployeeJumpOption;

export function buildOverviewAvailabilityEmployeeJumpOptions(
  profiles: readonly Pick<Profile, "id" | "full_name" | "color">[],
  rows: readonly OverviewAvailabilityDisplayRow[]
): OverviewAvailabilityEmployeeJumpOption[] {
  const firstRowIdByEmployeeId = new Map<string, string>();
  for (const row of rows) {
    if (!firstRowIdByEmployeeId.has(row.employeeId)) {
      firstRowIdByEmployeeId.set(row.employeeId, row.id);
    }
  }

  return profiles.map((profile) => ({
    employeeId: profile.id,
    employeeName: profile.full_name,
    employeeColor: profile.color ?? null,
    firstRowId: firstRowIdByEmployeeId.get(profile.id) ?? null,
  }));
}

export function firstOverviewAvailabilityRowIdForEmployee(
  rows: readonly OverviewAvailabilityDisplayRow[],
  employeeId: string
): string | null {
  return rows.find((row) => row.employeeId === employeeId)?.id ?? null;
}
