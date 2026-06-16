import { describe, expect, it } from "vitest";
import { resolvePlanningAssignPrefillFromOpenDemand } from "./planning-assign-prefill";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import type {
  AbsenceRequest,
  LocationAreaStaffing,
  ProfileRecurringAvailability,
} from "@schichtwerk/types";

const areaId = "area-1";
const employeeId = "emp-1";
const dateISO = "2026-06-19";
const serviceHourFrueh = "sh-frueh";
const serviceHourSpat = "sh-spat";
const qualKellner = "qual-kellner";

const presets: DashboardAssignmentPreset[] = [
  {
    id: "preset-frueh",
    name: "Früh",
    start_time: "08:00",
    end_time: "10:00",
    color: "#0f0",
  },
  {
    id: "preset-spat",
    name: "Spät",
    start_time: "16:00",
    end_time: "20:00",
    color: "#00f",
  },
];

const serviceHours: AreaServiceHourRef[] = [
  {
    id: serviceHourFrueh,
    location_area_id: areaId,
    weekday: 4,
    start_time: "08:00",
    end_time: "12:00",
  },
  {
    id: serviceHourSpat,
    location_area_id: areaId,
    weekday: 4,
    start_time: "16:00",
    end_time: "22:00",
  },
];

const staffingRules: LocationAreaStaffing[] = [
  {
    id: "rule-frueh",
    location_area_id: areaId,
    service_hour_id: serviceHourFrueh,
    qualification_id: qualKellner,
    required_count: 1,
  },
  {
    id: "rule-spat",
    location_area_id: areaId,
    service_hour_id: serviceHourSpat,
    qualification_id: qualKellner,
    required_count: 1,
  },
];

const profileQualificationIds = new Map<string, ReadonlySet<string>>([
  [employeeId, new Set([qualKellner])],
]);

const recurringAvailability: ProfileRecurringAvailability[] = [
  {
    id: "av-1",
    profile_id: employeeId,
    weekday: 4,
    start_time: "08:00",
    end_time: "22:00",
  },
];

function staffingEntry(
  serviceHourId: string,
  assigned: number,
  required: number
): TagAreaHeaderStaffingEntry {
  return {
    serviceHourId,
    label: serviceHourId,
    assigned,
    required,
    qualifications: [],
  };
}

describe("resolvePlanningAssignPrefillFromOpenDemand", () => {
  it("prefills earliest open demand that fits the employee", () => {
    const result = resolvePlanningAssignPrefillFromOpenDemand({
      employeeId,
      dateISO,
      areaId,
      staffingEntries: [
        staffingEntry(serviceHourFrueh, 1, 1),
        staffingEntry(serviceHourSpat, 0, 1),
      ],
      serviceHours,
      assignmentPresets: presets,
      staffingRules,
      profileQualificationIds,
      recurringAvailability,
      absences: [],
      employees: [{ id: employeeId }],
    });

    expect(result).toEqual({
      presetId: "preset-spat",
      startTime: "16:00",
      endTime: "20:00",
      qualificationId: qualKellner,
    });
  });

  it("returns null when no open demand exists", () => {
    const result = resolvePlanningAssignPrefillFromOpenDemand({
      employeeId,
      dateISO,
      areaId,
      staffingEntries: [staffingEntry(serviceHourFrueh, 1, 1)],
      serviceHours,
      assignmentPresets: presets,
      staffingRules,
      profileQualificationIds,
      recurringAvailability,
      absences: [],
      employees: [{ id: employeeId }],
    });

    expect(result).toBeNull();
  });

  it("skips open demand when employee is absent", () => {
    const absences: AbsenceRequest[] = [
      {
        id: "abs-1",
        employee_id: employeeId,
        start_date: dateISO,
        end_date: dateISO,
        status: "approved",
        type: "vacation",
        organization_id: "org-1",
        created_at: "",
        updated_at: "",
      },
    ];

    const result = resolvePlanningAssignPrefillFromOpenDemand({
      employeeId,
      dateISO,
      areaId,
      staffingEntries: [staffingEntry(serviceHourSpat, 0, 1)],
      serviceHours,
      assignmentPresets: presets,
      staffingRules,
      profileQualificationIds,
      recurringAvailability,
      absences,
      employees: [{ id: employeeId }],
    });

    expect(result).toBeNull();
  });
});
