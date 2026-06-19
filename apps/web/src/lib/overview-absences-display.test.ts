import { describe, expect, it } from "vitest";
import type { AbsenceRequest, Profile } from "@schichtwerk/types";
import {
  absenceExtendsOnOrAfterDate,
  buildOverviewAbsenceDisplayRows,
  buildOverviewAbsenceEmployeeJumpOptions,
  countOverviewAbsenceEmployees,
  filterOverviewAbsences,
  firstOverviewAbsenceRowIdForEmployee,
} from "./overview-absences-display";

function absence(
  overrides: Partial<AbsenceRequest> & Pick<AbsenceRequest, "id" | "employee_id" | "start_date">
): AbsenceRequest {
  return {
    organization_id: "org-1",
    type: "vacation",
    end_date: overrides.start_date,
    is_open_ended: false,
    expected_end_date: null,
    status: "approved",
    reviewed_by: null,
    reported_by: null,
    notes: null,
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

const profiles: Profile[] = [
  {
    id: "emp-b",
    organization_id: "org-1",
    full_name: "Bea Braun",
    email: "bea@example.com",
    role: "manager",
    color: "#ff0000",
    active: true,
    schedulable: true,
    app_registered: false,
    email_fallback: false,
    created_at: "",
    updated_at: "",
  },
  {
    id: "emp-a",
    organization_id: "org-1",
    full_name: "Anna Albers",
    email: "anna@example.com",
    role: "basic",
    color: "#00ff00",
    active: true,
    schedulable: true,
    app_registered: false,
    email_fallback: false,
    created_at: "",
    updated_at: "",
  },
  {
    id: "emp-c",
    organization_id: "org-1",
    full_name: "Carl Cramer",
    email: "carl@example.com",
    role: "basic",
    color: "#0000ff",
    active: true,
    schedulable: true,
    app_registered: false,
    email_fallback: false,
    created_at: "",
    updated_at: "",
  },
];

describe("overview absences display", () => {
  it("keeps absences that end today or later", () => {
    expect(
      filterOverviewAbsences(
        [
          absence({ id: "past", employee_id: "emp-a", start_date: "2026-06-01", end_date: "2026-06-09" }),
          absence({ id: "current", employee_id: "emp-a", start_date: "2026-06-10", end_date: "2026-06-12" }),
          absence({ id: "open", employee_id: "emp-a", start_date: "2026-06-08", end_date: null, is_open_ended: true }),
        ],
        "2026-06-10"
      ).map((entry) => entry.id)
    ).toEqual(["current", "open"]);
  });

  it("groups rows by employee with blank continuation cells", () => {
    const rows = buildOverviewAbsenceDisplayRows({
      absences: [
        absence({ id: "b-2", employee_id: "emp-b", start_date: "2026-06-15", end_date: "2026-06-16" }),
        absence({ id: "a-1", employee_id: "emp-a", start_date: "2026-06-11", end_date: "2026-06-11" }),
        absence({ id: "a-2", employee_id: "emp-a", start_date: "2026-06-20", end_date: "2026-06-22" }),
        absence({ id: "b-1", employee_id: "emp-b", start_date: "2026-06-10", end_date: "2026-06-10" }),
      ],
      profiles,
      todayISO: "2026-06-10",
    });

    expect(rows.map((row) => [row.employeeName, row.showEmployeeName, row.id])).toEqual([
      ["Anna Albers", true, "a-1"],
      ["Anna Albers", false, "a-2"],
      ["Bea Braun", true, "b-1"],
      ["Bea Braun", false, "b-2"],
    ]);
    expect(countOverviewAbsenceEmployees(rows)).toBe(2);
  });

  it("builds one jump option per profile including employees without absences", () => {
    const rows = buildOverviewAbsenceDisplayRows({
      absences: [
        absence({ id: "b-2", employee_id: "emp-b", start_date: "2026-06-15", end_date: "2026-06-16" }),
        absence({ id: "a-1", employee_id: "emp-a", start_date: "2026-06-11", end_date: "2026-06-11" }),
        absence({ id: "a-2", employee_id: "emp-a", start_date: "2026-06-20", end_date: "2026-06-22" }),
        absence({ id: "b-1", employee_id: "emp-b", start_date: "2026-06-10", end_date: "2026-06-10" }),
      ],
      profiles,
      todayISO: "2026-06-10",
    });

    expect(
      buildOverviewAbsenceEmployeeJumpOptions(profiles, rows).map((option) => [
        option.employeeName,
        option.firstRowId,
      ])
    ).toEqual([
      ["Bea Braun", "b-1"],
      ["Anna Albers", "a-1"],
      ["Carl Cramer", null],
    ]);
  });

  it("finds first visible row id for an employee", () => {
    const rows = buildOverviewAbsenceDisplayRows({
      absences: [
        absence({ id: "a-1", employee_id: "emp-a", start_date: "2026-06-11", end_date: "2026-06-11" }),
        absence({ id: "a-2", employee_id: "emp-a", start_date: "2026-06-20", end_date: "2026-06-22" }),
      ],
      profiles,
      todayISO: "2026-06-10",
    });

    expect(firstOverviewAbsenceRowIdForEmployee(rows, "emp-a")).toBe("a-1");
    expect(firstOverviewAbsenceRowIdForEmployee(rows, "emp-c")).toBeNull();
  });

  it("detects open-ended absences as current or future", () => {
    expect(
      absenceExtendsOnOrAfterDate(
        {
          start_date: "2026-06-01",
          end_date: null,
          is_open_ended: true,
        },
        "2026-06-10"
      )
    ).toBe(true);
  });
});
