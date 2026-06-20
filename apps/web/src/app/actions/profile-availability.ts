"use server";

import { revalidatePath } from "next/cache";
import {
  DEFAULT_COUNTRY_CODE,
  collectEmployeeWeeklyHoursConflicts,
  evaluateProfileAvailabilityWeeklyLimits,
  formatAvailabilityExceedsTargetError,
  formatLegalWeeklyHoursExceededError,
  isoWeekStartFromShiftDate,
  organizationTodayISO,
  parseAvailabilityTimeRange,
  parseAvailabilityWeekday,
  parseProfileWeeklyHours,
  resolveOrganizationTimeZone,
  resolveProfileWeeklyHoursTarget,
  shiftForWeeklyHoursConflictFromEmployeeShift,
  shiftHoursFromIsoRange,
  toProfileAvailabilitySaveError,
  validateProfileWeeklyHoursInput,
  wouldChangingAvailabilitySlotConflictWithActiveShifts,
  wouldDeletingAvailabilitySlotConflictWithFutureShifts,
} from "@schichtwerk/database";
import type { Profile, ProfileRecurringAvailability, ShiftConfirmationStatus } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { shiftTimeFromTimestamp } from "@/lib/dates";

export type ProfileWeeklyHoursConflictRow = {
  id: string;
  shift_date: string;
  startTime: string;
  endTime: string;
  confirmation_status: ShiftConfirmationStatus | null;
  weekTotalHours: number;
  targetHours: number;
};

export type ProfileAvailabilityActionResult =
  | {
      ok: true;
      availability?: ProfileRecurringAvailability[];
      profile?: Profile;
      weeklyHoursConflicts?: ProfileWeeklyHoursConflictRow[];
    }
  | { ok: false; error: string; requiresConfirmation?: boolean };

async function loadAvailabilityChangeContext(
  db: Awaited<ReturnType<typeof getDatabase>>,
  organizationId: string,
  profileId: string
) {
  const organization = await db.getOrganization(organizationId);
  const countryCode =
    organization?.country_code ??
    (await db.getOrganizationCountryCode(organizationId)) ??
    DEFAULT_COUNTRY_CODE;
  const timeZone = resolveOrganizationTimeZone(organization);
  const todayISO = organizationTodayISO(timeZone);

  return {
    countryCode,
    timeZone,
    todayISO,
    futureShifts: await db.listShiftsForEmployeeFromDate(profileId, todayISO),
  };
}

function validateProjectedAvailabilityWeeklyLimits(input: {
  availabilities: readonly ProfileRecurringAvailability[];
  weeklyHoursTarget: number | null;
  countryCode: string;
  allowAvailabilityExceedsTarget?: boolean;
}): { ok: true } | { ok: false; error: string; requiresConfirmation?: boolean } {
  const evaluation = evaluateProfileAvailabilityWeeklyLimits({
    availabilities: input.availabilities,
    weeklyHoursTarget: input.weeklyHoursTarget,
    countryCode: input.countryCode,
  });

  const legalViolation = evaluation.violations.find(
    (violation) => violation.kind === "availability_exceeds_legal"
  );
  if (legalViolation) {
    return {
      ok: false,
      error: formatLegalWeeklyHoursExceededError({
        hours: legalViolation.hours,
        legalMax: legalViolation.legalMax,
      }),
    };
  }

  const targetViolation = evaluation.violations.find(
    (violation) => violation.kind === "availability_exceeds_target"
  );
  if (targetViolation && !input.allowAvailabilityExceedsTarget) {
    return {
      ok: false,
      error: formatAvailabilityExceedsTargetError({
        hours: targetViolation.hours,
        targetHours: targetViolation.targetHours,
      }),
      requiresConfirmation: true,
    };
  }

  return { ok: true };
}

export async function fetchProfileRecurringAvailability(
  profileId: string
): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }
    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      profileId
    );
    return { ok: true, availability, profile };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function updateProfileWeeklyHours(input: {
  profileId: string;
  weekly_hours: string;
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsed = parseProfileWeeklyHours(input.weekly_hours ?? "");
    if (!parsed.ok) return parsed;

    const changeContext = await loadAvailabilityChangeContext(
      db,
      organizationId,
      input.profileId
    );
    const validated = validateProfileWeeklyHoursInput({
      weekly_hours: parsed.weekly_hours,
      countryCode: changeContext.countryCode,
    });
    if (!validated.ok) return validated;

    await db.updateOrganizationProfile(input.profileId, organizationId, {
      full_name: profile.full_name,
      is_active: profile.is_active,
      schedulable: profile.schedulable,
      email: profile.email,
      mobile_phone: profile.mobile_phone,
      color: profile.color,
      weekly_hours: validated.weekly_hours,
      ...(profile.role === "basic"
        ? { email_fallback_mode: profile.email_fallback_mode }
        : {}),
    });

    const updatedProfile = await db.getProfileById(input.profileId);
    const targetHours = resolveProfileWeeklyHoursTarget(validated.weekly_hours);
    const weekStartForFetch = isoWeekStartFromShiftDate(changeContext.todayISO);
    const futureShifts = await db.listShiftsForEmployeeInDateRange(
      input.profileId,
      weekStartForFetch,
      "2099-12-31"
    );
    const weeklyHoursConflicts = collectEmployeeWeeklyHoursConflicts({
      employeeId: input.profileId,
      targetHours,
      fromDateISO: changeContext.todayISO,
      shifts: futureShifts.map((shift) =>
        shiftForWeeklyHoursConflictFromEmployeeShift({
          id: shift.id,
          employee_id: shift.employee_id,
          shift_date: shift.shift_date,
          starts_at: shift.starts_at,
          ends_at: shift.ends_at,
          confirmation_status: shift.confirmation_status ?? null,
          durationHours: shiftHoursFromIsoRange(shift.starts_at, shift.ends_at),
        })
      ),
      includeProposed: true,
    });
    const weeklyHoursConflictRows: ProfileWeeklyHoursConflictRow[] = [];
    const shiftById = new Map(futureShifts.map((shift) => [shift.id, shift]));
    for (const conflict of weeklyHoursConflicts) {
      const shift = shiftById.get(conflict.shiftId);
      if (!shift) continue;
      weeklyHoursConflictRows.push({
        id: conflict.shiftId,
        shift_date: conflict.shiftDate,
        startTime: shiftTimeFromTimestamp(shift.starts_at),
        endTime: shiftTimeFromTimestamp(shift.ends_at),
        confirmation_status: shift.confirmation_status ?? null,
        weekTotalHours: conflict.weekTotalHours,
        targetHours: conflict.targetHours,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return {
      ok: true,
      profile: updatedProfile ?? undefined,
      weeklyHoursConflicts:
        weeklyHoursConflictRows.length > 0 ? weeklyHoursConflictRows : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function createProfileRecurringAvailability(input: {
  profileId: string;
  weekday: number;
  start_time: string;
  end_time: string;
  allowAvailabilityExceedsTarget?: boolean;
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const weekdayResult = parseAvailabilityWeekday(input.weekday);
    if (!weekdayResult.ok) return weekdayResult;

    const parsedTimes = parseAvailabilityTimeRange({
      start_time: input.start_time,
      end_time: input.end_time,
    });
    if (!parsedTimes.ok) return parsedTimes;

    const existing = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    const projected: ProfileRecurringAvailability[] = [
      ...existing,
      {
        id: "projected",
        organization_id: organizationId,
        profile_id: input.profileId,
        weekday: weekdayResult.weekday,
        start_time: parsedTimes.start_time,
        end_time: parsedTimes.end_time,
        sort_order: existing.length,
      },
    ];

    const changeContext = await loadAvailabilityChangeContext(
      db,
      organizationId,
      input.profileId
    );
    const weeklyLimitCheck = validateProjectedAvailabilityWeeklyLimits({
      availabilities: projected,
      weeklyHoursTarget: profile.weekly_hours,
      countryCode: changeContext.countryCode,
      allowAvailabilityExceedsTarget: input.allowAvailabilityExceedsTarget,
    });
    if (!weeklyLimitCheck.ok) return weeklyLimitCheck;

    await db.insertProfileRecurringAvailability(organizationId, input.profileId, {
      weekday: input.weekday,
      start_time: input.start_time,
      end_time: input.end_time,
    });
    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, availability, profile };
  } catch (e) {
    return { ok: false, error: toProfileAvailabilitySaveError(e) };
  }
}

export async function updateProfileRecurringAvailability(input: {
  profileId: string;
  availabilityId: string;
  weekday: number;
  start_time: string;
  end_time: string;
  allowAvailabilityExceedsTarget?: boolean;
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    const slotBeforeChange = availability.find(
      (entry) => entry.id === input.availabilityId
    );
    if (!slotBeforeChange) {
      return { ok: false, error: "Verfügbarkeit nicht gefunden" };
    }

    const weekdayResult = parseAvailabilityWeekday(input.weekday);
    if (!weekdayResult.ok) {
      return { ok: false, error: weekdayResult.error };
    }

    const parsedTimes = parseAvailabilityTimeRange({
      start_time: input.start_time,
      end_time: input.end_time,
    });
    if (!parsedTimes.ok) {
      return { ok: false, error: parsedTimes.error };
    }

    const availabilityAfterChange = availability.map((entry) =>
      entry.id === input.availabilityId
        ? {
            ...entry,
            weekday: weekdayResult.weekday,
            start_time: parsedTimes.start_time,
            end_time: parsedTimes.end_time,
          }
        : entry
    );

    const changeContext = await loadAvailabilityChangeContext(
      db,
      organizationId,
      input.profileId
    );
    const weeklyLimitCheck = validateProjectedAvailabilityWeeklyLimits({
      availabilities: availabilityAfterChange,
      weeklyHoursTarget: profile.weekly_hours,
      countryCode: changeContext.countryCode,
      allowAvailabilityExceedsTarget: input.allowAvailabilityExceedsTarget,
    });
    if (!weeklyLimitCheck.ok) return weeklyLimitCheck;

    const conflictCheck = wouldChangingAvailabilitySlotConflictWithActiveShifts({
      slotBeforeChange,
      availabilityAfterChange,
      futureShifts: changeContext.futureShifts,
      countryCode: changeContext.countryCode,
      timeZone: changeContext.timeZone,
      todayISO: changeContext.todayISO,
    });
    if (!conflictCheck.ok) {
      return { ok: false, error: conflictCheck.error };
    }

    await db.updateProfileRecurringAvailability(
      organizationId,
      input.profileId,
      input.availabilityId,
      {
        weekday: input.weekday,
        start_time: input.start_time,
        end_time: input.end_time,
      }
    );
    const nextAvailability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, availability: nextAvailability, profile };
  } catch (e) {
    return { ok: false, error: toProfileAvailabilitySaveError(e) };
  }
}

export async function reorderProfileRecurringAvailability(input: {
  profileId: string;
  orderedIds: string[];
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    await db.reorderProfileRecurringAvailability(
      organizationId,
      input.profileId,
      input.orderedIds
    );
    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, availability, profile };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Reihenfolge konnte nicht gespeichert werden",
    };
  }
}

export async function deleteProfileRecurringAvailability(input: {
  profileId: string;
  availabilityId: string;
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    const slotToDelete = availability.find((entry) => entry.id === input.availabilityId);
    if (!slotToDelete) {
      return { ok: false, error: "Verfügbarkeit nicht gefunden" };
    }

    const remainingAvailability = availability.filter(
      (entry) => entry.id !== input.availabilityId
    );
    const changeContext = await loadAvailabilityChangeContext(
      db,
      organizationId,
      input.profileId
    );
    const conflictCheck = wouldDeletingAvailabilitySlotConflictWithFutureShifts({
      slotToDelete,
      remainingAvailability,
      futureShifts: changeContext.futureShifts,
      countryCode: changeContext.countryCode,
      timeZone: changeContext.timeZone,
      todayISO: changeContext.todayISO,
    });
    if (!conflictCheck.ok) {
      return { ok: false, error: conflictCheck.error };
    }

    await db.deleteProfileRecurringAvailability(
      organizationId,
      input.profileId,
      input.availabilityId
    );
    const nextAvailability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, availability: nextAvailability, profile };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
