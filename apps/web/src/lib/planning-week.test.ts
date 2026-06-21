import { describe, expect, it } from "vitest";
import { buildPlanningPageUrl } from "./planning-week";

describe("buildPlanningPageUrl", () => {
  it("preserves week, location and area when switching planning pages", () => {
    const params = new URLSearchParams({
      week: "2026-06-16",
      location: "loc-1",
      area: "area-1",
      profiles: "1",
    });

    expect(buildPlanningPageUrl("/bereich-kalender", params)).toBe(
      "/bereich-kalender?week=2026-06-16&location=loc-1&area=area-1"
    );
    expect(buildPlanningPageUrl("/dashboard", params)).toBe(
      "/dashboard?week=2026-06-16&location=loc-1&area=area-1"
    );
  });

  it("returns pathname without query when no preserved params are set", () => {
    const params = new URLSearchParams({ profiles: "1" });

    expect(buildPlanningPageUrl("/dashboard", params)).toBe("/dashboard");
  });
});
