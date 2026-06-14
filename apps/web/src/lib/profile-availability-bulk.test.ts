import { describe, expect, it } from "vitest";
import {
  findAvailabilityForWeekdayWindow,
  findBulkEditEntryForWeekday,
  weekdaysWithListedAvailability,
  weekdaysWithMatchingAvailability,
} from "./profile-availability-bulk";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";

function entry(
  overrides: Partial<ProfileRecurringAvailability> &
    Pick<ProfileRecurringAvailability, "id" | "weekday" | "start_time" | "end_time">
): ProfileRecurringAvailability {
  return {
    organization_id: "org",
    profile_id: "profile",
    sort_order: 0,
    created_at: "",
    ...overrides,
  };
}

describe("profile-availability-bulk", () => {
  const list = [
    entry({
      id: "mon",
      weekday: 0,
      start_time: "08:00:00",
      end_time: "22:00:00",
    }),
    entry({
      id: "tue",
      weekday: 1,
      start_time: "8:00:00",
      end_time: "16:00:00",
    }),
    entry({
      id: "wed",
      weekday: 2,
      start_time: "08:00:00",
      end_time: "16:00:00",
    }),
  ];

  it("matches windows with and without leading zeros", () => {
    expect(
      findAvailabilityForWeekdayWindow(1, "08:00", "16:00", list)?.id
    ).toBe("tue");
    expect(weekdaysWithMatchingAvailability("08:00", "16:00", list)).toEqual([
      1, 2,
    ]);
  });

  it("lists weekdays with any availability", () => {
    expect(weekdaysWithListedAvailability(list)).toEqual([0, 1, 2]);
  });

  it("finds the sole entry on a weekday even when reference window differs", () => {
    expect(
      findBulkEditEntryForWeekday(0, list, {
        start: "08:00",
        end: "16:00",
      })?.id
    ).toBe("mon");
  });

  it("prefers the source row on its weekday", () => {
    const multiTuesday = [
      ...list,
      entry({
        id: "tue-late",
        weekday: 1,
        start_time: "18:00:00",
        end_time: "22:00:00",
      }),
    ];
    expect(
      findBulkEditEntryForWeekday(
        1,
        multiTuesday,
        { start: "09:00", end: "18:00" },
        "tue"
      )?.id
    ).toBe("tue");
  });

  it("updates every listed weekday even when windows differ", () => {
    const fullWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
      entry({
        id: `day-${weekday}`,
        weekday,
        start_time: `${8 + weekday}:00:00`,
        end_time: "17:00:00",
      })
    );
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
      expect(
        findBulkEditEntryForWeekday(weekday, fullWeek, {
          start: "08:00",
          end: "16:00",
        })?.id
      ).toBe(`day-${weekday}`);
    }
  });
});
