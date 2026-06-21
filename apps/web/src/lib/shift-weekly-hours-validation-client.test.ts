import { describe, expect, it } from "vitest";
import {
  filterEmployeesWithinWeeklyHoursForShift,
  validateShiftAssignWeeklyHoursClient,
} from "./shift-weekly-hours-validation-client";

describe("validateShiftAssignWeeklyHoursClient", () => {
  it("blocks assignment when the employee would exceed weekly hours", () => {
    const result = validateShiftAssignWeeklyHoursClient({
      employeeId: "emp-1",
      employeeName: "Anna",
      weeklyHours: 40,
      weekShifts: ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13"].map(
        (shiftDate, index) => ({
          id: `s-${index}`,
          employee_id: "emp-1",
          shift_date: shiftDate,
          startTime: "07:00",
          endTime: "15:00",
        })
      ),
      shiftDate: "2026-06-14",
      startTime: "07:00",
      endTime: "15:00",
      timeZone: "Europe/Berlin",
    });

    expect(result.ok).toBe(false);
  });
});

describe("filterEmployeesWithinWeeklyHoursForShift", () => {
  it("removes employees who would exceed weekly hours for the proposed shift", () => {
    const employees = [
      {
        id: "emp-1",
        full_name: "Anna",
        weekly_hours: 40,
      },
      {
        id: "emp-2",
        full_name: "Ben",
        weekly_hours: 40,
      },
    ];

    const filtered = filterEmployeesWithinWeeklyHoursForShift(employees, {
      weekShifts: ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13"].map(
        (shiftDate, index) => ({
          id: `s-${index}`,
          employee_id: "emp-1",
          shift_date: shiftDate,
          startTime: "07:00",
          endTime: "15:00",
        })
      ),
      shiftDate: "2026-06-14",
      startTime: "07:00",
      endTime: "15:00",
      timeZone: "Europe/Berlin",
    });

    expect(filtered.map((employee) => employee.id)).toEqual(["emp-2"]);
  });
});
