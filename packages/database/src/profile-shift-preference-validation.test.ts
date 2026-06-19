import { describe, expect, it } from "vitest";
import {
  findProfileShiftPreferenceDuplicate,
  validateNoDuplicateProfileShiftPreference,
} from "./profile-shift-preference-validation";

const existing = [
  {
    id: "a",
    weekday: 0,
    start_time: "08:00:00",
    end_time: "12:00:00",
    location_area_id: null,
  },
  {
    id: "b",
    weekday: 1,
    start_time: "08:00",
    end_time: "12:00",
    location_area_id: null,
  },
];

describe("profile shift preference duplicate validation", () => {
  it("finds duplicate by weekday and time window", () => {
    expect(
      findProfileShiftPreferenceDuplicate(existing, {
        weekday: 0,
        start_time: "08:00",
        end_time: "12:00",
      })?.id
    ).toBe("a");
  });

  it("ignores duplicate check for excluded id on update", () => {
    expect(
      validateNoDuplicateProfileShiftPreference(
        existing,
        {
          weekday: 0,
          start_time: "08:00",
          end_time: "12:00",
        },
        "a"
      ).ok
    ).toBe(true);
  });

  it("finds duplicate placement-only wish", () => {
    const placementOnly = [
      {
        id: "c",
        weekday: null,
        start_time: null,
        end_time: null,
        location_id: null,
        location_area_id: "area-1",
        qualification_id: null,
      },
    ];
    expect(
      findProfileShiftPreferenceDuplicate(placementOnly, {
        weekday: null,
        start_time: null,
        end_time: null,
        location_area_id: "area-1",
      })?.id
    ).toBe("c");
  });
});
