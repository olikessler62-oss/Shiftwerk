"use server";

import { revalidatePath } from "next/cache";
import { organizationTodayISO, resolveOrganizationTimeZone } from "@schichtwerk/database";
import { revalidateAreaCalendarShiftCacheTags } from "@/lib/cached-areacalendar-shifts";
import { getDatabase } from "@/lib/db";
import { requireSuperadminDeveloper } from "@/lib/superadmin-access";
import { runBiergartenHadrianEckScenario } from "@/lib/superadmin-test-scenarios/biergarten-hadrian-eck";

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

export async function seedSuperadminBiergartenHadrianScenario(): Promise<SuperadminTestScenarioActionResult> {
  try {
    const { organizationId, userId, organization } =
      await requireSuperadminDeveloper();
    const db = await getDatabase();
    const timeZone = resolveOrganizationTimeZone(organization);
    const todayISO = organizationTodayISO(timeZone);

    const result = await runBiergartenHadrianEckScenario(db, {
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
