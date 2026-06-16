import { describe, expect, it } from "vitest";
import {
  filterEmployeesAvailableOnWeekday,
  filterPlanningAssignShiftEmployees,
  filterProfilesForShiftAssignment,
} from "./available-employees-for-shift";
import type { Profile } from "@schichtwerk/types";

const weekday = 0;

const employees = [
  {
    id: "a",
    availabilities: [
      { weekday: 0, start_time: "08:00", end_time: "16:00" },
    ],
  },
  {
    id: "b",
    availabilities: [
      { weekday: 0, start_time: "08:00", end_time: "16:00" },
    ],
  },
  {
    id: "c",
    availabilities: [
      { weekday: 0, start_time: "14:00", end_time: "22:00" },
    ],
  },
] as const;

const profileQualificationIds = new Map<string, ReadonlySet<string>>([
  ["a", new Set(["q1"])],
  ["b", new Set(["q2"])],
  ["c", new Set(["q1"])],
]);

describe("filterProfilesForShiftAssignment", () => {
  it("excludes inactive and non-schedulable profiles", () => {
    const profiles = [
      {
        id: "a",
        organization_id: "org-1",
        is_active: true,
        schedulable: true,
      },
      {
        id: "admin",
        organization_id: "org-1",
        is_active: true,
        schedulable: false,
      },
    ] as Profile[];

    expect(
      filterProfilesForShiftAssignment(profiles, "org-1").map(
        (profile) => profile.id
      )
    ).toEqual(["a"]);
  });
});

describe("filterEmployeesAvailableOnWeekday", () => {
  it("excludes non-schedulable admins even with availability", () => {
    const profiles = [
      {
        id: "admin",
        organization_id: "org-1",
        is_active: true,
        schedulable: false,
      },
    ] as Profile[];
    const availability = [
      {
        profile_id: "admin",
        weekday: 0,
        start_time: "08:00",
        end_time: "16:00",
        sort_order: 0,
      },
    ];

    expect(
      filterEmployeesAvailableOnWeekday(
        profiles,
        availability,
        0,
        "org-1"
      )
    ).toEqual([]);
  });
});

describe("filterPlanningAssignShiftEmployees", () => {
  it("returns empty list when times are incomplete", () => {
    expect(
      filterPlanningAssignShiftEmployees(employees, weekday, "08:00", "", {
        simplePlanning: false,
        qualificationId: "q1",
        profileQualificationIds,
      })
    ).toEqual([]);
  });

  it("filters by availability window", () => {
    expect(
      filterPlanningAssignShiftEmployees(employees, weekday, "09:00", "15:00", {
        simplePlanning: true,
        qualificationId: "",
        profileQualificationIds,
      }).map((employee) => employee.id)
    ).toEqual(["a", "b"]);
  });

  it("requires selected job qualification when areas are enabled", () => {
    expect(
      filterPlanningAssignShiftEmployees(employees, weekday, "09:00", "15:00", {
        simplePlanning: false,
        qualificationId: "",
        profileQualificationIds,
      })
    ).toEqual([]);

    expect(
      filterPlanningAssignShiftEmployees(employees, weekday, "09:00", "15:00", {
        simplePlanning: false,
        qualificationId: "q1",
        profileQualificationIds,
      }).map((employee) => employee.id)
    ).toEqual(["a"]);
  });

  it("excludes employees outside availability even with matching qualification", () => {
    expect(
      filterPlanningAssignShiftEmployees(employees, weekday, "09:00", "15:00", {
        simplePlanning: false,
        qualificationId: "q1",
        profileQualificationIds,
      }).map((employee) => employee.id)
    ).not.toContain("c");
  });
});
