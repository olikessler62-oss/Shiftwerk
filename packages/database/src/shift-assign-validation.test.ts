import { describe, expect, it } from "vitest";
import type {
  AbsenceRequest,
  LocationAreaStaffing,
  ProfileRecurringAvailability,
} from "@schichtwerk/types";
import { validateShiftAssignEligibility } from "./shift-assign-validation";

const employeeId = "emp-1";
const areaId = "area-1";
const serviceHourId = "hour-1";
const qualId = "qual-1";

function absence(
  overrides: Partial<AbsenceRequest> = {}
): AbsenceRequest {
  return {
    id: "abs-1",
    organization_id: "org-1",
    employee_id: employeeId,
    type: "vacation",
    start_date: "2026-06-10",
    end_date: "2026-06-12",
    status: "approved",
    notes: null,
    reviewed_by: "mgr-1",
    ...overrides,
  };
}

function slot(
  overrides: Partial<ProfileRecurringAvailability> = {}
): ProfileRecurringAvailability {
  return {
    id: "slot-1",
    organization_id: "org-1",
    profile_id: employeeId,
    weekday: 1,
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const baseInput = {
  employeeId,
  shiftDate: "2026-06-09", // Tuesday (weekday 1)
  startTime: "09:00",
  endTime: "15:00",
  locationAreaId: null as string | null,
};

describe("validateShiftAssignEligibility", () => {
  it("simple mode accepts shift with availability only", () => {
    const result = validateShiftAssignEligibility(
      "simple",
      {
        countryCode: "DE",
        recurringAvailability: [slot()],
        absences: [],
      },
      baseInput
    );
    expect(result.ok).toBe(true);
  });

  it("simple mode skips qualification check even when area is set", () => {
    const result = validateShiftAssignEligibility(
      "simple",
      {
        countryCode: "DE",
        recurringAvailability: [slot()],
        absences: [],
        staffingRules: [
          {
            id: "rule-1",
            location_area_id: areaId,
            service_hour_id: serviceHourId,
            qualification_id: qualId,
            required_count: 1,
          } satisfies LocationAreaStaffing,
        ],
        serviceHours: [
          {
            id: serviceHourId,
            location_area_id: areaId,
            weekday: 1,
            start_time: "08:00",
            end_time: "18:00",
          },
        ],
        profileQualificationIds: new Map([[employeeId, new Set<string>()]]),
        qualificationNameById: new Map([[qualId, "Koch"]]),
      },
      { ...baseInput, locationAreaId: areaId }
    );
    expect(result.ok).toBe(true);
  });

  it("simple mode rejects absent employee", () => {
    const result = validateShiftAssignEligibility(
      "simple",
      {
        countryCode: "DE",
        recurringAvailability: [slot()],
        absences: [absence({ start_date: "2026-06-09", end_date: "2026-06-09" })],
      },
      baseInput
    );
    expect(result.ok).toBe(false);
  });

  it("advanced mode rejects missing qualification", () => {
    const result = validateShiftAssignEligibility(
      "advanced",
      {
        countryCode: "DE",
        recurringAvailability: [slot()],
        absences: [],
        staffingRules: [
          {
            id: "rule-1",
            location_area_id: areaId,
            service_hour_id: serviceHourId,
            qualification_id: qualId,
            required_count: 1,
          } satisfies LocationAreaStaffing,
        ],
        serviceHours: [
          {
            id: serviceHourId,
            location_area_id: areaId,
            weekday: 1,
            start_time: "08:00",
            end_time: "18:00",
          },
        ],
        profileQualificationIds: new Map([[employeeId, new Set<string>()]]),
        qualificationNameById: new Map([[qualId, "Koch"]]),
      },
      { ...baseInput, locationAreaId: areaId }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Qualifikation");
    }
  });

  it("advanced mode accepts matching qualification", () => {
    const result = validateShiftAssignEligibility(
      "advanced",
      {
        countryCode: "DE",
        recurringAvailability: [slot()],
        absences: [],
        staffingRules: [
          {
            id: "rule-1",
            location_area_id: areaId,
            service_hour_id: serviceHourId,
            qualification_id: qualId,
            required_count: 1,
          } satisfies LocationAreaStaffing,
        ],
        serviceHours: [
          {
            id: serviceHourId,
            location_area_id: areaId,
            weekday: 1,
            start_time: "08:00",
            end_time: "18:00",
          },
        ],
        profileQualificationIds: new Map([[employeeId, new Set([qualId])]]),
        qualificationNameById: new Map([[qualId, "Koch"]]),
      },
      { ...baseInput, locationAreaId: areaId }
    );
    expect(result.ok).toBe(true);
  });
});
