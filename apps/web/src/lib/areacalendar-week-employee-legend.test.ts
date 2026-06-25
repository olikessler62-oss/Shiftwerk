import { describe, expect, it } from "vitest";
import {
  collectWeekLegendEmployeesFromAreaCalendarShifts,
  areaCalendarEmployeeWeekHours,
  filterAreaCalendarShiftsByActiveAreas,
  DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX,
  DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE,
  DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX,
} from "./areacalendar-week-employee-legend";

describe("filterAreaCalendarShiftsByActiveAreas", () => {
  it("returns only shifts in active areas", () => {
    const shifts = [
      { id: "1", locationAreaId: "kitchen" },
      { id: "2", locationAreaId: "bar" },
      { id: "3", locationAreaId: null },
    ];

    expect(
      filterAreaCalendarShiftsByActiveAreas(shifts, new Set(["bar"])).map(
        (shift) => shift.id
      )
    ).toEqual(["2"]);
  });

  it("returns empty list when no area is active", () => {
    const shifts = [{ id: "1", locationAreaId: "kitchen" }];
    expect(
      filterAreaCalendarShiftsByActiveAreas(shifts, new Set()).length
    ).toBe(0);
  });
});

describe("collectWeekLegendEmployeesFromAreaCalendarShifts", () => {
  it("returns unique employees sorted by name", () => {
    const employees = collectWeekLegendEmployeesFromAreaCalendarShifts(
      [
        {
          employeeId: "b",
          employeeName: "Zoe",
          employeeColor: "#111111",
          shift_date: "2026-06-02",
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId: "a",
          employeeName: "Anna",
          employeeColor: null,
          shift_date: "2026-06-02",
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId: "b",
          employeeName: "Zoe",
          employeeColor: "#111111",
          shift_date: "2026-06-03",
          startTime: "13:00",
          endTime: "17:00",
        },
      ],
      [
        {
          id: "a",
          full_name: "Anna Bello",
          color: "#ff0000",
          weekly_hours: 40,
        },
      ]
    );

    expect(employees.map((employee) => employee.id)).toEqual(["a", "b"]);
    expect(employees[0]?.full_name).toBe("Anna Bello");
    expect(employees[0]?.color).toBe("#ff0000");
    expect(employees[0]?.weekly_hours).toBe(40);
  });

  it("includes employees with shifts on approved absence days", () => {
    const employees = collectWeekLegendEmployeesFromAreaCalendarShifts(
      [
        {
          employeeId: "sick",
          employeeName: "Alexa Bello",
          employeeColor: "#336699",
          shift_date: "2026-06-17",
          startTime: "08:00",
          endTime: "16:00",
        },
        {
          employeeId: "well",
          employeeName: "Bob",
          employeeColor: null,
          shift_date: "2026-06-17",
          startTime: "08:00",
          endTime: "12:00",
        },
      ],
      [
        {
          id: "sick",
          full_name: "Alexa Bello",
          color: "#336699",
          weekly_hours: 40,
        },
        {
          id: "well",
          full_name: "Bob",
          color: null,
          weekly_hours: 40,
        },
      ],
      [
        {
          id: "abs-1",
          employee_id: "sick",
          organization_id: "org",
          type: "sick",
          start_date: "2026-06-16",
          end_date: null,
          is_open_ended: true,
          expected_end_date: null,
          status: "approved",
          notes: null,
          reviewed_by: null,
          reported_by: null,
          updated_at: "",
        },
      ]
    );

    expect(employees.map((employee) => employee.id)).toEqual(["sick", "well"]);
  });
});

describe("areaCalendarEmployeeWeekHours", () => {
  it("sums shift durations for one employee", () => {
    expect(
      areaCalendarEmployeeWeekHours("a", [
        {
          employeeId: "a",
          employeeName: "Anna",
          employeeColor: null,
          shift_date: "2026-06-02",
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId: "b",
          employeeName: "Bob",
          employeeColor: null,
          shift_date: "2026-06-02",
          startTime: "08:00",
          endTime: "16:00",
        },
        {
          employeeId: "a",
          employeeName: "Anna",
          employeeColor: null,
          shift_date: "2026-06-03",
          startTime: "13:00",
          endTime: "17:00",
        },
      ])
    ).toBe(8);
  });
});

describe("area calendar sidebar employee legend layout", () => {
  it("caps visible rows at ten before scrolling", () => {
    expect(DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE).toBe(10);
    expect(DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX).toBe(
      DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX * 10
    );
  });
});
