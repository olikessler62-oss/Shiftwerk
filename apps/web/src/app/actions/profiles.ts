"use server";

import { revalidatePath } from "next/cache";
import {
  parseHourlyRateAmount,
  parseValidFromDate,
  validateMutableHourlyRateValidFrom,
  validateNewHourlyRate,
  validateProfileColorAssignment,
  validateProfileEmail,
  validateProfileMobilePhone,
} from "@schichtwerk/database";
import type { Profile } from "@schichtwerk/types";
import { getAdminDatabase, getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

const MAX_EMPLOYEES = 20;

export type ProfileActionResult =
  | { ok: true; profile?: Profile }
  | { ok: false; error: string };

type ProfileContactInput = {
  email: string;
  mobile_phone: string;
  color: string;
};

async function validateProfileContact(
  organizationId: string,
  input: ProfileContactInput,
  excludeProfileId?: string
): Promise<
  | {
      ok: true;
      email: string;
      mobile_phone: string | null;
      color: string;
    }
  | { ok: false; error: string }
> {
  const emailResult = validateProfileEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const phoneResult = validateProfileMobilePhone(input.mobile_phone);
  if (!phoneResult.ok) return phoneResult;

  const db = await getDatabase();
  const usedColors = await db.listAssignedProfileColors(
    organizationId,
    excludeProfileId
  );
  const colorResult = validateProfileColorAssignment(input.color, usedColors);
  if (!colorResult.ok) return colorResult;

  const duplicate = await db.findProfileByEmail(
    organizationId,
    emailResult.email
  );
  if (duplicate && duplicate.id !== excludeProfileId) {
    return { ok: false, error: "Diese E-Mail ist bereits im Team." };
  }

  return {
    ok: true,
    email: emailResult.email,
    mobile_phone: phoneResult.mobile_phone,
    color: input.color.trim().toUpperCase(),
  };
}

async function applyInitialHourlyRate(
  organizationId: string,
  profileId: string,
  createdByProfileId: string,
  hourlyRate?: { amount: string; valid_from: string }
): Promise<ProfileActionResult | null> {
  if (!hourlyRate?.amount.trim()) return null;

  const db = await getDatabase();
  const parsedAmount = parseHourlyRateAmount(hourlyRate.amount);
  if (!parsedAmount.ok) return parsedAmount;

  const parsedDate = parseValidFromDate(hourlyRate.valid_from);
  if (!parsedDate.ok) return parsedDate;

  const serverToday = await db.getServerDateIso();
  const mutableFromCheck = validateMutableHourlyRateValidFrom(
    parsedDate.valid_from,
    serverToday
  );
  if (!mutableFromCheck.ok) return mutableFromCheck;

  const validated = validateNewHourlyRate({
    amount: parsedAmount.amount,
    valid_from: parsedDate.valid_from,
    currentOpenValidFrom: null,
  });
  if (!validated.ok) return validated;

  await db.setProfileHourlyRate(organizationId, profileId, {
    amount: parsedAmount.amount,
    valid_from: parsedDate.valid_from,
    created_by: createdByProfileId,
  });
  return null;
}

export async function createProfile(input: {
  full_name: string;
  is_active: boolean;
  schedulable: boolean;
  email: string;
  mobile_phone: string;
  color: string;
  hourly_rate?: { amount: string; valid_from: string };
}): Promise<ProfileActionResult> {
  try {
    const { organizationId, profile: managerProfile } = await requireManager();
    const fullName = input.full_name.trim();
    if (!fullName) {
      return { ok: false, error: "Bitte einen Namen eingeben." };
    }

    const contact = await validateProfileContact(organizationId, {
      email: input.email,
      mobile_phone: input.mobile_phone,
      color: input.color,
    });
    if (!contact.ok) return contact;

    const db = await getDatabase();
    const admin = getAdminDatabase();
    const schedulable = input.is_active ? input.schedulable : false;

    if (input.is_active) {
      const count = await db.countActiveEmployees(organizationId);
      if (count >= MAX_EMPLOYEES) {
        return {
          ok: false,
          error: `Maximal ${MAX_EMPLOYEES} aktives Personal erlaubt.`,
        };
      }
    }

    const { data: created, error: createError } = await admin.authAdminCreateUser(
      contact.email,
      { full_name: fullName }
    );

    if (createError || !created) {
      return { ok: false, error: createError ?? "Profil konnte nicht angelegt werden" };
    }

    try {
      await admin.insertProfile({
        id: created.user.id,
        organization_id: organizationId,
        role: "basic",
        full_name: fullName,
        email: contact.email,
        mobile_phone: contact.mobile_phone,
        color: contact.color,
        is_active: input.is_active,
        schedulable,
      });
    } catch (e) {
      await admin.authDeleteUser(created.user.id);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Profil fehlgeschlagen",
      };
    }

    const hourlyRateError = await applyInitialHourlyRate(
      organizationId,
      created.user.id,
      managerProfile.id,
      input.hourly_rate
    );
    if (hourlyRateError && !hourlyRateError.ok) return hourlyRateError;

    const profile = await db.getProfileById(created.user.id);
    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true, profile: profile ?? undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function updateProfile(input: {
  id: string;
  full_name: string;
  is_active: boolean;
  schedulable: boolean;
  email: string;
  mobile_phone: string;
  color: string;
  hourly_rate?: { amount: string; valid_from: string };
}): Promise<ProfileActionResult> {
  try {
    const { organizationId, profile: managerProfile } = await requireManager();
    const fullName = input.full_name.trim();
    if (!fullName) {
      return { ok: false, error: "Bitte einen Namen eingeben." };
    }

    const db = await getDatabase();
    const existing = await db.getProfileById(input.id);
    if (!existing || existing.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const contact = await validateProfileContact(
      organizationId,
      {
        email: input.email,
        mobile_phone: input.mobile_phone,
        color: input.color,
      },
      input.id
    );
    if (!contact.ok) return contact;

    const schedulable = input.is_active ? input.schedulable : false;

    if (
      input.is_active &&
      !existing.is_active &&
      existing.role === "basic"
    ) {
      const count = await db.countActiveEmployees(organizationId);
      if (count >= MAX_EMPLOYEES) {
        return {
          ok: false,
          error: `Maximal ${MAX_EMPLOYEES} aktives Personal erlaubt.`,
        };
      }
    }

    if (contact.email !== existing.email.trim().toLowerCase()) {
      const admin = getAdminDatabase();
      const authResult = await admin.authAdminUpdateUserEmail(
        input.id,
        contact.email
      );
      if (authResult.error) {
        return { ok: false, error: authResult.error };
      }
    }

    await db.updateOrganizationProfile(input.id, organizationId, {
      full_name: fullName,
      is_active: input.is_active,
      schedulable,
      email: contact.email,
      mobile_phone: contact.mobile_phone,
      color: contact.color,
    });

    if (input.hourly_rate?.amount.trim()) {
      const parsedAmount = parseHourlyRateAmount(input.hourly_rate.amount);
      if (!parsedAmount.ok) return parsedAmount;

      const parsedDate = parseValidFromDate(input.hourly_rate.valid_from);
      if (!parsedDate.ok) return parsedDate;

      const serverToday = await db.getServerDateIso();
      const mutableFromCheck = validateMutableHourlyRateValidFrom(
        parsedDate.valid_from,
        serverToday
      );
      if (!mutableFromCheck.ok) return mutableFromCheck;

      const openRate = await db.getProfileHourlyRateForDate(
        organizationId,
        input.id,
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

      await db.setProfileHourlyRate(organizationId, input.id, {
        amount: parsedAmount.amount,
        valid_from: parsedDate.valid_from,
        created_by: managerProfile.id,
      });
    }

    const profile = await db.getProfileById(input.id);
    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true, profile: profile ?? undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
    };
  }
}

export async function reorderProfiles(
  orderedIds: string[]
): Promise<ProfileActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.reorderProfiles(organizationId, orderedIds);
    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true };
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

export async function deleteProfile(id: string): Promise<ProfileActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const existing = await db.getProfileById(id);
    if (!existing || existing.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    await db.deactivateEmployee(organizationId, id);

    const profile = await db.getProfileById(id);
    revalidatePath("/dashboard");
    revalidatePath("/planung");
    return { ok: true, profile: profile ?? undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
