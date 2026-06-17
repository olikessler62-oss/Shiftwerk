import { describe, expect, it } from "vitest";
import {
  collectWeekLegendEmployeesFromDashboardShifts,
  dashboardEmployeeWeekHours,
  DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX,
  DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE,
  DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX,
} from "./dashboard-week-employee-legend";

describe("collectWeekLegendEmployeesFromDashboardShifts", () => {
  it("returns unique employees sorted by name", () => {
    const employees = collectWeekLegendEmployeesFromDashboardShifts(
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

  it("omits employees whose week shifts all fall on approved absence days", () => {
    const employees = collectWeekLegendEmployeesFromDashboardShifts(
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
          absence_type: "sick",
          start_date: "2026-06-16",
          end_date: null,
          is_open_ended: true,
          status: "approved",
          note: null,
          created_at: "",
          updated_at: "",
        },
      ]
    );

    expect(employees.map((employee) => employee.id)).toEqual(["well"]);
  });
});

describe("dashboardEmployeeWeekHours", () => {
  it("sums shift durations for one employee", () => {
    expect(
      dashboardEmployeeWeekHours("a", [
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

describe("dashboard sidebar employee legend layout", () => {
  it("caps visible rows at ten before scrolling", () => {
    expect(DASHBOARD_SIDEBAR_EMPLOYEE_MAX_VISIBLE).toBe(10);
    expect(DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX).toBe(
      DASHBOARD_SIDEBAR_EMPLOYEE_ROW_HEIGHT_PX * 10
    );
  });
});
