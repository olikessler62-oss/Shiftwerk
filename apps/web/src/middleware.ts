import { type NextRequest, NextResponse } from "next/server";
import { applyPlanningNoStoreHeaders } from "@/lib/planning-cache-control";
import { updateSession } from "@/lib/supabase/middleware";

const MANAGER_ROUTES = [
  "/bereich-kalender",
  "/dashboard",
  "/planer",
  "/planung",
  "/abwesenheiten",
  "/berichte",
  "/uebersicht",
  "/einstellungen",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { response, user: sessionUser } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isProtected = MANAGER_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );

  if (!isProtected) return response;

  const withPlanningCacheHeaders = (res: NextResponse) =>
    applyPlanningNoStoreHeaders(res);

  if (!sessionUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return withPlanningCacheHeaders(NextResponse.redirect(url));
  }

  // basic-Rolle: Redirect im Manager-Layout (Profil ohne doppelte Middleware-Query).
  return withPlanningCacheHeaders(response);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/bereich-kalender/:path*",
    "/dashboard/:path*",
    "/planer/:path*",
    "/planung/:path*",
    "/abwesenheiten/:path*",
    "/berichte/:path*",
    "/uebersicht/:path*",
    "/einstellungen/:path*",
    "/settings/:path*",
    "/auth/callback",
  ],
};
