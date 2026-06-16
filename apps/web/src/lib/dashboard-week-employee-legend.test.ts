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
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId: "a",
          employeeName: "Anna",
          employeeColor: null,
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId: "b",
          employeeName: "Zoe",
          employeeColor: "#111111",
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
});

describe("dashboardEmployeeWeekHours", () => {
  it("sums shift durations for one employee", () => {
    expect(
      dashboardEmployeeWeekHours("a", [
        {
          employeeId: "a",
          employeeName: "Anna",
          employeeColor: null,
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId: "b",
          employeeName: "Bob",
          employeeColor: null,
          startTime: "08:00",
          endTime: "16:00",
        },
        {
          employeeId: "a",
          employeeName: "Anna",
          employeeColor: null,
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
