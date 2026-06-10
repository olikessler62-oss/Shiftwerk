"use server";

import { revalidatePath } from "next/cache";
import {
  parseHourlyRateAmount,
  parseValidFromDate,
  validateMutableHourlyRateValidFrom,
  validateNewHourlyRate,
} from "@schichtwerk/database";
import type {
  ProfileHourlyRate,
  ProfileCompensationSurcharge,
  EffectiveProfileCompensationSurcharge,
} from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { ProfileCompensationCacheEntry } from "@/components/settings/profile-compensation-panel-modal";

export type ProfileHourlyRateActionResult =
  | {
      ok: true;
      rates?: ProfileHourlyRate[];
      currentRate?: ProfileHourlyRate | null;
      rate?: ProfileHourlyRate;
      currentSurcharges?: EffectiveProfileCompensationSurcharge[];
      surchargeEntries?: ProfileCompensationSurcharge[];
      serverToday?: string;
    }
  | { ok: false; error: string };

async function loadCompensationEntry(
  organizationId: string,
  profileId: string
): Promise<ProfileCompensationCacheEntry> {
  const db = await getDatabase();
  const serverToday = await db.getServerDateIso();
  const [currentRate, rates, currentSurcharges, surchargeEntries] =
    await Promise.all([
      db.getProfileHourlyRateForDate(organizationId, profileId, serverToday),
      db.listProfileHourlyRates(organizationId, profileId, 10),
      db.listEffectiveProfileCompensationSurchargesForDate(
        organizationId,
        profileId,
        serverToday
      ),
      db.listProfileCompensationSurcharges(organizationId, profileId, 20),
    ]);
  return {
    currentRate,
    rates,
    currentSurcharges,
    surchargeEntries,
    serverToday,
  };
}

export async function fetchProfileHourlyRates(
  profileId: string
): Promise<ProfileHourlyRateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const entry = await loadCompensationEntry(organizationId, profileId);
    return {
      ok: true,
      currentRate: entry.currentRate,
      rates: entry.rates,
      currentSurcharges: entry.currentSurcharges,
      surchargeEntries: entry.surchargeEntries,
      serverToday: entry.serverToday,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function saveProfileHourlyRate(input: {
  profileId: string;
  amount: string;
  valid_from: string;
}): Promise<ProfileHourlyRateActionResult> {
  try {
    const { organizationId, profile: managerProfile } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedAmount = parseHourlyRateAmount(input.amount);
    if (!parsedAmount.ok) return parsedAmount;

    const parsedDate = parseValidFromDate(input.valid_from);
    if (!parsedDate.ok) return parsedDate;

    const serverToday = await db.getServerDateIso();
    const mutableFromCheck = validateMutableHourlyRateValidFrom(
      parsedDate.valid_from,
      serverToday
    );
    if (!mutableFromCheck.ok) return mutableFromCheck;

    const openRate = await db.getProfileHourlyRateForDate(
      organizationId,
      input.profileId,
      serverToday
    );
    const openValidFrom =
      openRate?.valid_to === null ? openRate.valid_from : null;

    const validated = validateNewHourlyRate({
      amount: parsedAmount.amount,
      valid_from: parsedDate.valid_from,
      currentOpenValidFrom: openValidFrom,
    });
    if (!validated.ok) return validated;

    const rate = await db.setProfileHourlyRate(organizationId, input.profileId, {
      amount: parsedAmount.amount,
      valid_from: parsedDate.valid_from,
      created_by: managerProfile.id,
    });

    const entry = await loadCompensationEntry(organizationId, input.profileId);
    revalidatePath("/dashboard");
    return {
      ok: true,
      rate,
      rates: entry.rates,
      currentRate: entry.currentRate,
      currentSurcharges: entry.currentSurcharges,
      surchargeEntries: entry.surchargeEntries,
      serverToday: entry.serverToday,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateProfileHourlyRate(input: {
  profileId: string;
  rateId: string;
  amount: string;
  valid_from: string;
}): Promise<ProfileHourlyRateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedAmount = parseHourlyRateAmount(input.amount);
    if (!parsedAmount.ok) return parsedAmount;

    const parsedDate = parseValidFromDate(input.valid_from);
    if (!parsedDate.ok) return parsedDate;

    const serverToday = await db.getServerDateIso();
    const rate = await db.updateProfileHourlyRate(
      organizationId,
      input.profileId,
      input.rateId,
      {
        amount: parsedAmount.amount,
        valid_from: parsedDate.valid_from,
      },
      serverToday
    );

    const entry = await loadCompensationEntry(organizationId, input.profileId);
    revalidatePath("/dashboard");
    return {
      ok: true,
      rate,
      rates: entry.rates,
      currentRate: entry.currentRate,
      currentSurcharges: entry.currentSurcharges,
      surchargeEntries: entry.surchargeEntries,
      serverToday: entry.serverToday,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function deleteProfileHourlyRate(input: {
  profileId: string;
  rateId: string;
}): Promise<ProfileHourlyRateActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const serverToday = await db.getServerDateIso();
    await db.deleteProfileHourlyRate(
      organizationId,
      input.profileId,
      input.rateId,
      serverToday
    );

    const entry = await loadCompensationEntry(organizationId, input.profileId);
    revalidatePath("/dashboard");
    return {
      ok: true,
      rates: entry.rates,
      currentRate: entry.currentRate,
      currentSurcharges: entry.currentSurcharges,
      surchargeEntries: entry.surchargeEntries,
      serverToday: entry.serverToday,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
