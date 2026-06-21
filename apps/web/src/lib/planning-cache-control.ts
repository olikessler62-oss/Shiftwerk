import type { NextResponse } from "next/server";

/** Planungsseiten: kein Browser-/Proxy-Caching (F5 muss frische Schichtdaten laden). */
export const PLANNING_RESPONSE_CACHE_CONTROL =
  "private, no-store, no-cache, max-age=0, must-revalidate";

export function applyPlanningNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PLANNING_RESPONSE_CACHE_CONTROL);
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
