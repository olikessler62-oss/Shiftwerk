"use server";

import { revalidatePath } from "next/cache";
import {
  DEFAULT_COUNTRY_CODE,
  resolveOrganizationTimeZone,
  toProfileAvailabilitySaveError,
  wouldDeletingAvailabilitySlotConflictWithFutureShifts,
} from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ProfileAvailabilityActionResult =
  | { ok: true; availability?: ProfileRecurringAvailability[] }
  | { ok: false; error: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
    return { ok: true, availability };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function createProfileRecurringAvailability(input: {
  profileId: string;
  weekday: number;
  start_time: string;
  end_time: string;
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
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
    return { ok: true, availability };
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
}): Promise<ProfileAvailabilityActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
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
    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, availability };
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
    return { ok: true, availability };
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

    const organization = await db.getOrganization(organizationId);
    const countryCode =
      organization?.country_code ??
      (await db.getOrganizationCountryCode(organizationId)) ??
      DEFAULT_COUNTRY_CODE;
    const timeZone = resolveOrganizationTimeZone(organization);
    const futureShifts = await db.listShiftsForEmployeeFromDate(
      input.profileId,
      todayISO()
    );
    const remainingAvailability = availability.filter(
      (entry) => entry.id !== input.availabilityId
    );
    const conflictCheck = wouldDeletingAvailabilitySlotConflictWithFutureShifts({
      slotToDelete,
      remainingAvailability,
      futureShifts,
      countryCode,
      timeZone,
      todayISO: todayISO(),
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
    return { ok: true, availability: nextAvailability };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
