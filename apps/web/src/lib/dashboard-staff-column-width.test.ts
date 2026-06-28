import { describe, expect, it } from "vitest";
import {
  estimatePlanningStaffColumnWidthPx,
  resolvePlanningStaffColumnWidthPx,
} from "./dashboard-staff-column-width";

describe("resolvePlanningStaffColumnWidthPx", () => {
  it("uses the longest name and hours line plus tolerance", () => {
    const width = resolvePlanningStaffColumnWidthPx({
      employees: [
        {
          id: "emp-1",
          full_name: "Anna",
          weekly_hours: 40,
        },
        {
          id: "emp-2",
          full_name: "Maximilian Mustermann",
          weekly_hours: 38,
        },
      ],
      weeklyHoursCardLabelsByEmployeeId: new Map([
        ["emp-1", "0/40 Std"],
        ["emp-2", "8/38 Std"],
      ]),
      staffColumnHeaderLabel: "Personal",
      employeeHoursLabel: "Mitarbeiter",
    });

    expect(width).toBeGreaterThan(120);
    expect(width).toBeLessThan(280);
  });

  it("respects minimum width for empty employee list", () => {
    expect(
      resolvePlanningStaffColumnWidthPx({
        employees: [],
        weeklyHoursCardLabelsByEmployeeId: new Map(),
        staffColumnHeaderLabel: "Personal",
        employeeHoursLabel: "Mitarbeiter",
      })
    ).toBe(120);
  });

  it("estimate matches resolve when canvas is unavailable", () => {
    const input = {
      employees: [
        {
          id: "emp-1",
          full_name: "Maximilian Mustermann",
          weekly_hours: 40,
        },
      ],
      weeklyHoursCardLabelsByEmployeeId: new Map([["emp-1", "0/40 Std"]]),
      staffColumnHeaderLabel: "Personal",
      employeeHoursLabel: "Mitarbeiter",
    };

    expect(estimatePlanningStaffColumnWidthPx(input)).toBe(
      resolvePlanningStaffColumnWidthPx(input)
    );
  });
});
