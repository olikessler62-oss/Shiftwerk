import {
  isIsoDate,
  MobileApiError,
  requireMobileApiEmployee,
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

    const { userId, organization, db } = await requireMobileApiEmployee(request);
    const response = await db.listEmployeeConfirmationWeekItems(
      userId,
      organization.id,
      from,
      to,
      organization.shift_confirmation_disclaimer
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
      error instanceof Error ? error.message : "Wochenliste konnte nicht geladen werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
