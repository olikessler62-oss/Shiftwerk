import { NextResponse } from "next/server";
import type { ConfirmationDecision, ConfirmationRespondBody } from "@schichtwerk/types";
import { MobileApiError, requireMobileApiEmployee } from "@/lib/mobile-api-auth";

function parseRespondBody(value: unknown): ConfirmationRespondBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.items)) return null;

  const items = body.items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.shiftId !== "string") return [];
    if (row.decision !== "confirm" && row.decision !== "reject") return [];
    return [
      {
        shiftId: row.shiftId,
        decision: row.decision as ConfirmationDecision,
      },
    ];
  });

  return { items };
}

export async function POST(request: Request) {
  try {
    const parsed = parseRespondBody(await request.json());
    if (!parsed) {
      return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
    }

    const { userId, profile, organization, adminDb } =
      await requireMobileApiEmployee(request);

    const result = await adminDb.submitEmployeeConfirmationResponses({
      organizationId: organization.id,
      employeeId: userId,
      employeeName: profile.full_name,
      items: parsed.items,
    });

    return NextResponse.json({
      ok: true,
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    if (error instanceof MobileApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Antwort konnte nicht gespeichert werden.";
    const status = message.includes("nicht") || message.includes("Ungültig") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
