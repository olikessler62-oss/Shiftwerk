import {
  MobileApiError,
  isIsoDate,
  requireMobileApiEmployeeProfile,
} from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";
import {
  patchMobileAbsence,
  type PatchMobileAbsenceBody,
} from "@/lib/mobile-absence-service";

function parsePatchBody(value: unknown): PatchMobileAbsenceBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.action !== "string") return null;

  if (body.action === "cancel") {
    return { action: "cancel" };
  }

  if (body.action === "closeSick") {
    if (typeof body.endDate !== "string" || !isIsoDate(body.endDate)) return null;
    return { action: "closeSick", endDate: body.endDate };
  }

  if (body.action === "extend") {
    const expectedEndDate =
      body.expectedEndDate === null || body.expectedEndDate === undefined
        ? null
        : typeof body.expectedEndDate === "string"
          ? body.expectedEndDate
          : undefined;
    if (expectedEndDate === undefined) return null;
    return { action: "extend", expectedEndDate };
  }

  return null;
}

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return mobileApiJsonResponse(
        request,
        { error: "Ungültige Abwesenheits-ID." },
        { status: 400 }
      );
    }

    const parsed = parsePatchBody(await request.json());
    if (!parsed) {
      return mobileApiJsonResponse(
        request,
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const { userId, organization, adminDb } =
      await requireMobileApiEmployeeProfile(request);

    const result = await patchMobileAbsence(
      adminDb,
      organization,
      userId,
      id.trim(),
      parsed
    );
    if (!result.ok) {
      return mobileApiJsonResponse(request, { error: result.error }, { status: result.status });
    }

    return mobileApiJsonResponse(request, { ok: true, id: result.id });
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
        : "Aktion konnte nicht gespeichert werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
