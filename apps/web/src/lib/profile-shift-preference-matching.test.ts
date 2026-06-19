import { describe, expect, it } from "vitest";
import {
  employeeWishScore,
  isEmployeeWishFulfilled,
  pickEmployeeForBulkPrefill,
} from "./profile-shift-preference-matching";

const context = {
  weekday: 1,
  demandStart: "08:00",
  demandEnd: "12:00",
  areaId: "area-1",
  locationId: "loc-1",
  qualificationId: "qual-1",
};

describe("profile shift preference matching", () => {
  it("prioritizes employee with matching area-only wish", () => {
    const preferences = {
      "emp-1": [
        {
          weekday: null,
          start_time: null,
          end_time: null,
          location_id: null,
          location_area_id: "area-1",
          qualification_id: null,
          priority: 0,
        },
      ],
      "emp-2": [],
    };

    const result = pickEmployeeForBulkPrefill(
      [
        { id: "emp-1", full_name: "Anna", last_shift_date: "2026-06-01" },
        { id: "emp-2", full_name: "Ben", last_shift_date: null },
      ],
      context,
      preferences
    );

    expect(result.employee?.id).toBe("emp-1");
    expect(result.wishFulfilled).toBe(true);
  });

  it("reports unfulfilled wish when employee has time wish without overlap", () => {
    const preferences = {
      "emp-1": [
        {
          weekday: 1,
          start_time: "13:00",
          end_time: "17:00",
          location_id: null,
          location_area_id: null,
          qualification_id: null,
          priority: 0,
        },
      ],
    };

    expect(
      isEmployeeWishFulfilled("emp-1", context, preferences)
    ).toBe(false);
    expect(employeeWishScore("emp-1", context, preferences)).toBe(0);
  });

  it("matches time and qualification together", () => {
    const preferences = {
      "emp-1": [
        {
          weekday: 1,
          start_time: "08:00",
          end_time: "12:00",
          location_id: null,
          location_area_id: null,
          qualification_id: "qual-1",
          priority: 2,
        },
      ],
    };

    expect(employeeWishScore("emp-1", context, preferences)).toBeGreaterThan(
      0
    );
  });
});
