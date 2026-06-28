import { describe, expect, it } from "vitest";
import {
  employeeMeetsOrganizationDayShiftCompliance,
  findBulkShiftDayComplianceViolation,
} from "./bulk-shift-day-compliance";

describe("employeeMeetsOrganizationDayShiftCompliance", () => {
  it("rejects an oversized shift even with an existing morning assignment elsewhere", () => {
    const eligible = employeeMeetsOrganizationDayShiftCompliance({
      countryCode: "DE",
      shiftDate: "2025-06-02",
      employeeId: "emp-1",
      windowStart: "13:00",
      windowEnd: "24:00",
      organizationDayAssignments: [
        {
          employeeId: "emp-1",
          startTime: "08:00",
          endTime: "12:00",
          locationAreaId: "area-a",
        },
      ],
    });

    expect(eligible).toBe(false);
  });

  it("accepts split duty across two buildings within limits", () => {
    const eligible = employeeMeetsOrganizationDayShiftCompliance({
      countryCode: "DE",
      shiftDate: "2025-06-02",
      employeeId: "emp-1",
      windowStart: "13:00",
      windowEnd: "17:00",
      organizationDayAssignments: [
        {
          employeeId: "emp-1",
          startTime: "08:00",
          endTime: "12:00",
          locationAreaId: "area-a",
        },
      ],
    });

    expect(eligible).toBe(true);
  });
});

describe("findBulkShiftDayComplianceViolation", () => {
  const translate = (key: string) => key;

  it("checks compliance against org-wide external assignments", () => {
    const violation = findBulkShiftDayComplianceViolation(
      "2025-06-02",
      "DE",
      [
        {
          employeeId: "emp-1",
          startTime: "13:00",
          endTime: "24:00",
        },
      ],
      [
        {
          employeeId: "emp-1",
          startTime: "08:00",
          endTime: "12:00",
          locationAreaId: "other-location-area",
        },
      ],
      "current-area",
      new Map([["emp-1", "Alex"]]),
      translate
    );

    expect(violation).toBeTruthy();
  });

  it("accepts split duty across buildings when each window stays within limits", () => {
    const violation = findBulkShiftDayComplianceViolation(
      "2025-06-02",
      "DE",
      [
        {
          employeeId: "emp-1",
          startTime: "13:00",
          endTime: "17:00",
        },
      ],
      [
        {
          employeeId: "emp-1",
          startTime: "08:00",
          endTime: "12:00",
          locationAreaId: "other-location-area",
        },
      ],
      "current-area",
      new Map([["emp-1", "Alex"]]),
      translate
    );

    expect(violation).toBeNull();
  });
});
