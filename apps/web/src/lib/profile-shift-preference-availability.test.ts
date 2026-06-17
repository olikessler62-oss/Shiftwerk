import { describe, expect, it } from "vitest";
import {
  findNonConformantProfileShiftPreferences,
  profileShiftPreferenceFitsAvailability,
} from "./profile-shift-preference-availability";
import type {
  ProfileRecurringAvailability,
  ProfileShiftPreference,
} from "@schichtwerk/types";

const availability = (
  weekday: number,
  start_time: string,
  end_time: string
): ProfileRecurringAvailability => ({
  id: `a-${weekday}-${start_time}`,
  organization_id: "org-1",
  profile_id: "profile-1",
  weekday,
  start_time,
  end_time,
  sort_order: 0,
});

const preference = (
  weekday: number,
  start_time: string,
  end_time: string
): ProfileShiftPreference => ({
  id: `p-${weekday}-${start_time}`,
  organization_id: "org-1",
  profile_id: "profile-1",
  weekday,
  start_time,
  end_time,
  location_id: null,
  location_area_id: null,
  qualification_id: null,
  priority: 0,
  created_at: "",
  updated_at: "",
});

describe("profileShiftPreferenceFitsAvailability", () => {
  it("returns true when preference lies within a same-day slot", () => {
    expect(
      profileShiftPreferenceFitsAvailability(
        preference(1, "09:00", "12:00"),
        [availability(1, "08:00", "17:00")]
      )
    ).toBe(true);
  });

  it("returns false when preference exceeds availability window", () => {
    expect(
      profileShiftPreferenceFitsAvailability(
        preference(1, "08:00", "12:00"),
        [availability(1, "09:00", "17:00")]
      )
    ).toBe(false);
  });

  it("returns false when weekday has no availability", () => {
    expect(
      profileShiftPreferenceFitsAvailability(
        preference(2, "08:00", "12:00"),
        [availability(1, "08:00", "17:00")]
      )
    ).toBe(false);
  });
});

describe("findNonConformantProfileShiftPreferences", () => {
  it("lists only preferences outside updated availability", () => {
    const preferences = [
      preference(1, "09:00", "12:00"),
      preference(2, "08:00", "12:00"),
    ];
    const slots = [availability(1, "08:00", "17:00")];

    expect(findNonConformantProfileShiftPreferences(preferences, slots)).toEqual([
      preferences[1],
    ]);
  });
});
