"use server";

import { revalidatePath } from "next/cache";
import {
  parseHourlyRateAmount,
  parseValidFromDate,
  validateHourlyRateEdit,
  validateHourlyRateValidFromPolicy,
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
      db.listProfileHourlyRates(organizationId, profileId, 50),
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
    const { organizationId, profile: managerProfile, organization } =
      await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedAmount = parseHourlyRateAmount(input.amount);
    if (!parsedAmount.ok) return parsedAmount;

    const parsedFrom = parseValidFromDate(input.valid_from);
    if (!parsedFrom.ok) return parsedFrom;

    const serverToday = await db.getServerDateIso();
    const policyCheck = validateHourlyRateValidFromPolicy({
      valid_from: parsedFrom.valid_from,
      serverToday,
      allowRetroactive: organization.allow_retroactive_compensation_entries,
    });
    if (!policyCheck.ok) return policyCheck;

    const rates = await db.listProfileHourlyRates(organizationId, input.profileId, 50);
    const validated = validateNewHourlyRate({
      valid_from: parsedFrom.valid_from,
      existingValidFromDates: rates.map((rate) => rate.valid_from),
    });
    if (!validated.ok) return validated;

    const rate = await db.setProfileHourlyRate(organizationId, input.profileId, {
      amount: parsedAmount.amount,
      valid_from: parsedFrom.valid_from,
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
    const { organizationId, organization } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedAmount = parseHourlyRateAmount(input.amount);
    if (!parsedAmount.ok) return parsedAmount;

    const parsedFrom = parseValidFromDate(input.valid_from);
    if (!parsedFrom.ok) return parsedFrom;

    const rates = await db.listProfileHourlyRates(organizationId, input.profileId, 50);
    const editingIndex = rates.findIndex((rate) => rate.id === input.rateId);
    if (editingIndex < 0) {
      return { ok: false, error: "Stundensatz nicht gefunden" };
    }
    const editingRate = rates[editingIndex]!;

    const serverToday = await db.getServerDateIso();
    const policyCheck = validateHourlyRateValidFromPolicy({
      valid_from: parsedFrom.valid_from,
      serverToday,
      allowRetroactive: organization.allow_retroactive_compensation_entries,
      initialValidFrom: editingRate.valid_from,
    });
    if (!policyCheck.ok) return policyCheck;

    const predecessor = editingIndex > 0 ? rates[editingIndex - 1] : null;
    const successor =
      editingIndex < rates.length - 1 ? rates[editingIndex + 1] : null;

    const validated = validateHourlyRateEdit({
      valid_from: parsedFrom.valid_from,
      existingValidFromDates: rates
        .filter((rate) => rate.id !== input.rateId)
        .map((rate) => rate.valid_from),
      predecessorValidFrom: predecessor?.valid_from ?? null,
      successorValidFrom: successor?.valid_from ?? null,
    });
    if (!validated.ok) return validated;

    const rate = await db.updateProfileHourlyRate(
      organizationId,
      input.profileId,
      input.rateId,
      {
        amount: parsedAmount.amount,
        valid_from: parsedFrom.valid_from,
      }
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

    await db.deleteProfileHourlyRate(
      organizationId,
      input.profileId,
      input.rateId
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
