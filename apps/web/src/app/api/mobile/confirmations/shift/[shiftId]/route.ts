import { NextResponse } from "next/server";
import { MobileApiError, requireMobileApiEmployee } from "@/lib/mobile-api-auth";

type RouteContext = {
  params: Promise<{ shiftId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shiftId } = await context.params;
    if (!shiftId?.trim()) {
      return NextResponse.json({ error: "Schicht-ID fehlt." }, { status: 400 });
    }

    const { userId, organization, db } = await requireMobileApiEmployee(request);
    const item = await db.getEmployeeConfirmationShiftItem(
      userId,
      organization.id,
      shiftId,
      organization.shift_confirmation_disclaimer
    );

    if (!item) {
      return NextResponse.json({ error: "Schicht nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof MobileApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Schicht konnte nicht geladen werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
