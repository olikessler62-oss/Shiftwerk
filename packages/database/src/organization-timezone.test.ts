import { describe, expect, it } from "vitest";
import { resolveOrganizationTimeZone } from "./organization-timezone";

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
