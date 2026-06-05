"use server";

import { revalidatePath } from "next/cache";
import {
  parseHourlyRateAmount,
  parseValidFromDate,
  validateNewHourlyRate,
} from "@schichtwerk/database";
import type { ProfileHourlyRate } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ProfileHourlyRateActionResult =
  | {
      ok: true;
      rates?: ProfileHourlyRate[];
      currentRate?: ProfileHourlyRate | null;
      rate?: ProfileHourlyRate;
    }
  | { ok: false; error: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

    const currentRate = await db.getProfileHourlyRateForDate(
      organizationId,
      profileId,
      todayIso()
    );

    return { ok: true, currentRate };
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
    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();

    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const parsedAmount = parseHourlyRateAmount(input.amount);
    if (!parsedAmount.ok) return parsedAmount;

    const parsedDate = parseValidFromDate(input.valid_from);
    if (!parsedDate.ok) return parsedDate;

    const openRate = await db.getProfileHourlyRateForDate(
      organizationId,
      input.profileId,
      todayIso()
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
      created_by: userId,
    });

    const rates = await db.listProfileHourlyRates(organizationId, input.profileId, 10);
    const currentRate = await db.getProfileHourlyRateForDate(
      organizationId,
      input.profileId,
      todayIso()
    );

    revalidatePath("/dashboard");
    return { ok: true, rate, rates, currentRate };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}
