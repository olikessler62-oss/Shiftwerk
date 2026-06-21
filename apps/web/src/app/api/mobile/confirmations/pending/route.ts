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
    const { userId, organization, adminDb } = await requireMobileApiEmployee(request);
    const timeZone = resolveOrganizationTimeZone(organization);
    const fromDate = organizationTodayISO(timeZone);

    const [response, canceledByManagerItems] = await Promise.all([
      adminDb.listEmployeePendingConfirmationItems(
        userId,
        organization.id,
        fromDate,
        organization.shift_confirmation_disclaimer
      ),
      adminDb.listEmployeeManagerCanceledShiftNotifications({
        employeeId: userId,
        organizationId: organization.id,
        fromDate,
      }),
    ]);

    return mobileApiJsonResponse(request, {
      ...response,
      canceledByManagerItems,
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
        : "Offene Anfragen konnten nicht geladen werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
