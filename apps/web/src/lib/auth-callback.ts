import type { NextRequest } from "next/server";

/** Nur relative Pfade — kein Open Redirect. */
export function sanitizeAuthNextPath(next: string | null, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function buildAuthCallbackRedirectUrl(request: NextRequest, path: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (!isLocal && forwardedHost) {
    return `https://${forwardedHost}${path}`;
  }
  const { origin } = new URL(request.url);
  return `${origin}${path}`;
}

export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
