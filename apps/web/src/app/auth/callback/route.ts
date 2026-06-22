import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthCallbackRedirectUrl,
  sanitizeAuthNextPath,
} from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/server";

const INVITE_AUTH_ERROR =
  "Einladung oder Link ist ungültig oder abgelaufen. Bitte neue Einladung anfordern.";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeAuthNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        buildAuthCallbackRedirectUrl(request, next)
      );
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      const redirectPath =
        type === "invite" || type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(
        buildAuthCallbackRedirectUrl(request, redirectPath)
      );
    }
  }

  return NextResponse.redirect(
    buildAuthCallbackRedirectUrl(
      request,
      `/login?error=${encodeURIComponent(INVITE_AUTH_ERROR)}`
    )
  );
}
