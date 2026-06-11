"use server";

import { revalidatePath } from "next/cache";
import { toProfileAvailabilitySaveError } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ProfileAvailabilityActionResult =
  | { ok: true; availability?: ProfileRecurringAvailability[] }
  | { ok: false; error: string };

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
    revalidatePath("/planung");
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
    revalidatePath("/planung");
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
    revalidatePath("/planung");
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
    await db.deleteProfileRecurringAvailability(
      organizationId,
      input.profileId,
      input.availabilityId
    );
    const availability = await db.listProfileRecurringAvailability(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true, availability };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
