import type { ConfirmationDecision, ConfirmationRespondBody } from "@schichtwerk/types";
import { revalidateAreaCalendarShiftsAfterChange } from "@/lib/cached-areacalendar-shifts";
import { MobileApiError, requireMobileApiEmployee } from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";

function parseOptionalRejectionReason(
  row: Record<string, unknown>
): string | undefined {
  const candidates = [
    row.reason,
    row.rejection_reason,
    row.rejectionReason,
    row.message,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 200);
    }
  }
  return undefined;
}

function parseRespondBody(value: unknown): ConfirmationRespondBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.items)) return null;

  const items = body.items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.shiftId !== "string") return [];
    if (row.decision !== "confirm" && row.decision !== "reject") return [];
    const reason =
      row.decision === "reject" ? parseOptionalRejectionReason(row) : undefined;
    return [
      {
        shiftId: row.shiftId,
        decision: row.decision as ConfirmationDecision,
        ...(reason ? { reason } : {}),
      },
    ];
  });

  return { items };
}

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function POST(request: Request) {
  try {
    const parsed = parseRespondBody(await request.json());
    if (!parsed) {
      return mobileApiJsonResponse(
        request,
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const { userId, profile, organization, adminDb } =
      await requireMobileApiEmployee(request);

    const result = await adminDb.submitEmployeeConfirmationResponses({
      organizationId: organization.id,
      employeeId: userId,
      employeeName: profile.full_name,
      items: parsed.items,
    });

    revalidateAreaCalendarShiftsAfterChange({
      organizationId: organization.id,
      shifts: result.updatedShifts,
    });

    return mobileApiJsonResponse(request, {
      ok: true,
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    if (error instanceof MobileApiError) {
      return mobileApiJsonResponse(
        request,
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Antwort konnte nicht gespeichert werden.";
    const status = message.includes("nicht") || message.includes("Ungültig") ? 400 : 500;
    return mobileApiJsonResponse(request, { error: message }, { status });
  }
}
