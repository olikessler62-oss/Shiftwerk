import { MobileApiError, requireMobileApiEmployee } from "@/lib/mobile-api-auth";
import {
  mobileApiJsonResponse,
  mobileApiOptionsResponse,
} from "@/lib/mobile-api-cors";

type RouteContext = {
  params: Promise<{ shiftId: string }>;
};

export async function OPTIONS(request: Request) {
  return mobileApiOptionsResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shiftId } = await context.params;
    if (!shiftId?.trim()) {
      return mobileApiJsonResponse(
        request,
        { error: "Schicht-ID fehlt." },
        { status: 400 }
      );
    }

    const { userId, organization, db } = await requireMobileApiEmployee(request);
    const item = await db.getEmployeeConfirmationShiftItem(
      userId,
      organization.id,
      shiftId,
      organization.shift_confirmation_disclaimer
    );

    if (!item) {
      return mobileApiJsonResponse(
        request,
        { error: "Schicht nicht gefunden." },
        { status: 404 }
      );
    }

    return mobileApiJsonResponse(request, item);
  } catch (error) {
    if (error instanceof MobileApiError) {
      return mobileApiJsonResponse(
        request,
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Schicht konnte nicht geladen werden.";
    return mobileApiJsonResponse(request, { error: message }, { status: 500 });
  }
}
