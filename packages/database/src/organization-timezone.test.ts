import { describe, expect, it } from "vitest";
import { resolveOrganizationTimeZone, organizationTodayISO } from "./organization-timezone";

describe("resolveOrganizationTimeZone", () => {
  it("prefers explicit organizations.timezone", () => {
    expect(
      resolveOrganizationTimeZone({
        timezone: "America/New_York",
        country_code: "DE",
      })
    ).toBe("America/New_York");
  });

  it("falls back to country_code mapping", () => {
    expect(resolveOrganizationTimeZone({ country_code: "AT" })).toBe(
      "Europe/Vienna"
    );
  });

  it("uses default when nothing is configured", () => {
    expect(resolveOrganizationTimeZone(null)).toBe("Europe/Berlin");
  });
});

describe("organizationTodayISO", () => {
  it("returns the calendar date in the organization timezone", () => {
    const now = new Date("2026-06-17T22:30:00.000Z");
    expect(organizationTodayISO("Europe/Berlin", now)).toBe("2026-06-18");
    expect(organizationTodayISO("America/New_York", now)).toBe("2026-06-17");
  });
});
