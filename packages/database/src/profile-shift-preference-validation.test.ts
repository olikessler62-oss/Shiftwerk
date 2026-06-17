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

  it("rejects duplicate for different id", () => {
    expect(
      validateNoDuplicateProfileShiftPreference(
        existing,
        {
          weekday: 0,
          start_time: "08:00",
          end_time: "12:00",
        },
        "b"
      ).ok
    ).toBe(false);
  });
});
