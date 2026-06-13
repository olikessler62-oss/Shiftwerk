import { describe, expect, it } from "vitest";
import { buildPrefilledBulkRow } from "./bulk-shift-row-prefill";
import type { BuildPrefilledBulkRowInput } from "./bulk-shift-row-prefill";

const EMPTY_EMPLOYEE_ID = "__empty__";

function createBaseInput(
  prefill: BuildPrefilledBulkRowInput["prefill"]
): BuildPrefilledBulkRowInput {
  return {
    existingRows: [],
    prefill,
    staffingEntries: [
      {
        serviceHourId: "hour-1",
        label: "08–12",
        required: 2,
        assigned: 0,
        timeLabel: "08:00–12:00",
        qualifications: [
          {
            qualificationId: "qual-1",
            name: "Kellner",
            required: 2,
            assigned: 0,
          },
        ],
      },
    ],
    serviceHours: [
      {
        id: "hour-1",
        location_area_id: "area-1",
        weekday: 1,
        start_time: "08:00:00",
        end_time: "12:00:00",
      },
    ],
    assignmentPresets: [
      {
        id: "preset-1",
        name: "Früh",
        start_time: "08:00:00",
        end_time: "12:00:00",
        area_shift_template_id: "template-1",
      },
    ],
    staffingRules: [
      {
        id: "rule-1",
        location_area_id: "area-1",
        service_hour_id: "hour-1",
        qualification_id: "qual-1",
        required_count: 2,
      },
    ],
    areaId: "area-1",
    weekday: 1,
    dateISO: "2026-06-08",
    countryCode: "DE",
    timeZone: "Europe/Berlin",
    employees: [
      {
        id: "emp-1",
        full_name: "Anna",
        last_shift_date: null,
        availabilities: [],
      },
    ],
    profileQualificationIds: new Map([["emp-1", new Set(["qual-1"])]]),
    profileShiftPreferences: {},
    areaQualifications: [{ id: "qual-1", name: "Kellner" }],
    areaExistingAssignments: [],
    locationDayAssignments: [],
    emptyEmployeeId: EMPTY_EMPLOYEE_ID,
    createEmptyRow: () => ({
      id: "row-1",
      employeeId: EMPTY_EMPLOYEE_ID,
      qualificationId: "",
      shiftTypeId: "",
      startTime: "00:00",
      endTime: "00:00",
      employeeManuallySelected: false,
      shiftTypeManuallySelected: false,
      qualificationManuallySelected: false,
    }),
  };
}

describe("buildPrefilledBulkRow", () => {
  it("leaves all fields empty when every prefill toggle is off", () => {
    const row = buildPrefilledBulkRow(
      createBaseInput({
        template: false,
        qualification: false,
        employee: false,
      })
    );

    expect(row.startTime).toBe("00:00");
    expect(row.endTime).toBe("00:00");
    expect(row.shiftTypeId).toBe("");
    expect(row.qualificationId).toBe("");
    expect(row.employeeId).toBe(EMPTY_EMPLOYEE_ID);
    expect(row.employeeManuallySelected).toBe(true);
    expect(row.shiftTypeManuallySelected).toBe(true);
    expect(row.qualificationManuallySelected).toBe(true);
  });

  it("sets demand times and allows employee prefill only when the employee toggle is on", () => {
    const row = buildPrefilledBulkRow(
      createBaseInput({
        template: false,
        qualification: false,
        employee: true,
      })
    );

    expect(row.startTime).toBe("08:00");
    expect(row.endTime).toBe("12:00");
    expect(row.shiftTypeId).toBe("");
    expect(row.qualificationId).toBe("");
    expect(row.employeeManuallySelected).toBe(false);
    expect(row.shiftTypeManuallySelected).toBe(true);
    expect(row.qualificationManuallySelected).toBe(true);
  });

  it("does not prefill employee when only template prefill is on", () => {
    const row = buildPrefilledBulkRow(
      createBaseInput({
        template: true,
        qualification: false,
        employee: false,
      })
    );

    expect(row.shiftTypeId).toBe("preset-1");
    expect(row.employeeId).toBe(EMPTY_EMPLOYEE_ID);
    expect(row.employeeManuallySelected).toBe(true);
  });
});
