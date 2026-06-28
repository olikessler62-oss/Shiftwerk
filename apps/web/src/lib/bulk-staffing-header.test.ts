import { describe, expect, it } from "vitest";
import {
  allocateAssignmentsToDemandWindows,
  buildStaffingConflictDetails,
  buildStaffingQualificationBreakdown,
  countQualificationCoverage,
  computeBulkStaffingHeaderEntries,
  formatStaffingConflictTooltipLines,
  formatStaffingEntryTooltipSection,
  type StaffingTooltipCoverageFormatter,
  mapAssignmentQualificationIds,
  staffingAssignmentsForAreaDay,
  staffingAssignmentsForPlanningAreaDay,
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

  it("counts all explicit qualification rows even when demand is already met", () => {
    const assignments: StaffingAssignmentRef[] = [
      {
        startTime: "12:00",
        endTime: "16:00",
        employeeId: "emp-1",
        qualificationId: qualKoch,
      },
      {
        startTime: "12:00",
        endTime: "16:00",
        employeeId: "emp-2",
        qualificationId: qualKoch,
      },
    ];
    const qualRules = staffingRules.filter(
      (rule) => rule.service_hour_id === hourEvening
    );

    const counts = countQualificationCoverage(
      assignments,
      qualRules,
      new Map()
    );

    expect(counts.get(qualKoch)).toBe(2);
    expect(counts.get(qualKellner)).toBe(0);
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

  it("counts inferred qualifications beyond demand for overstaffing display", () => {
    const assignments: StaffingAssignmentRef[] = [
      {
        startTime: "12:00",
        endTime: "16:00",
        employeeId: "emp-1",
      },
      {
        startTime: "12:00",
        endTime: "16:00",
        employeeId: "emp-2",
      },
      {
        startTime: "12:00",
        endTime: "16:00",
        employeeId: "emp-3",
      },
    ];
    const qualRules = staffingRules.filter(
      (rule) => rule.service_hour_id === hourEvening
    );
    const profileQuals = new Map([
      ["emp-1", new Set([qualKellner])],
      ["emp-2", new Set([qualKellner])],
      ["emp-3", new Set([qualKellner])],
    ]);

    const counts = countQualificationCoverage(
      assignments,
      qualRules,
      profileQuals
    );

    expect(counts.get(qualKellner)).toBe(3);
    expect(counts.get(qualKoch)).toBe(0);
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

  it("prefers exact demand times over a wider overlapping demand window", () => {
    const hourFrueh = "hour-frueh";
    const hourMittel = "hour-mittel";
    const windows: DemandWindowRef[] = [
      { serviceHourId: hourFrueh, startTime: "08:00", endTime: "10:00" },
      { serviceHourId: hourMittel, startTime: "08:00", endTime: "15:00" },
    ];
    const assignments: StaffingAssignmentRef[] = [
      { startTime: "08:00", endTime: "10:00", employeeId: "emp-a" },
      { startTime: "08:00", endTime: "10:00", employeeId: "emp-b" },
      { startTime: "12:00", endTime: "15:00", employeeId: "emp-c" },
    ];

    const allocation = allocateAssignmentsToDemandWindows(assignments, windows);

    expect(allocation.get(hourFrueh)).toEqual([0, 1]);
    expect(allocation.get(hourMittel)).toEqual([2]);
  });
});

describe("staffingAssignmentsForAreaDay", () => {
  it("counts all area shifts on the date", () => {
    const assignments = staffingAssignmentsForAreaDay(
      [
        {
          shift_date: "2026-06-15",
          location_area_id: "area-restaurant",
          employee_id: "emp-a",
          startTime: "08:00",
          endTime: "10:00",
        },
        {
          shift_date: "2026-06-15",
          location_area_id: "area-restaurant",
          employee_id: "emp-hidden",
          startTime: "12:00",
          endTime: "15:00",
        },
        {
          shift_date: "2026-06-15",
          location_area_id: "area-bar",
          employee_id: "emp-a",
          startTime: "08:00",
          endTime: "10:00",
        },
      ],
      "2026-06-15",
      "area-restaurant"
    );

    expect(assignments).toEqual([
      {
        startTime: "08:00",
        endTime: "10:00",
        employeeId: "emp-a",
      },
      {
        startTime: "12:00",
        endTime: "15:00",
        employeeId: "emp-hidden",
      },
    ]);
  });
});

describe("staffingAssignmentsForPlanningAreaDay", () => {
  const areaId = "area-restaurant";
  const dateISO = "2026-06-15";
  const visibleEmployeeIds = new Set(["emp-a", "emp-b"]);

  it("keeps only area, date, and visible employee shifts", () => {
    const assignments = staffingAssignmentsForPlanningAreaDay(
      [
        {
          shift_date: dateISO,
          location_area_id: areaId,
          employee_id: "emp-a",
          startTime: "08:00",
          endTime: "10:00",
        },
        {
          shift_date: dateISO,
          location_area_id: "area-bar",
          employee_id: "emp-a",
          startTime: "08:00",
          endTime: "10:00",
        },
        {
          shift_date: dateISO,
          location_area_id: areaId,
          employee_id: "emp-hidden",
          startTime: "12:00",
          endTime: "15:00",
        },
        {
          shift_date: "2026-06-16",
          location_area_id: areaId,
          employee_id: "emp-b",
          startTime: "08:00",
          endTime: "10:00",
        },
      ],
      dateISO,
      areaId,
      visibleEmployeeIds
    );

    expect(assignments).toEqual([
      {
        startTime: "08:00",
        endTime: "10:00",
        employeeId: "emp-a",
      },
    ]);
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
    expect(entries[0]!.projectedAssigned).toBe(1);
    expect(entries[0]!.required).toBe(2);
    expect(entries[1]!.qualifications).toEqual([
      { qualificationId: qualKoch, name: "Koch", assigned: 0, required: 1 },
      { qualificationId: qualKellner, name: "Kellner", assigned: 1, required: 2 },
    ]);
  });

  it("separates confirmed and projected staffing counts by confirmation status", () => {
    const dateISO = "2026-06-04";

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
          confirmationStatus: "proposed",
        },
        {
          startTime: "08:00",
          endTime: "10:00",
          employeeId: "emp-koch-2",
          qualificationId: qualKoch,
          confirmationStatus: "confirmed",
        },
      ],
      assignmentPresets: [],
      qualifications,
      profileQualificationIds: new Map([
        ["emp-koch", new Set([qualKoch])],
        ["emp-koch-2", new Set([qualKoch])],
      ]),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
    });

    expect(entries[0]!.assigned).toBe(1);
    expect(entries[0]!.projectedAssigned).toBe(2);
    expect(entries[0]!.qualifications?.[0]).toMatchObject({
      qualificationId: qualKoch,
      assigned: 1,
      required: 2,
    });
    expect(entries[0]!.projectedQualifications?.[0]).toMatchObject({
      qualificationId: qualKoch,
      assigned: 2,
      required: 2,
    });
  });

  it("counts all inferred kellner shifts when overstaffed", () => {
    const dateISO = "2026-06-04";

    const entries = computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId,
      dateISO,
      serviceHours,
      assignments: [
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-1",
        },
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-2",
        },
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-3",
        },
      ],
      assignmentPresets: [],
      qualifications,
      profileQualificationIds: new Map([
        ["emp-1", new Set([qualKellner])],
        ["emp-2", new Set([qualKellner])],
        ["emp-3", new Set([qualKellner])],
      ]),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
    });

    const evening = entries.find((entry) => entry.serviceHourId === hourEvening);
    expect(evening?.assigned).toBe(3);
    expect(evening?.required).toBe(3);
    expect(evening?.qualifications).toEqual([
      { qualificationId: qualKoch, name: "Koch", assigned: 0, required: 1 },
      { qualificationId: qualKellner, name: "Kellner", assigned: 3, required: 2 },
    ]);
    expect(evening?.conflictDetails).toEqual([
      expect.objectContaining({
        kind: "overstaffed",
        employeeName: "emp-3",
        assignedQualificationName: "Kellner",
      }),
    ]);
  });

  it("builds conflict footnote with employee, time and position", () => {
    const dateISO = "2026-06-04";

    const entries = computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId,
      dateISO,
      serviceHours,
      assignments: [
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-1",
        },
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-2",
        },
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-3",
        },
      ],
      assignmentPresets: [],
      qualifications,
      profileQualificationIds: new Map([
        ["emp-1", new Set([qualKellner])],
        ["emp-2", new Set([qualKellner])],
        ["emp-3", new Set([qualKellner])],
      ]),
      employeeNameById: new Map([
        ["emp-1", "Anna"],
        ["emp-2", "Ben"],
        ["emp-3", "Carl"],
      ]),
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start} bis ${end} Uhr`,
      weekdayLabel: () => "Donnerstag",
      formatCalendarTimeLabel: (start, end) => `${start}-${end} Uhr`,
    });

    const evening = entries.find((entry) => entry.serviceHourId === hourEvening);
    const footnote = formatStaffingConflictTooltipLines(
      evening ? [evening] : [],
      (key, params) => `${key}:${JSON.stringify(params)}`
    );

    const conflictText = footnote.join("\n");
    expect(conflictText).toContain("Carl");
    expect(conflictText).toContain("18:00-22:00 Uhr");
    expect(conflictText).toContain("Kellner");
    expect(conflictText).not.toContain("Anna");
    expect(conflictText).not.toContain("Koch");
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

describe("formatStaffingEntryTooltipSection", () => {
  const formatCoverage: StaffingTooltipCoverageFormatter = {
    confirmed: (assigned, required, name, shiftTime) =>
      `${assigned}/${required} für ${name}${shiftTime} bestätigt`,
    unconfirmed: (assigned, required, name, shiftTime) =>
      `${assigned}/${required} für ${name}${shiftTime} angefragt`,
    vacant: (count, required, name, shiftTime) =>
      `${count}/${required} für ${name}${shiftTime} offen`,
    totalConfirmed: (assigned, required, shiftTime) =>
      `${assigned}/${required}${shiftTime} bestätigt`,
    totalUnconfirmed: (assigned, required, shiftTime) =>
      `${assigned}/${required}${shiftTime} angefragt`,
    totalVacant: (count, required, shiftTime) =>
      `${count}/${required}${shiftTime} offen`,
  };

  it("combines shift template and time on one comma-separated line", () => {
    const section = formatStaffingEntryTooltipSection(
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
        projectedQualifications: [
          {
            qualificationId: qualKoch,
            name: "Koch",
            assigned: 1,
            required: 2,
          },
        ],
      },
      formatCoverage
    );

    expect(section).toEqual({
      periodLine: "Frühschicht, 08:00 - 10:00 Uhr",
      coverageLines: [
        "1/2 für Koch bestätigt",
        "1/2 für Koch offen",
      ],
    });
  });

  it("shows vacant aggregate line when no qualification breakdown exists", () => {
    const section = formatStaffingEntryTooltipSection(
      {
        serviceHourId: "hour-1",
        label: "Do 08:00–10:00",
        assigned: 0,
        required: 2,
        projectedAssigned: 0,
        calendarTimeLabel: "08:00 - 10:00 Uhr",
      },
      formatCoverage
    );

    expect(section).toEqual({
      periodLine: "08:00 - 10:00 Uhr",
      coverageLines: ["2/2 offen"],
    });
  });

  it("shows confirmed and unconfirmed lines for planned coverage", () => {
    const section = formatStaffingEntryTooltipSection(
      {
        serviceHourId: hourEvening,
        label: "Do 12:00–16:00",
        assigned: 1,
        projectedAssigned: 2,
        required: 2,
        calendarTimeLabel: "12:00 - 16:00 Uhr",
        shiftTemplateLabel: "Mittagschicht",
        qualifications: [
          {
            qualificationId: qualKellner,
            name: "Kellner",
            assigned: 1,
            required: 2,
          },
        ],
        projectedQualifications: [
          {
            qualificationId: qualKellner,
            name: "Kellner",
            assigned: 2,
            required: 2,
          },
        ],
      },
      formatCoverage
    );

    expect(section).toEqual({
      periodLine: "Mittagschicht, 12:00 - 16:00 Uhr",
      coverageLines: [
        "1/2 für Kellner bestätigt",
        "1/2 für Kellner angefragt",
      ],
    });
  });

  it("shows actual assigned count when overstaffed on one qualification", () => {
    const section = formatStaffingEntryTooltipSection(
      {
        serviceHourId: hourEvening,
        label: "Do 12:00–16:00",
        assigned: 3,
        required: 2,
        calendarTimeLabel: "12:00 - 16:00 Uhr",
        shiftTemplateLabel: "Mittagschicht",
        qualifications: [
          {
            qualificationId: qualKellner,
            name: "Kellner",
            assigned: 3,
            required: 2,
          },
        ],
        projectedQualifications: [
          {
            qualificationId: qualKellner,
            name: "Kellner",
            assigned: 3,
            required: 2,
          },
        ],
      },
      formatCoverage
    );

    expect(section).toEqual({
      periodLine: "Mittagschicht, 12:00 - 16:00 Uhr",
      coverageLines: ["3/2 für Kellner bestätigt"],
    });
  });

  it("lists each qualification on understaffed entries", () => {
    const section = formatStaffingEntryTooltipSection(
      {
        serviceHourId: hourEvening,
        label: "Do 12:00–16:00",
        assigned: 1,
        projectedAssigned: 1,
        required: 3,
        calendarTimeLabel: "12:00 - 16:00 Uhr",
        qualifications: [
          {
            qualificationId: qualKoch,
            name: "Koch",
            assigned: 1,
            required: 2,
          },
          {
            qualificationId: qualKellner,
            name: "Kellner",
            assigned: 0,
            required: 1,
          },
        ],
        projectedQualifications: [
          {
            qualificationId: qualKoch,
            name: "Koch",
            assigned: 1,
            required: 2,
          },
          {
            qualificationId: qualKellner,
            name: "Kellner",
            assigned: 0,
            required: 1,
          },
        ],
      },
      formatCoverage
    );

    expect(section.coverageLines).toEqual([
      "1/2 für Koch bestätigt",
      "1/2 für Koch offen",
      "1/1 für Kellner offen",
    ]);
  });
});

describe("buildStaffingConflictDetails", () => {
  const qualificationNameById = new Map([
    [qualKoch, "Koch"],
    [qualKellner, "Kellner"],
  ]);

  it("marks surplus assignments per qualification", () => {
    const hourAssignments: StaffingAssignmentRef[] = [
      { startTime: "18:00", endTime: "22:00", employeeId: "emp-1" },
      { startTime: "18:00", endTime: "22:00", employeeId: "emp-2" },
      { startTime: "18:00", endTime: "22:00", employeeId: "emp-3" },
    ];

    const details = buildStaffingConflictDetails({
      hourAssignments,
      qualRules: staffingRules.filter(
        (rule) => rule.service_hour_id === hourEvening
      ),
      profileQualificationIds: new Map([
        ["emp-1", new Set([qualKellner])],
        ["emp-2", new Set([qualKellner])],
        ["emp-3", new Set([qualKellner])],
      ]),
      qualificationNameById,
      employeeNameById: new Map([["emp-3", "Carl"]]),
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      totalRequired: 3,
    });

    expect(details).toEqual([
      {
        kind: "overstaffed",
        employeeName: "Carl",
        timeLabel: "18:00-22:00",
        assignedQualificationName: "Kellner",
      },
    ]);
  });

  it("flags wrong qualification placement when employee could fill an open role", () => {
    const hourAssignments: StaffingAssignmentRef[] = [
      { startTime: "18:00", endTime: "22:00", employeeId: "emp-1" },
      { startTime: "18:00", endTime: "22:00", employeeId: "emp-2" },
    ];

    const details = buildStaffingConflictDetails({
      hourAssignments,
      qualRules: staffingRules.filter(
        (rule) => rule.service_hour_id === hourEvening
      ),
      profileQualificationIds: new Map([
        ["emp-1", new Set([qualKoch, qualKellner])],
        ["emp-2", new Set([qualKellner])],
      ]),
      qualificationNameById,
      employeeNameById: new Map([
        ["emp-1", "Anna"],
        ["emp-2", "Ben"],
      ]),
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      totalRequired: 2,
    });

    expect(details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "qualification_mismatch",
          employeeName: "Anna",
          assignedQualificationName: "Kellner",
          missingQualificationName: "Koch",
        }),
      ])
    );
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

describe("mapAssignmentQualificationIds", () => {
  it("assigns one qualification per shift when employee has both", () => {
    const profileQualificationIds = new Map([
      ["emp-1", new Set([qualKellner, qualKoch])],
    ]);

    const mapping = mapAssignmentQualificationIds(
      [
        {
          startTime: "18:00",
          endTime: "22:00",
          employeeId: "emp-1",
          qualificationId: qualKoch,
        },
      ],
      staffingRules.filter((rule) => rule.service_hour_id === hourEvening),
      profileQualificationIds
    );

    expect(mapping.get(0)).toBe(qualKoch);
  });
});
