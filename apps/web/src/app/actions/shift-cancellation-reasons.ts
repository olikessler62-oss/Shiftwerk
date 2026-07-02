"use server";

import type { CancellationReasonShiftContext } from "@/lib/cancellation-reason-shift-context";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export async function fetchEmployeeCancellationReasonsForShifts(
  shiftIds: readonly string[]
): Promise<
  | {
      ok: true;
      reasons: Record<string, string>;
      shiftContexts: Record<string, CancellationReasonShiftContext>;
    }
  | { ok: false; error: string }
> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const uniqueShiftIds = [...new Set(shiftIds.filter(Boolean))];
    const [reasons, shiftContexts] = await Promise.all([
      db.listEmployeeCancellationReasonsByShiftIds(organizationId, uniqueShiftIds),
      db.listShiftCancellationContextByShiftIds(organizationId, uniqueShiftIds),
    ]);
    return {
      ok: true,
      reasons: Object.fromEntries(reasons),
      shiftContexts: Object.fromEntries(shiftContexts),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Absagegründe konnten nicht geladen werden.",
    };
  }
}
