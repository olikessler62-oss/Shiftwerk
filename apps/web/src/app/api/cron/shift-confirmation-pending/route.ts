import { NextResponse } from "next/server";
import { runShiftConfirmationPendingJobSafe } from "@/lib/run-shift-confirmation-pending-job";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return headerSecret === cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runShiftConfirmationPendingJobSafe();
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Pending job unavailable." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pending job failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
