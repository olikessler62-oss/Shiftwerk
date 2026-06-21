import { describe, expect, it } from "vitest";
import type { ProfileCompensationSurcharge } from "@schichtwerk/types";
import {
  assignableCompensationSurchargeTypesForProfile,
  sortProfileCompensationSurchargesByValidFromDesc,
} from "@/lib/profile-surcharge-display";

function entry(
  id: string,
  validFrom: string,
  surchargeTypeId = "type-a"
): ProfileCompensationSurcharge {
  return {
    id,
    organization_id: "org",
    profile_id: "profile",
    surcharge_type_id: surchargeTypeId,
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

describe("assignableCompensationSurchargeTypesForProfile", () => {
  const types = [
    { id: "type-a", name: "Sonntag" },
    { id: "type-b", name: "Nacht" },
  ];

  it("includes every type when no open entries exist", () => {
    const assignable = assignableCompensationSurchargeTypesForProfile({
      types,
      surchargeEntries: [
        { ...entry("a", "2026-01-01", "type-a"), valid_to: "2026-05-01" },
      ],
      serverToday: "2026-06-20",
    });
    expect(assignable.map((type) => type.id)).toEqual(["type-a", "type-b"]);
  });

  it("includes types with a non-mutable open entry so a new period can be created", () => {
    const historical = entry("a", "2026-01-01");
    const assignable = assignableCompensationSurchargeTypesForProfile({
      types,
      surchargeEntries: [historical],
      serverToday: "2026-06-20",
    });
    expect(assignable.map((type) => type.id)).toEqual(["type-a", "type-b"]);
  });

  it("excludes types with a mutable open entry", () => {
    const openToday = entry("a", "2026-06-20");
    const assignable = assignableCompensationSurchargeTypesForProfile({
      types,
      surchargeEntries: [openToday],
      serverToday: "2026-06-20",
    });
    expect(assignable.map((type) => type.id)).toEqual(["type-b"]);
  });
});

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
