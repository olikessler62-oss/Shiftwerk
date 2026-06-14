import { NextResponse } from "next/server";
import {
  isIsoDate,
  MobileApiError,
  requireMobileApiEmployee,
} from "@/lib/mobile-api-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return NextResponse.json(
        { error: "Parameter from und to (YYYY-MM-DD) sind erforderlich." },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
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

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof MobileApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Wochenliste konnte nicht geladen werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
