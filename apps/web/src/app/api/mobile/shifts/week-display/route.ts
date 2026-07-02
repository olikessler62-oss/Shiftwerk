import {
  isIsoDate,
  MobileApiError,
  requireMobileApiEmployeeProfile,
} from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return mobileApiJsonResponse(
        request,
        { error: "Parameter from und to (YYYY-MM-DD) sind erforderlich." },
        { status: 400 }
      );
    }
    if (from > to) {
      return mobileApiJsonResponse(
        request,
        { error: "from darf nicht nach to liegen." },
        { status: 400 }
      );
    }

    const { userId, organization, adminDb } =
      await requireMobileApiEmployeeProfile(request);
    const items = await adminDb.listEmployeeShiftWeekDisplay(
      userId,
      organization.id,
      from,
      to
    );

    return mobileApiJsonResponse(request, { items });
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
        : "Wochenanzeige konnte nicht geladen werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
