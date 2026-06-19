import { describe, expect, it } from "vitest";
import type { Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  buildOverviewAvailabilityDisplayRows,
  buildOverviewAvailabilityEmployeeJumpOptions,
  countOverviewAvailabilityEmployees,
  firstOverviewAvailabilityRowIdForEmployee,
  weekdayFromDateISO,
} from "./overview-availabilities-display";

function slot(
  overrides: Partial<ProfileRecurringAvailability> &
    Pick<ProfileRecurringAvailability, "id" | "profile_id" | "weekday">
): ProfileRecurringAvailability {
  return {
    organization_id: "org-1",
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    created_at: "",
    ...overrides,
  };
}

const profiles: Profile[] = [
  {
    id: "emp-b",
    organization_id: "org-1",
    full_name: "Bea Braun",
    email: "bea@example.com",
    role: "basic",
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
];

describe("overview availabilities display", () => {
  it("maps ISO date to Monday-based weekday", () => {
    expect(weekdayFromDateISO("2026-06-10")).toBe(2);
  });

  it("groups rows by employee with blank continuation cells", () => {
    const rows = buildOverviewAvailabilityDisplayRows({
      availability: [
        slot({ id: "b-2", profile_id: "emp-b", weekday: 4, start_time: "14:00", end_time: "18:00" }),
        slot({ id: "a-1", profile_id: "emp-a", weekday: 1, start_time: "08:00", end_time: "12:00" }),
        slot({ id: "a-2", profile_id: "emp-a", weekday: 3, start_time: "09:00", end_time: "17:00" }),
        slot({ id: "b-1", profile_id: "emp-b", weekday: 2, start_time: "10:00", end_time: "14:00" }),
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
    expect(countOverviewAvailabilityEmployees(rows)).toBe(2);
  });

  it("builds employee jump options from all profiles with row links", () => {
    const rows = buildOverviewAvailabilityDisplayRows({
      availability: [
        slot({ id: "a-1", profile_id: "emp-a", weekday: 1 }),
        slot({ id: "b-1", profile_id: "emp-b", weekday: 2 }),
      ],
      profiles,
      todayISO: "2026-06-10",
    });

    expect(
      buildOverviewAvailabilityEmployeeJumpOptions(profiles, rows).map((option) => [
        option.employeeName,
        option.firstRowId,
      ])
    ).toEqual([
      ["Bea Braun", "b-1"],
      ["Anna Albers", "a-1"],
    ]);
    expect(firstOverviewAvailabilityRowIdForEmployee(rows, "emp-b")).toBe("b-1");
  });

  it("includes every grouped employee once even with many weekday rows", () => {
    const theresa: Profile = {
      id: "emp-t",
      organization_id: "org-1",
      full_name: "Theresa Fabian",
      email: "theresa@example.com",
      role: "basic",
      color: "#0000ff",
      active: true,
      schedulable: true,
      app_registered: false,
      email_fallback: false,
      created_at: "",
      updated_at: "",
    };
    const availability = [
      ...profiles.flatMap((profile, index) => [
        slot({
          id: `${profile.id}-1`,
          profile_id: profile.id,
          weekday: index,
        }),
      ]),
      ...Array.from({ length: 7 }, (_, weekday) =>
        slot({
          id: `t-${weekday}`,
          profile_id: theresa.id,
          weekday,
          start_time: "08:00:00",
          end_time: "22:00:00",
        })
      ),
    ];

    const rows = buildOverviewAvailabilityDisplayRows({
      availability,
      profiles: [...profiles, theresa],
      todayISO: "2026-06-10",
    });

    const options = buildOverviewAvailabilityEmployeeJumpOptions(
      [...profiles, theresa],
      rows
    );
    expect(options.map((option) => option.employeeName)).toEqual([
      "Bea Braun",
      "Anna Albers",
      "Theresa Fabian",
    ]);
  });

  it("includes employees without availability rows", () => {
    const rows = buildOverviewAvailabilityDisplayRows({
      availability: [slot({ id: "a-1", profile_id: "emp-a", weekday: 1 })],
      profiles,
      todayISO: "2026-06-10",
    });

    expect(
      buildOverviewAvailabilityEmployeeJumpOptions(profiles, rows).map((option) => [
        option.employeeName,
        option.firstRowId,
      ])
    ).toEqual([
      ["Bea Braun", null],
      ["Anna Albers", "a-1"],
    ]);
  });

  it("returns null when employee has no visible overview rows", () => {
    expect(
      firstOverviewAvailabilityRowIdForEmployee(
        buildOverviewAvailabilityDisplayRows({
          availability: [],
          profiles,
          todayISO: "2026-06-10",
        }),
        "emp-a"
      )
    ).toBeNull();
  });
});
