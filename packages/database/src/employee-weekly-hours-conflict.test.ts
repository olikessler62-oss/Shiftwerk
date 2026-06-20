import { describe, expect, it } from "vitest";
import {
  collectEmployeeWeeklyHoursConflicts,
  type ShiftForWeeklyHoursConflict,
} from "./employee-weekly-hours-conflict";

function slot(
  overrides: Partial<ShiftForWeeklyHoursConflict> & Pick<ShiftForWeeklyHoursConflict, "id">
): ShiftForWeeklyHoursConflict {
  return {
    employeeId: "emp-1",
    shift_date: "2026-06-18",
    durationHours: 8,
    confirmation_status: "requested",
    ...overrides,
  };
}

describe("collectEmployeeWeeklyHoursConflicts", () => {
  it("ignores past-only weeks when lowering the weekly target", () => {
    const conflicts = collectEmployeeWeeklyHoursConflicts({
      employeeId: "emp-1",
      targetHours: 32,
      fromDateISO: "2026-06-18",
      shifts: [
        slot({ id: "past", shift_date: "2026-06-16", durationHours: 8 }),
        slot({ id: "past-2", shift_date: "2026-06-17", durationHours: 8 }),
      ],
      includeProposed: true,
    });

    expect(conflicts).toEqual([]);
  });

  it("flags future and today shifts in over-cap weeks but not past days in the same week", () => {
    const conflicts = collectEmployeeWeeklyHoursConflicts({
      employeeId: "emp-1",
      targetHours: 32,
      fromDateISO: "2026-06-18",
      shifts: [
        slot({ id: "mon", shift_date: "2026-06-15", durationHours: 8 }),
        slot({ id: "wed", shift_date: "2026-06-17", durationHours: 8 }),
        slot({ id: "thu", shift_date: "2026-06-18", durationHours: 8 }),
        slot({ id: "fri", shift_date: "2026-06-19", durationHours: 8 }),
        slot({ id: "sat", shift_date: "2026-06-20", durationHours: 8 }),
      ],
      includeProposed: true,
    });

    expect(conflicts.map((row) => row.shiftId)).toEqual(["thu", "fri", "sat"]);
    expect(conflicts[0]?.weekTotalHours).toBe(40);
  });

  it("excludes proposed shifts from hub conflicts unless requested", () => {
    const conflicts = collectEmployeeWeeklyHoursConflicts({
      employeeId: "emp-1",
      targetHours: 24,
      fromDateISO: "2026-06-18",
      shifts: [
        slot({
          id: "proposed",
          shift_date: "2026-06-18",
          confirmation_status: "proposed",
        }),
        slot({
          id: "requested",
          shift_date: "2026-06-19",
          confirmation_status: "requested",
        }),
        slot({
          id: "extra",
          shift_date: "2026-06-20",
          confirmation_status: "requested",
        }),
        slot({
          id: "extra-2",
          shift_date: "2026-06-21",
          confirmation_status: "requested",
        }),
      ],
    });

    expect(conflicts.map((row) => row.shiftId)).toEqual([
      "requested",
      "extra",
      "extra-2",
    ]);
  });
});
