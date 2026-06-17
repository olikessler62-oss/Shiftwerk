import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { loadDashboardShiftCompensation } from "@/lib/load-dashboard-shift-compensation";
import { isTagAreaShiftRef } from "@/lib/tag-area-footer-stats";
import type { TagAreaShiftRef } from "@/lib/tag-area-footer-stats";

export async function POST(request: Request) {
  const db = await getDatabase();
  const user = await db.authGetUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await db.getProfileOrganizationId(user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawShifts =
    typeof body === "object" && body !== null && "shifts" in body
      ? (body as { shifts: unknown }).shifts
      : undefined;

  if (!Array.isArray(rawShifts)) {
    return NextResponse.json(
      { error: "shifts array required" },
      { status: 400 }
    );
  }

  const shifts = rawShifts.filter(isTagAreaShiftRef) as TagAreaShiftRef[];
  const result = await loadDashboardShiftCompensation(db, orgId, shifts);
  return NextResponse.json(result);
}
