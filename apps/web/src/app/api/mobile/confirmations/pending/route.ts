import {
  MobileApiError,
  requireMobileApiEmployee,
} from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";
import {
  organizationTodayISO,
  resolveOrganizationTimeZone,
} from "@schichtwerk/database";

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function GET(request: Request) {
  try {
    const { userId, organization, db } = await requireMobileApiEmployee(request);
    const timeZone = resolveOrganizationTimeZone(organization);
    const fromDate = organizationTodayISO(timeZone);

    const response = await db.listEmployeePendingConfirmationItems(
      userId,
      organization.id,
      fromDate,
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
      error instanceof Error
        ? error.message
        : "Offene Anfragen konnten nicht geladen werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
