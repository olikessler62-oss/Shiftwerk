"use server";

import { revalidatePath } from "next/cache";
import {
  parseValidFromDate,
  validateMutableHourlyRateValidFrom,
  validateNewProfileCompensationSurcharge,
  isCompensationSurchargeUnit,
} from "@schichtwerk/database";
import type {
  CompensationSurchargeType,
  CompensationSurchargeUnit,
  ProfileCompensationSurcharge,
} from "@schichtwerk/types";
import type { ProfileCompensationCacheEntry } from "@/components/settings/profile-compensation-panel-modal";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ProfileCompensationSurchargeActionResult =
  | {
      ok: true;
      entry?: ProfileCompensationSurcharge;
      surchargeEntries?: ProfileCompensationSurcharge[];
      currentSurcharges?: ProfileCompensationCacheEntry["currentSurcharges"];
      serverToday?: string;
    }
  | { ok: false; error: string };

async function loadSurchargeCompensationSlice(
  organizationId: string,
  profileId: string
): Promise<
  Pick<
    ProfileCompensationCacheEntry,
    "currentSurcharges" | "surchargeEntries" | "serverToday"
  >
> {
  const db = await getDatabase();
  const serverToday = await db.getServerDateIso();
  const [currentSurcharges, surchargeEntries] = await Promise.all([
    db.listEffectiveProfileCompensationSurchargesForDate(
      organizationId,
      profileId,
      serverToday
    ),
    db.listProfileCompensationSurcharges(organizationId, profileId, 20),
  ]);
  return { currentSurcharges, surchargeEntries, serverToday };
}

export async function saveProfileCompensationSurcharge(input: {
  profileId: string;
  surcharge_type_id: string;
  amount: number | null;
  unit: CompensationSurchargeUnit | null;
  valid_from: string;
}): Promise<ProfileCompensationSurchargeActionResult> {
  try {
    const { organizationId, profile: managerProfile } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedDate = parseValidFromDate(input.valid_from);
    if (!parsedDate.ok) return parsedDate;

    const serverToday = await db.getServerDateIso();
    const mutableFromCheck = validateMutableHourlyRateValidFrom(
      parsedDate.valid_from,
      serverToday
    );
    if (!mutableFromCheck.ok) return mutableFromCheck;

    const openEntries = await db.listProfileCompensationSurcharges(
      organizationId,
      input.profileId,
      50
    );
    const openForType = openEntries.find(
      (entry) =>
        entry.surcharge_type_id === input.surcharge_type_id &&
        entry.valid_to === null
    );
    const openValidFrom =
      openForType?.valid_to === null ? openForType.valid_from : null;

    const validated = validateNewProfileCompensationSurcharge({
      valid_from: parsedDate.valid_from,
      currentOpenValidFrom: openValidFrom,
    });
    if (!validated.ok) return validated;

    if (input.amount !== null) {
      if (!input.unit || !isCompensationSurchargeUnit(input.unit)) {
        return { ok: false, error: "Bitte eine Einheit auswählen." };
      }
    } else if (input.unit !== null) {
      return { ok: false, error: "Ungültige Einheit." };
    }

    const entry = await db.setProfileCompensationSurcharge(
      organizationId,
      input.profileId,
      {
        surcharge_type_id: input.surcharge_type_id,
        amount: input.amount,
        unit: input.unit,
        valid_from: parsedDate.valid_from,
        created_by: managerProfile.id,
      }
    );

    const slice = await loadSurchargeCompensationSlice(
      organizationId,
      input.profileId
    );
    revalidatePath("/planer");
    return { ok: true, entry, ...slice };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateProfileCompensationSurcharge(input: {
  profileId: string;
  entryId: string;
  amount: number | null;
  unit: CompensationSurchargeUnit | null;
  valid_from: string;
}): Promise<ProfileCompensationSurchargeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedDate = parseValidFromDate(input.valid_from);
    if (!parsedDate.ok) return parsedDate;

    if (input.amount !== null) {
      if (!input.unit || !isCompensationSurchargeUnit(input.unit)) {
        return { ok: false, error: "Bitte eine Einheit auswählen." };
      }
    } else if (input.unit !== null) {
      return { ok: false, error: "Ungültige Einheit." };
    }

    const serverToday = await db.getServerDateIso();
    const entry = await db.updateProfileCompensationSurcharge(
      organizationId,
      input.profileId,
      input.entryId,
      {
        amount: input.amount,
        unit: input.unit,
        valid_from: parsedDate.valid_from,
      },
      serverToday
    );

    const slice = await loadSurchargeCompensationSlice(
      organizationId,
      input.profileId
    );
    revalidatePath("/planer");
    return { ok: true, entry, ...slice };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function deleteProfileCompensationSurcharge(input: {
  profileId: string;
  entryId: string;
}): Promise<ProfileCompensationSurchargeActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const serverToday = await db.getServerDateIso();
    await db.deleteProfileCompensationSurcharge(
      organizationId,
      input.profileId,
      input.entryId,
      serverToday
    );

    const slice = await loadSurchargeCompensationSlice(
      organizationId,
      input.profileId
    );
    revalidatePath("/planer");
    return { ok: true, ...slice };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}

export type { CompensationSurchargeType };
