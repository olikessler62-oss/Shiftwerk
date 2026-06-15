import { describe, expect, it } from "vitest";
import {
  allocateAssignmentsToDemandWindows,
  buildStaffingQualificationBreakdown,
  countQualificationCoverage,
  computeBulkStaffingHeaderEntries,
  formatStaffingEntryTooltipContent,
  type DemandWindowRef,
  type StaffingAssignmentRef,
} from "./bulk-staffing-header";
import type { AreaServiceHourRef } from "./location-staffing-client";
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";

const areaId = "area-1";
const hourMorning = "hour-morning";
const hourEvening = "hour-evening";
const qualKoch = "qual-koch";
const qualKellner = "qual-kellner";

const serviceHours: AreaServiceHourRef[] = [
  {
    id: hourMorning,
    location_area_id: areaId,
    weekday: 3,
    start_time: "08:00",
    end_time: "10:00",
  },
  {
    id: hourEvening,
    location_area_id: areaId,
    weekday: 3,
    start_time: "18:00",
    end_time: "22:00",
  },
];

const staffingRules: LocationAreaStaffing[] = [
  {
    id: "rule-1",
    location_area_id: areaId,
    service_hour_id: hourMorning,
    qualification_id: qualKoch,
    required_count: 2,
  },
  {
    id: "rule-2",
    location_area_id: areaId,
    service_hour_id: hourEvening,
    qualification_id: qualKoch,
    required_count: 1,
  },
  {
    id: "rule-3",
    location_area_id: areaId,
    service_hour_id: hourEvening,
    qualification_id: qualKellner,
    required_count: 2,
  },
];

const qualifications: Qualification[] = [
  {
    id: qualKoch,
    organization_id: "org-1",
    name: "Koch",
    sort_order: 1,
    archived_at: null,
  },
  {
    id: qualKellner,
    organization_id: "org-1",
    name: "Kellner",
    sort_order: 2,
    archived_at: null,
  },
];

describe("countQualificationCoverage", () => {
  it("counts explicit qualification assignments without double counting", () => {
    const assignments: StaffingAssignmentRef[] = [
      {
        startTime: "18:00",
        endTime: "22:00",
        employeeId: "emp-1",
        qualificationId: qualKoch,
      },
      {
        startTime: "18:00",
        endTime: "22:00",
        employeeId: "emp-2",
        qualificationId: qualKellner,
      },
    ];
    const qualRules = staffingRules.filter(
      (rule) => rule.service_hour_id === hourEvening
    );
    const profileQuals = new Map([
      ["emp-1", new Set([qualKoch, qualKellner])],
      ["emp-2", new Set([qualKellner])],
    ]);

    const counts = countQualificationCoverage(
      assignments,
      qualRules,
      profileQuals
    );

    expect(counts.get(qualKoch)).toBe(1);
    expect(counts.get(qualKellner)).toBe(1);
  });

  it("infers qualification from profile when row has no explicit function", () => {
    const assignments: StaffingAssignmentRef[] = [
      {
        startTime: "08:00",
        endTime: "10:00",
        employeeId: "emp-koch",
      },
      {
        startTime: "08:00",
        endTime: "10:00",
        employeeId: "emp-kellner",
      },
    ];
    const qualRules = staffingRules.filter(
      (rule) => rule.service_hour_id === hourMorning
    );
    const profileQuals = new Map([
      ["emp-koch", new Set([qualKoch])],
      ["emp-kellner", new Set([qualKellner, qualKoch])],
    ]);

    const counts = countQualificationCoverage(
      assignments,
      qualRules,
      profileQuals
    );

    expect(counts.get(qualKoch)).toBe(2);
  });
});

describe("allocateAssignmentsToDemandWindows", () => {
  const hourMorning = "hour-morning";
  const hourLunch = "hour-lunch";
  const demandWindows: DemandWindowRef[] = [
    { serviceHourId: hourMorning, startTime: "08:00", endTime: "10:00" },
    { serviceHourId: hourLunch, startTime: "12:00", endTime: "15:00" },
  ];

  it("assigns each shift to at most one demand window", () => {
    const assignments: StaffingAssignmentRef[] = [
      { startTime: "08:00", endTime: "10:00", employeeId: "emp-a" },
      { startTime: "08:00", endTime: "10:00", employeeId: "emp-b" },
      { startTime: "12:00", endTime: "15:00", employeeId: "emp-c" },
    ];

    const allocation = allocateAssignmentsToDemandWindows(
      assignments,
      demandWindows
    );

    expect(allocation.get(hourMorning)).toEqual([0, 1]);
    expect(allocation.get(hourLunch)).toEqual([2]);
  });

  it("prefers exact demand fit over partial overlap for wide shifts", () => {
    const assignments: StaffingAssignmentRef[] = [
      { startTime: "06:00", endTime: "12:00", employeeId: "emp-wide" },
      { startTime: "12:00", endTime: "15:00", employeeId: "emp-lunch" },
    ];

    const allocation = allocateAssignmentsToDemandWindows(
      assignments,
      demandWindows
    );

    expect(allocation.get(hourMorning)).toEqual([0]);
    expect(allocation.get(hourLunch)).toEqual([1]);
  });
});

describe("computeBulkStaffingHeaderEntries", () => {
  it("returns one entry per demand period with qualification breakdown", () => {
    const dateISO = "2026-06-04"; // Thursday

    const entries = computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId,
      dateISO,
      serviceHours,
      assignments: [
        {
          startTime: "08:00",
          endTime: "10:00",
          employeeId: "emp-koch",
          qualificationId: qualKoch,
        },
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-kellner",
          qualificationId: qualKellner,
        },
      ],
      assignmentPresets: [],
      qualifications,
      profileQualificationIds: new Map([
        ["emp-koch", new Set([qualKoch])],
        ["emp-kellner", new Set([qualKellner])],
      ]),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]!.timeLabel).toBe("Donnerstag 08:00 bis 10:00 Uhr");
    expect(entries[0]!.calendarTimeLabel).toBeUndefined();
    expect(entries[0]!.assigned).toBe(1);
    expect(entries[0]!.required).toBe(2);
    expect(entries[1]!.qualifications).toEqual([
      { qualificationId: qualKoch, name: "Koch", assigned: 0, required: 1 },
      { qualificationId: qualKellner, name: "Kellner", assigned: 1, required: 2 },
    ]);
  });

  it("sets calendarTimeLabel without weekday when formatter is provided", () => {
    const dateISO = "2026-06-04";

    const entries = computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId,
      dateISO,
      serviceHours,
      assignments: [],
      assignmentPresets: [],
      qualifications,
      profileQualificationIds: new Map(),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
      formatCalendarTimeLabel: (start, end) => `${start}-${end} Uhr`,
    });

    expect(entries[0]!.calendarTimeLabel).toBe("08:00-10:00 Uhr");
    expect(entries[0]!.timeLabel).toBe("Donnerstag 08:00 bis 10:00 Uhr");
  });

  it("sets shiftTemplateLabel when demand times match a preset", () => {
    const dateISO = "2026-06-04";

    const entries = computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId,
      dateISO,
      serviceHours,
      assignments: [],
      assignmentPresets: [
        {
          id: "preset-morning",
          name: "Frühschicht",
          color: "#000",
          start_time: "08:00",
          end_time: "10:00",
        },
        {
          id: "preset-evening",
          name: "Spätschicht",
          color: "#000",
          start_time: "18:00",
          end_time: "22:00",
        },
      ],
      qualifications,
      profileQualificationIds: new Map(),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
      formatCalendarTimeLabel: (start, end) => `${start}-${end} Uhr`,
    });

    expect(entries[0]!.shiftTemplateLabel).toBe("Frühschicht");
    expect(entries[1]!.shiftTemplateLabel).toBe("Spätschicht");
  });

  it("omits shiftTemplateLabel when demand times do not match any preset", () => {
    const dateISO = "2026-06-04";

    const entries = computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId,
      dateISO,
      serviceHours,
      assignments: [],
      assignmentPresets: [
        {
          id: "preset-other",
          name: "Andere Schicht",
          color: "#000",
          start_time: "09:00",
          end_time: "17:00",
        },
      ],
      qualifications,
      profileQualificationIds: new Map(),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
    });

    expect(entries[0]!.shiftTemplateLabel).toBeUndefined();
  });
});

describe("formatStaffingEntryTooltipContent", () => {
  const formatQualLine = (name: string, assigned: number, required: number) =>
    `${name}: ${assigned}/${required}`;

  it("includes shift template above time when preset matches", () => {
    const body = formatStaffingEntryTooltipContent(
      {
        serviceHourId: "hour-1",
        label: "Do 08:00–10:00",
        assigned: 1,
        required: 2,
        calendarTimeLabel: "08:00 - 10:00 Uhr",
        shiftTemplateLabel: "Frühschicht",
        qualifications: [
          {
            qualificationId: qualKoch,
            name: "Koch",
            assigned: 1,
            required: 2,
          },
        ],
      },
      formatQualLine
    );

    expect(body).toBe(
      "Frühschicht\n08:00 - 10:00 Uhr\nKoch: 1/2"
    );
  });

  it("shows only time when no preset matches", () => {
    const body = formatStaffingEntryTooltipContent(
      {
        serviceHourId: "hour-1",
        label: "Do 08:00–10:00",
        assigned: 0,
        required: 2,
        calendarTimeLabel: "08:00 - 10:00 Uhr",
      },
      formatQualLine
    );

    expect(body).toBe("08:00 - 10:00 Uhr\n0/2");
  });
});

describe("buildStaffingQualificationBreakdown", () => {
  it("sorts qualifications by sort_order", () => {
    const breakdown = buildStaffingQualificationBreakdown(
      [],
      staffingRules.filter((rule) => rule.service_hour_id === hourEvening),
      new Map(),
      new Map([
        [qualKoch, "Koch"],
        [qualKellner, "Kellner"],
      ]),
      new Map([
        [qualKoch, 1],
        [qualKellner, 2],
      ])
    );

    expect(breakdown.map((item) => item.name)).toEqual(["Koch", "Kellner"]);
  });
});
