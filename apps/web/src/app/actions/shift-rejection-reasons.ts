"use server";

import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { CancellationReasonShiftContext } from "@/lib/cancellation-reason-shift-context";

export async function fetchEmployeeRejectionReasonsForShifts(
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
      db.listEmployeeRejectionReasonsByShiftIds(organizationId, uniqueShiftIds),
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
          : "Ablehnungsgründe konnten nicht geladen werden.",
    };
  }
}
