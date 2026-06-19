import { describe, expect, it } from "vitest";
import type { ProfileCompensationSurcharge } from "@schichtwerk/types";
import { sortProfileCompensationSurchargesByValidFromDesc } from "@/lib/profile-surcharge-display";

function entry(id: string, validFrom: string): ProfileCompensationSurcharge {
  return {
    id,
    organization_id: "org",
    profile_id: "profile",
    surcharge_type_id: "type",
    surcharge_type_name: "Sonntag",
    trigger: "sunday",
    type_default_amount: 5,
    type_default_unit: "percent_of_base",
    amount: null,
    unit: null,
    valid_from: validFrom,
    valid_to: null,
    created_at: "2026-01-01T00:00:00Z",
    created_by: null,
    created_by_name: null,
  };
}

describe("sortProfileCompensationSurchargesByValidFromDesc", () => {
  it("sorts descending by valid_from", () => {
    const sorted = sortProfileCompensationSurchargesByValidFromDesc([
      entry("a", "2026-01-01"),
      entry("c", "2026-12-01"),
      entry("b", "2026-06-01"),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["c", "b", "a"]);
  });
});
