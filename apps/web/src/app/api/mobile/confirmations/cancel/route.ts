import { revalidateAreaCalendarShiftsAfterChange } from "@/lib/cached-areacalendar-shifts";
import { MobileApiError, requireMobileApiEmployee } from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";

function parseCancelBody(value: unknown): { shiftId: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.shiftId !== "string" || !body.shiftId.trim()) return null;
  return { shiftId: body.shiftId.trim() };
}

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function POST(request: Request) {
  try {
    const parsed = parseCancelBody(await request.json());
    if (!parsed) {
      return mobileApiJsonResponse(
        request,
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const { userId, profile, organization, adminDb } =
      await requireMobileApiEmployee(request);

    const result = await adminDb.cancelShift({
      organizationId: organization.id,
      shiftId: parsed.shiftId,
      actorId: userId,
      actorRole: "employee",
      employeeName: profile.full_name,
    });

    revalidateAreaCalendarShiftsAfterChange({
      organizationId: organization.id,
      shifts: [{ locationId: result.locationId, shiftDate: result.shiftDate }],
    });

    return mobileApiJsonResponse(request, { ok: true });
  } catch (error) {
    if (error instanceof MobileApiError) {
      return mobileApiJsonResponse(
        request,
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Absage konnte nicht gespeichert werden.";
    const status = message.includes("nicht") || message.includes("Ungültig") ? 400 : 500;
    return mobileApiJsonResponse(request, { error: message }, { status });
  }
}
