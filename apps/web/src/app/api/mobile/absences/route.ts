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
  createMobileAbsence,
  listMobileAbsences,
  type CreateMobileAbsenceBody,
} from "@/lib/mobile-absence-service";
import { notifyManagersOfSubmittedAbsence } from "@/lib/absence-notifications";
import type { AbsenceType } from "@schichtwerk/types";

const VALID_ABSENCE_TYPES = new Set<AbsenceType>(["sick", "vacation", "other"]);

function parseListFilters(url: URL): { from?: string; to?: string } {
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  const filters: { from?: string; to?: string } = {};
  if (from && isIsoDate(from)) filters.from = from;
  if (to && isIsoDate(to)) filters.to = to;
  return filters;
}

function parseCreateBody(value: unknown): CreateMobileAbsenceBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.type !== "string" || !body.type.trim()) return null;
  const type = body.type.trim() as AbsenceType;
  if (!VALID_ABSENCE_TYPES.has(type)) return null;
  if (typeof body.startDate !== "string" || !isIsoDate(body.startDate)) return null;
  if (typeof body.isOpenEnded !== "boolean") return null;

  return {
    type,
    startDate: body.startDate,
    endDate:
      body.endDate === null || body.endDate === undefined
        ? null
        : typeof body.endDate === "string"
          ? body.endDate
          : null,
    isOpenEnded: body.isOpenEnded,
    expectedEndDate:
      body.expectedEndDate === null || body.expectedEndDate === undefined
        ? null
        : typeof body.expectedEndDate === "string"
          ? body.expectedEndDate
          : null,
    notes:
      body.notes === null || body.notes === undefined
        ? null
        : typeof body.notes === "string"
          ? body.notes
          : null,
  };
}

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function GET(request: Request) {
  try {
    const { userId, organization, adminDb } =
      await requireMobileApiEmployeeProfile(request);
    const filters = parseListFilters(new URL(request.url));
    const response = await listMobileAbsences(
      adminDb,
      organization.id,
      userId,
      filters
    );
    return mobileApiJsonResponse(request, response);
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
        : "Abwesenheiten konnten nicht geladen werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = parseCreateBody(await request.json());
    if (!parsed) {
      return mobileApiJsonResponse(
        request,
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const { userId, profile, organization, adminDb } =
      await requireMobileApiEmployeeProfile(request);

    const result = await createMobileAbsence(adminDb, organization, userId, parsed);
    if (!result.ok) {
      return mobileApiJsonResponse(request, { error: result.error }, { status: result.status });
    }

    const isOpenEnded = parsed.type === "sick" ? parsed.isOpenEnded : false;
    const endDate = isOpenEnded ? null : (parsed.endDate ?? null);

    try {
      await notifyManagersOfSubmittedAbsence(adminDb, {
        organizationId: organization.id,
        employeeId: userId,
        employeeName: profile.full_name,
        absenceId: result.id,
        type: parsed.type,
        startDate: parsed.startDate,
        endDate,
        isOpenEnded,
        status: result.status,
      });
    } catch (notifyError) {
      console.error("Manager-Benachrichtigung für Abwesenheit fehlgeschlagen:", notifyError);
    }

    return mobileApiJsonResponse(request, {
      ok: true,
      id: result.id,
      shiftConflictCount: result.shiftConflictCount ?? 0,
      status: result.status,
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
      error instanceof Error
        ? error.message
        : "Abwesenheit konnte nicht gespeichert werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
