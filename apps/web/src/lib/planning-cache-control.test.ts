import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import {
  PLANNING_RESPONSE_CACHE_CONTROL,
  applyPlanningNoStoreHeaders,
} from "@/lib/planning-cache-control";

describe("applyPlanningNoStoreHeaders", () => {
  it("sets no-store cache headers on manager responses", () => {
    const response = applyPlanningNoStoreHeaders(NextResponse.next());

    expect(response.headers.get("Cache-Control")).toBe(
      PLANNING_RESPONSE_CACHE_CONTROL
    );
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");
  });
});
