import { describe, expect, it } from "vitest";
import { resolvePlanningShiftJobLabels } from "./planning-shift-job-label";
import type { PlanningShift } from "./planning-shift-card";

const areaId = "area-a";
const qualKellner = "qual-kellner";
const qualKoch = "qual-koch";

describe("resolvePlanningShiftJobLabels", () => {
  it("returns only the staffing qualification for each shift", () => {
    const shifts: PlanningShift[] = [
      {
        id: "shift-kellner",
        employee_id: "emp-1",
        shift_date: "2026-06-23",
        shiftName: "Mittag",
        color: "#000",
        startTime: "12:00",
        endTime: "15:00",
        location_area_id: areaId,
        area_shift_template_id: null,
      },
      {
        id: "shift-koch",
        employee_id: "emp-2",
        shift_date: "2026-06-23",
        shiftName: "Mittag",
        color: "#000",
        startTime: "12:00",
        endTime: "15:00",
        location_area_id: areaId,
        area_shift_template_id: null,
      },
    ];

    const labels = resolvePlanningShiftJobLabels({
      shifts,
      serviceHours: [
        {
          id: "hour-lunch",
          location_area_id: areaId,
          weekday: 1,
          start_time: "12:00",
          end_time: "15:00",
        },
      ],
      staffingRules: [
        {
          id: "rule-kellner",
          location_area_id: areaId,
          service_hour_id: "hour-lunch",
          qualification_id: qualKellner,
          required_count: 1,
        },
        {
          id: "rule-koch",
          location_area_id: areaId,
          service_hour_id: "hour-lunch",
          qualification_id: qualKoch,
          required_count: 1,
        },
      ],
      profileQualificationIds: {
        "emp-1": [qualKellner, qualKoch],
        "emp-2": [qualKoch],
      },
      qualificationNameById: new Map([
        [qualKellner, "Kellner/in"],
        [qualKoch, "Koch/Köchin"],
      ]),
      countryCode: "DE",
    });

    expect(labels.get("shift-kellner")).toBe("Kellner/in");
    expect(labels.get("shift-koch")).toBe("Koch/Köchin");
  });
});
