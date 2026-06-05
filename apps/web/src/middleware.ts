import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createDatabase } from "@schichtwerk/database";
import { updateSession } from "@/lib/supabase/middleware";

const MANAGER_ROUTES = [
  "/dashboard",
  "/planung",
  "/team",
  "/abwesenheiten",
  "/berichte",
  "/einstellungen",
];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isProtected = MANAGER_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );

  if (!isProtected) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const db = createDatabase(supabase);
  const user = await db.authGetUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const role = await db.getProfileRole(user.id);

  if (role === "basic") {
    const url = request.nextUrl.clone();
    url.pathname = "/app-only";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/dashboard/:path*",
    "/planung/:path*",
    "/team/:path*",
    "/abwesenheiten/:path*",
    "/berichte/:path*",
    "/einstellungen/:path*",
    "/auth/callback",
  ],
};
