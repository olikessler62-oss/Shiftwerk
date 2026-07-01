"use server";

import { revalidatePath } from "next/cache";
import { organizationTodayISO, resolveOrganizationTimeZone, addDaysISO } from "@schichtwerk/database";
import { revalidateAreaCalendarShiftCacheTags } from "@/lib/cached-areacalendar-shifts";
import { getAdminDatabase } from "@/lib/db";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import {
  runBiergartenHadrianEckScenario,
  type BiergartenHadrianShiftCoverageMode,
} from "@/lib/superadmin-test-scenarios/biergarten-hadrian-eck";
import { runFriseurSalonZentraleScenario } from "@/lib/superadmin-test-scenarios/friseur-salon-zentrale";
import { runPflegedienstZentraleScenario } from "@/lib/superadmin-test-scenarios/pflegedienst-zentrale";

export type SuperadminTestScenarioActionResult =
  | {
      ok: true;
      weekStart: string;
      locationCount: number;
      areaCount: number;
      shiftCount: number;
      openSlots: number;
      coveredSlots: number;
    }
  | { ok: false; errorKey: string; error?: string };

export type { BiergartenHadrianShiftCoverageMode };

function actionError(
  errorKey: string,
  error: unknown
): Extract<SuperadminTestScenarioActionResult, { ok: false }> {
  return {
    ok: false,
    errorKey,
    error: error instanceof Error ? error.message : undefined,
  };
}

export async function seedSuperadminBiergartenHadrianScenario(
  shiftCoverageMode: BiergartenHadrianShiftCoverageMode
): Promise<SuperadminTestScenarioActionResult> {
  try {
    const { organizationId, userId, organization } =
      await requireSuperadminDeveloper();
    const db = getAdminDatabase();
    const timeZone = resolveOrganizationTimeZone(organization);
    const todayISO = organizationTodayISO(timeZone);

    const result = await runBiergartenHadrianEckScenario(db, {
      organizationId,
      actorId: userId,
      timeZone,
      todayISO,
      shiftCoverageMode,
    });

    revalidateAreaCalendarShiftCacheTags({
      organizationId,
      weekStarts: [result.weekStart, addDaysISO(result.weekStart, 7)],
    });
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");

    return { ok: true, ...result };
  } catch (error) {
    return actionError("superadmin.errors.seedTestScenarioFailed", error);
  }
}

export async function seedSuperadminFriseurSalonZentraleScenario(): Promise<SuperadminTestScenarioActionResult> {
  try {
    const { organizationId, userId, organization } =
      await requireSuperadminDeveloper();
    const db = getAdminDatabase();
    const timeZone = resolveOrganizationTimeZone(organization);
    const todayISO = organizationTodayISO(timeZone);

    const result = await runFriseurSalonZentraleScenario(db, {
      organizationId,
      actorId: userId,
      timeZone,
      todayISO,
    });

    revalidateAreaCalendarShiftCacheTags({
      organizationId,
      weekStarts: [result.weekStart],
    });
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");

    return { ok: true, ...result };
  } catch (error) {
    return actionError("superadmin.errors.seedTestScenarioFailed", error);
  }
}

export async function seedSuperadminPflegedienstZentraleScenario(): Promise<SuperadminTestScenarioActionResult> {
  try {
    const { organizationId, userId, organization } =
      await requireSuperadminDeveloper();
    const db = getAdminDatabase();
    const timeZone = resolveOrganizationTimeZone(organization);
    const todayISO = organizationTodayISO(timeZone);

    const result = await runPflegedienstZentraleScenario(db, {
      organizationId,
      actorId: userId,
      timeZone,
      todayISO,
    });

    revalidateAreaCalendarShiftCacheTags({
      organizationId,
      weekStarts: [result.weekStart],
    });
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");

    return { ok: true, ...result };
  } catch (error) {
    return actionError("superadmin.errors.seedTestScenarioFailed", error);
  }
}
