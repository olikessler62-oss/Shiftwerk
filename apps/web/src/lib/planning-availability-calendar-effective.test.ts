import { describe, expect, it } from "vitest";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  recurringAvailabilityEffectiveOnCalendarDate,
  shouldApplyCurrentAvailabilityToCalendarDate,
} from "./planning-availability-calendar-effective";

function slot(
  overrides: Partial<ProfileRecurringAvailability> &
    Pick<ProfileRecurringAvailability, "id" | "weekday" | "created_at">
): ProfileRecurringAvailability {
  return {
    organization_id: "org-1",
    profile_id: "emp-1",
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    ...overrides,
  };
}

describe("planning availability calendar effective", () => {
  it("applies current rules only from today onward", () => {
    expect(
      shouldApplyCurrentAvailabilityToCalendarDate("2026-06-16", "2026-06-17")
    ).toBe(false);
    expect(
      shouldApplyCurrentAvailabilityToCalendarDate("2026-06-17", "2026-06-17")
    ).toBe(true);
  });

  it("uses all current slots for today and future days", () => {
    const availability = [
      slot({ id: "old", weekday: 1, created_at: "2026-01-01T00:00:00Z" }),
      slot({ id: "new", weekday: 2, created_at: "2026-06-17T10:00:00Z" }),
    ];

    expect(
      recurringAvailabilityEffectiveOnCalendarDate(
        availability,
        "2026-06-18",
        "2026-06-17"
      ).map((entry) => entry.id)
    ).toEqual(["old", "new"]);
  });

  it("excludes slots created after a past calendar day", () => {
    const availability = [
      slot({ id: "old", weekday: 1, created_at: "2026-06-01T00:00:00Z" }),
      slot({ id: "new", weekday: 2, created_at: "2026-06-17T10:00:00Z" }),
    ];

    expect(
      recurringAvailabilityEffectiveOnCalendarDate(
        availability,
        "2026-06-10",
        "2026-06-17"
      ).map((entry) => entry.id)
    ).toEqual(["old"]);
  });
});
