import { describe, expect, it } from "vitest";
import {
  pickFirstDashboardShiftPerEmployeeDay,
  pickFirstPlanningShiftPerEmployeeDay,
} from "./simple-calendar-display-toggle";

describe("pickFirstPlanningShiftPerEmployeeDay", () => {
  it("keeps earliest shift per employee and day", () => {
    const shifts = [
      {
        id: "s2",
        employee_id: "e1",
        shift_date: "2026-06-02",
        shiftName: "Spät",
        color: "#000",
        startTime: "14:00",
        endTime: "22:00",
        location_area_id: null,
        area_shift_template_id: null,
      },
      {
        id: "s1",
        employee_id: "e1",
        shift_date: "2026-06-02",
        shiftName: "Früh",
        color: "#000",
        startTime: "06:00",
        endTime: "14:00",
        location_area_id: null,
        area_shift_template_id: null,
      },
      {
        id: "s3",
        employee_id: "e2",
        shift_date: "2026-06-02",
        shiftName: "Tag",
        color: "#000",
        startTime: "08:00",
        endTime: "16:00",
        location_area_id: null,
        area_shift_template_id: null,
      },
    ];

    expect(
      pickFirstPlanningShiftPerEmployeeDay(shifts).map((shift) => shift.id)
    ).toEqual(["s1", "s3"]);
  });
});

describe("pickFirstDashboardShiftPerEmployeeDay", () => {
  it("keeps earliest shift per employee and day", () => {
    const shifts = [
      {
        id: "s2",
        shift_date: "2026-06-02",
        locationAreaId: "a1",
        areaShiftTemplateId: null,
        employeeId: "e1",
        shiftName: "Spät",
        color: "#000",
        startTime: "14:00",
        endTime: "22:00",
        employeeName: "Anna",
        employeeColor: "#f00",
      },
      {
        id: "s1",
        shift_date: "2026-06-02",
        locationAreaId: "a1",
        areaShiftTemplateId: null,
        employeeId: "e1",
        shiftName: "Früh",
        color: "#000",
        startTime: "06:00",
        endTime: "14:00",
        employeeName: "Anna",
        employeeColor: "#f00",
      },
    ];

    expect(
      pickFirstDashboardShiftPerEmployeeDay(shifts).map((shift) => shift.id)
    ).toEqual(["s1"]);
  });
});
