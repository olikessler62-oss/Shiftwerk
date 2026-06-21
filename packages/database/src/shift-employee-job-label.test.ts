import { describe, expect, it } from "vitest";
import { resolveEmployeeShiftJobLabel } from "./shift-employee-job-label";

const qualificationMetaById = new Map([
  ["q-kellner", { name: "Kellner/in", sortOrder: 1 }],
  ["q-kueche", { name: "Küche", sortOrder: 2 }],
  ["q-bar", { name: "Bar", sortOrder: 3 }],
]);

describe("resolveEmployeeShiftJobLabel", () => {
  it("returns only demand qualifications matching the employee", () => {
    const label = resolveEmployeeShiftJobLabel({
      areaId: "area-1",
      countryCode: "DE",
      shiftDate: "2026-06-23",
      startTime: "08:00",
      endTime: "16:00",
      employeeQualificationIds: new Set(["q-kellner", "q-kueche", "q-bar"]),
      serviceHours: [
        {
          id: "sh-morning",
          location_area_id: "area-1",
          weekday: 1,
          start_time: "08:00",
          end_time: "16:00",
        },
      ],
      staffingRules: [
        {
          id: "rule-1",
          location_area_id: "area-1",
          service_hour_id: "sh-morning",
          qualification_id: "q-kellner",
          required_count: 1,
        },
      ],
      qualificationMetaById,
    });

    expect(label).toBe("Kellner/in");
  });

  it("falls back to employee profile qualifications when no service hour matches", () => {
    const label = resolveEmployeeShiftJobLabel({
      areaId: "area-1",
      countryCode: "DE",
      shiftDate: "2026-06-23",
      startTime: "08:00",
      endTime: "16:00",
      employeeQualificationIds: new Set(["q-bar", "q-kellner"]),
      serviceHours: [],
      staffingRules: [],
      qualificationMetaById,
    });

    expect(label).toBe("Kellner/in, Bar");
  });
});
