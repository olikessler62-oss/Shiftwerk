import { describe, expect, it } from "vitest";
import {
  computeDashboardStaffingCandidateSlots,
  filterEmployeesWithinWeeklyMinutesForShift,
  sortDashboardStaffingCandidates,
  weeklyAssignedMinutesByEmployeeId,
} from "./dashboard-staffing-candidates";

describe("computeDashboardStaffingCandidateSlots", () => {
  const tourDate = "2026-07-07";
  const areaId = "area-tour-1";
  const hourFrueh = "hour-frueh";
  const qualPflege = "qual-pflege";

  it("returns no open slots when projected coverage already meets or exceeds demand", () => {
    const slots = computeDashboardStaffingCandidateSlots({
      areaId,
      dateISO: tourDate,
      serviceHourId: hourFrueh,
      simplePlanning: false,
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: tourDate,
          startTime: "08:00",
          endTime: "17:00",
          shiftName: "Früh",
          color: "#000",
          location_area_id: areaId,
          area_shift_template_id: null,
          confirmationStatus: "proposed",
        },
        {
          id: "s2",
          employee_id: "e2",
          shift_date: tourDate,
          startTime: "08:00",
          endTime: "17:00",
          shiftName: "Früh",
          color: "#000",
          location_area_id: areaId,
          area_shift_template_id: null,
          confirmationStatus: "proposed",
        },
      ],
      staffingRules: [
        {
          id: "rule-frueh",
          location_area_id: areaId,
          service_hour_id: hourFrueh,
          qualification_id: qualPflege,
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: hourFrueh,
          location_area_id: areaId,
          weekday: 1,
          start_time: "08:00",
          end_time: "17:00",
        },
      ],
      assignmentPresets: [],
      qualifications: [{ id: qualPflege, name: "Pfleger/in", sort_order: 0 }],
      profileQualificationIds: new Map([
        ["e1", new Set([qualPflege])],
        ["e2", new Set([qualPflege])],
      ]),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      headcountSectionLabel: "Personal",
    });

    expect(slots).toEqual([]);
  });
});

describe("weeklyAssignedMinutesByEmployeeId", () => {
  it("sums shift durations per employee within week dates", () => {
    const totals = weeklyAssignedMinutesByEmployeeId(
      [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: "2026-06-23",
          startTime: "08:00",
          endTime: "16:00",
          shiftName: "Früh",
          color: "#000",
          location_area_id: "a1",
          area_shift_template_id: null,
        },
        {
          id: "s2",
          employee_id: "e1",
          shift_date: "2026-06-24",
          startTime: "09:00",
          endTime: "13:00",
          shiftName: "Früh",
          color: "#000",
          location_area_id: "a1",
          area_shift_template_id: null,
        },
        {
          id: "s3",
          employee_id: "e2",
          shift_date: "2026-06-23",
          startTime: "10:00",
          endTime: "14:00",
          shiftName: "Früh",
          color: "#000",
          location_area_id: "a1",
          area_shift_template_id: null,
        },
      ],
      ["2026-06-23", "2026-06-24"]
    );

    expect(totals.get("e1")).toBe(8 * 60 + 4 * 60);
    expect(totals.get("e2")).toBe(4 * 60);
  });
});

describe("filterEmployeesWithinWeeklyMinutesForShift", () => {
  const weekDates = [
    "2026-06-23",
    "2026-06-24",
    "2026-06-25",
    "2026-06-26",
    "2026-06-27",
    "2026-06-28",
    "2026-06-29",
  ];

  const manfredShifts = [
  ...["2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26"].map((shiftDate, index) => ({
      id: `s-${index}`,
      employee_id: "manfred",
      shift_date: shiftDate,
      startTime: "08:00",
      endTime: "16:00",
      shiftName: "Früh",
      color: "#000",
      location_area_id: "a1",
      area_shift_template_id: null,
    })),
    {
      id: "s-fri",
      employee_id: "manfred",
      shift_date: "2026-06-27",
      startTime: "08:00",
      endTime: "15:00",
      shiftName: "Früh",
      color: "#000",
      location_area_id: "a1",
      area_shift_template_id: null,
    },
  ];

  it("removes employees who would exceed weekly target with the proposed shift", () => {
    const employees = [
      { id: "manfred", full_name: "Manfred Testmann", weekly_hours: 40 },
      { id: "other", full_name: "Other", weekly_hours: 40 },
    ];

    const filtered = filterEmployeesWithinWeeklyMinutesForShift(
      employees,
      manfredShifts,
      weekDates,
      "18:00",
      "23:00"
    );

    expect(filtered.map((employee) => employee.id)).toEqual(["other"]);
  });

  it("keeps employees who would stay within weekly target", () => {
    const employees = [
      { id: "manfred", full_name: "Manfred Testmann", weekly_hours: 40 },
    ];

    const filtered = filterEmployeesWithinWeeklyMinutesForShift(
      employees,
      manfredShifts.slice(0, 4),
      weekDates,
      "18:00",
      "19:00"
    );

    expect(filtered.map((employee) => employee.id)).toEqual(["manfred"]);
  });
});

describe("sortDashboardStaffingCandidates", () => {
  const context = {
    weekday: 0,
    demandStart: "08:00",
    demandEnd: "16:00",
    areaId: "area-1",
    locationId: "loc-1",
    qualificationId: "qual-1",
  };

  it("sorts by wish score, then weekly minutes, then name", () => {
    const sorted = sortDashboardStaffingCandidates(
      [
        { id: "c", full_name: "Charlie" },
        { id: "a", full_name: "Anna" },
        { id: "b", full_name: "Ben" },
      ],
      context,
      {
        a: [
          {
            weekday: 0,
            start_time: "08:00",
            end_time: "16:00",
            location_id: null,
            location_area_id: "area-1",
            qualification_id: "qual-1",
            priority: 1,
          },
        ],
      },
      new Map([
        ["a", 120],
        ["b", 60],
        ["c", 60],
      ])
    );

    expect(sorted.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});
