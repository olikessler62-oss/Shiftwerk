"use server";

import { revalidatePath } from "next/cache";
import type { Qualification } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ProfileQualificationActionResult =
  | { ok: true; qualifications?: Qualification[] }
  | { ok: false; error: string };

export async function fetchOrganizationQualifications(): Promise<ProfileQualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const qualifications = await db.listQualifications(organizationId);
    return { ok: true, qualifications };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchProfileQualifications(
  profileId: string
): Promise<ProfileQualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }
    const qualifications = await db.listProfileQualifications(
      organizationId,
      profileId
    );
    return { ok: true, qualifications };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function assignProfileQualification(input: {
  profileId: string;
  qualificationId: string;
}): Promise<ProfileQualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.assignProfileQualification(
      organizationId,
      input.profileId,
      input.qualificationId
    );
    const qualifications = await db.listProfileQualifications(
      organizationId,
      input.profileId
    );
    revalidatePath("/planer");
    return { ok: true, qualifications };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Zuweisen fehlgeschlagen",
    };
  }
}

export async function removeProfileQualification(input: {
  profileId: string;
  qualificationId: string;
}): Promise<ProfileQualificationActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.removeProfileQualification(
      organizationId,
      input.profileId,
      input.qualificationId
    );
    const qualifications = await db.listProfileQualifications(
      organizationId,
      input.profileId
    );
    revalidatePath("/planer");
    return { ok: true, qualifications };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Entfernen fehlgeschlagen",
    };
  }
}
