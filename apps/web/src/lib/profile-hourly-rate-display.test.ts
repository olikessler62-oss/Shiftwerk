import { describe, expect, it } from "vitest";
import type { ProfileHourlyRate } from "@schichtwerk/types";
import {
  resolveHourlyRateEditBounds,
  sortProfileHourlyRatesByValidFrom,
  sortProfileHourlyRatesByValidFromDesc,
} from "@/lib/profile-hourly-rate-display";

function rate(
  id: string,
  validFrom: string,
  validTo: string | null
): ProfileHourlyRate {
  return {
    id,
    organization_id: "org",
    profile_id: "profile",
    amount: 15,
    currency: "EUR",
    valid_from: validFrom,
    valid_to: validTo,
    created_at: "2026-01-01T00:00:00Z",
    created_by: null,
    created_by_name: null,
  };
}

describe("sortProfileHourlyRatesByValidFrom", () => {
  it("sorts ascending by valid_from", () => {
    const sorted = sortProfileHourlyRatesByValidFrom([
      rate("c", "2026-12-01", null),
      rate("a", "2026-01-01", "2026-05-31"),
      rate("b", "2026-06-01", "2026-11-30"),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sortProfileHourlyRatesByValidFromDesc", () => {
  it("sorts descending by valid_from", () => {
    const sorted = sortProfileHourlyRatesByValidFromDesc([
      rate("a", "2026-01-01", "2026-05-31"),
      rate("c", "2026-12-01", null),
      rate("b", "2026-06-01", "2026-11-30"),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });
});

describe("resolveHourlyRateEditBounds", () => {
  it("limits edit valid_from between neighbors", () => {
    const bounds = resolveHourlyRateEditBounds(
      [
        rate("a", "2026-01-01", "2026-05-31"),
        rate("b", "2026-06-01", "2026-11-30"),
        rate("c", "2026-12-01", null),
      ],
      "b"
    );
    expect(bounds.minValidFrom).toBe("2026-01-02");
    expect(bounds.maxValidFrom).toBe("2026-11-30");
  });
});
