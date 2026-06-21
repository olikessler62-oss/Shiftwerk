import { describe, expect, it } from "vitest";
import {
  mergeStaffingRulesWithOverridesForAreaDate,
  staffingRulesWithOverridesForAreaDate,
} from "./staffing-rules-with-overrides";

const areaA = "area-a";
const areaB = "area-b";
const hour1 = "hour-1";
const hour2 = "hour-2";
const qualWaiter = "qual-waiter";
const qualCook = "qual-cook";

const baseRules = [
  {
    id: "r1",
    location_area_id: areaA,
    service_hour_id: hour1,
    qualification_id: qualWaiter,
    required_count: 2,
  },
  {
    id: "r2",
    location_area_id: areaA,
    service_hour_id: hour1,
    qualification_id: qualCook,
    required_count: 1,
  },
  {
    id: "r3",
    location_area_id: areaA,
    service_hour_id: hour2,
    qualification_id: qualWaiter,
    required_count: 1,
  },
  {
    id: "r4",
    location_area_id: areaB,
    service_hour_id: hour2,
    qualification_id: qualWaiter,
    required_count: 3,
  },
];

describe("staffingRulesWithOverridesForAreaDate", () => {
  it("returns base rules when no overrides exist", () => {
    const rules = staffingRulesWithOverridesForAreaDate(
      baseRules,
      [],
      areaA,
      "2026-06-23"
    );
    expect(rules).toHaveLength(3);
    expect(rules.map((rule) => rule.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("replaces entire service hour when override exists", () => {
    const overrides = [
      {
        id: "o1",
        location_area_id: areaA,
        shift_date: "2026-06-23",
        service_hour_id: hour1,
        qualification_id: qualWaiter,
        required_count: 4,
      },
    ];
    const rules = staffingRulesWithOverridesForAreaDate(
      baseRules,
      overrides,
      areaA,
      "2026-06-23"
    );
    expect(rules).toHaveLength(2);
    expect(rules.find((rule) => rule.service_hour_id === hour1)).toEqual({
      id: "o1",
      location_area_id: areaA,
      service_hour_id: hour1,
      qualification_id: qualWaiter,
      required_count: 4,
    });
    expect(rules.find((rule) => rule.service_hour_id === hour2)?.id).toBe("r3");
  });
});

describe("mergeStaffingRulesWithOverridesForAreaDate", () => {
  it("keeps other areas untouched", () => {
    const overrides = [
      {
        id: "o1",
        location_area_id: areaA,
        shift_date: "2026-06-23",
        service_hour_id: hour1,
        qualification_id: qualWaiter,
        required_count: 5,
      },
    ];
    const rules = mergeStaffingRulesWithOverridesForAreaDate(
      baseRules,
      overrides,
      areaA,
      "2026-06-23"
    );
    expect(rules.find((rule) => rule.location_area_id === areaB)?.required_count).toBe(
      3
    );
    expect(
      rules.filter((rule) => rule.location_area_id === areaA).length
    ).toBe(2);
  });
});
