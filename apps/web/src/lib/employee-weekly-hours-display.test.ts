import { describe, expect, it } from "vitest";
import {
  buildEmployeeWeeklyHoursDisplay,
  buildEmployeeWeeklyHoursDisplayLinesByEmployeeId,
  formatEmployeeWeeklyHoursCardLabel,
  formatEmployeeWeeklyHoursDisplayLines,
} from "@/lib/employee-weekly-hours-display";

const weekDates = ["2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28"];

describe("employee weekly hours display", () => {
  it("shows card label as org-wide total only", () => {
    const display = buildEmployeeWeeklyHoursDisplay({
      employeeId: "emp-1",
      shifts: [
        {
          employee_id: "emp-1",
          shift_date: "2026-06-24",
          startTime: "08:00",
          endTime: "17:00",
          location_id: "loc-a",
        },
        {
          employee_id: "emp-1",
          shift_date: "2026-06-25",
          startTime: "08:00",
          endTime: "16:00",
          location_id: "loc-b",
        },
      ],
      weekDates,
      targetHours: 40,
      locationNameById: new Map([
        ["loc-a", "L'Orangerie"],
        ["loc-b", "Biergarten"],
      ]),
    });

    expect(formatEmployeeWeeklyHoursCardLabel(display, "de")).toBe("17/40 Std");
  });

  it("shows one location tooltip line without sum when only one location", () => {
    const display = buildEmployeeWeeklyHoursDisplay({
      employeeId: "emp-1",
      shifts: [
        {
          employee_id: "emp-1",
          shift_date: "2026-06-24",
          startTime: "08:00",
          endTime: "17:00",
          location_id: "loc-a",
        },
      ],
      weekDates,
      targetHours: 40,
      locationNameById: new Map([["loc-a", "Biergarten"]]),
    });

    expect(formatEmployeeWeeklyHoursDisplayLines(display, "de", "Summe")).toEqual([
      "Biergarten, 9 Std",
    ]);
    expect(display.showTotalLine).toBe(false);
  });

  it("shows per-location hours and sum in tooltip when multiple locations", () => {
    const display = buildEmployeeWeeklyHoursDisplay({
      employeeId: "emp-1",
      shifts: [
        {
          employee_id: "emp-1",
          shift_date: "2026-06-24",
          startTime: "08:00",
          endTime: "17:00",
          location_id: "loc-a",
        },
        {
          employee_id: "emp-1",
          shift_date: "2026-06-25",
          startTime: "08:00",
          endTime: "16:00",
          location_id: "loc-b",
        },
      ],
      weekDates,
      targetHours: 40,
      locationNameById: new Map([
        ["loc-a", "L'Orangerie"],
        ["loc-b", "Biergarten"],
      ]),
    });

    expect(formatEmployeeWeeklyHoursDisplayLines(display, "de", "Summe")).toEqual([
      "Biergarten, 8 Std",
      "L'Orangerie, 9 Std",
      "Summe 17/40 Std",
    ]);
    expect(display.showTotalLine).toBe(true);
  });

  it("builds tooltip labels for all employees", () => {
    const labels = buildEmployeeWeeklyHoursDisplayLinesByEmployeeId({
      employees: [{ id: "emp-1", weekly_hours: 40 }],
      shifts: [
        {
          employee_id: "emp-1",
          shift_date: "2026-06-24",
          startTime: "08:00",
          endTime: "12:00",
          location_id: "loc-a",
        },
      ],
      weekDates,
      locale: "de",
      locationNameById: new Map([["loc-a", "Biergarten"]]),
      totalLabel: "Summe",
    });

    expect(labels.get("emp-1")).toEqual(["Biergarten, 4 Std"]);
  });
});
