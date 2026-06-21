import { MobileApiError, requireMobileApiEmployee } from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";

function parseDismissBody(value: unknown): { shiftId: string } | null {
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
    const parsed = parseDismissBody(await request.json());
    if (!parsed) {
      return mobileApiJsonResponse(
        request,
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const { userId, organization, adminDb } =
      await requireMobileApiEmployee(request);

    await adminDb.dismissCanceledShiftFromEmployeeView({
      organizationId: organization.id,
      shiftId: parsed.shiftId,
      employeeId: userId,
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
      error instanceof Error
        ? error.message
        : "Schicht konnte nicht entfernt werden.";
    const status = message.includes("nicht") || message.includes("Ungültig") ? 400 : 500;
    return mobileApiJsonResponse(request, { error: message }, { status });
  }
}
