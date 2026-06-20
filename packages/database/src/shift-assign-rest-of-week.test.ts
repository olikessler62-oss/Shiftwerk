import { describe, expect, it } from "vitest";
import type { LocationAreaStaffing } from "@schichtwerk/types";
import {
  employeeMeetsStaffingDemandQualification,
  hasStaffingDemandForShiftWindow,
  restWeekStaffingDemandEligible,
} from "./shift-assign-rest-of-week";

const areaId = "area-1";
const serviceHourId = "hour-1";
const qualId = "qual-1";
const employeeId = "emp-1";

const serviceHours = [
  {
    id: serviceHourId,
    location_area_id: areaId,
    weekday: 2,
    start_time: "08:00",
    end_time: "18:00",
  },
];

const staffingRules: LocationAreaStaffing[] = [
  {
    id: "rule-1",
    location_area_id: areaId,
    service_hour_id: serviceHourId,
    qualification_id: qualId,
    required_count: 1,
  },
];

describe("hasStaffingDemandForShiftWindow", () => {
  it("returns true when demand exists for matching service hour", () => {
    expect(
      hasStaffingDemandForShiftWindow({
        areaId,
        countryCode: "DE",
        shiftDate: "2026-06-10",
        startTime: "09:00",
        endTime: "15:00",
        serviceHours,
        staffingRules,
      })
    ).toBe(true);
  });

  it("returns false when no staffing rule matches the service hour", () => {
    expect(
      hasStaffingDemandForShiftWindow({
        areaId,
        countryCode: "DE",
        shiftDate: "2026-06-10",
        startTime: "09:00",
        endTime: "15:00",
        serviceHours,
        staffingRules: [],
      })
    ).toBe(false);
  });
});

describe("restWeekStaffingDemandEligible", () => {
  it("returns true when demand exists and employee has qualification", () => {
    expect(
      restWeekStaffingDemandEligible({
        areaId,
        countryCode: "DE",
        shiftDate: "2026-06-10",
        startTime: "09:00",
        endTime: "15:00",
        employeeId,
        serviceHours,
        staffingRules,
        employeeQualificationIds: new Set([qualId]),
        qualificationNameById: new Map([[qualId, "Koch"]]),
      })
    ).toBe(true);
  });

  it("returns false when employee lacks required qualification", () => {
    expect(
      employeeMeetsStaffingDemandQualification({
        areaId,
        countryCode: "DE",
        shiftDate: "2026-06-10",
        startTime: "09:00",
        endTime: "15:00",
        employeeId,
        serviceHours,
        staffingRules,
        employeeQualificationIds: new Set(),
        qualificationNameById: new Map([[qualId, "Koch"]]),
      })
    ).toBe(false);
  });

  it("returns true when qualification status is neutral", () => {
    expect(
      employeeMeetsStaffingDemandQualification({
        areaId,
        countryCode: "DE",
        shiftDate: "2026-06-10",
        startTime: "00:00",
        endTime: "00:00",
        employeeId,
        serviceHours,
        staffingRules,
        employeeQualificationIds: new Set([qualId]),
        qualificationNameById: new Map([[qualId, "Koch"]]),
      })
    ).toBe(true);
  });
});
