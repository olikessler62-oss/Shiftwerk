import { describe, expect, it } from "vitest";
import { weekdayIndexFromDate } from "@/lib/location-staffing-client";
import {
  computeDashboardAreaWeekStats,
  computeDashboardLocationWeekRollup,
  resolveDashboardAreaAmpelLevelFromWindowRows,
  resolveDashboardDayAreaStaffingGaugeFromWindowRows,
  sortDashboardAreaWeekStats,
  staffingWindowRowDisplayAssigned,
  staffingWindowRowHasUnconfirmedPlannedCoverage,
} from "./dashboard-area-week-stats";

const testDate = "2026-06-16";
const testWeekday = weekdayIndexFromDate(testDate);

const baseArea = {
  id: "area-1",
  name: "Küche",
  location_id: "loc-1",
  color: "#000",
  sort_order: 0,
  created_at: "",
  updated_at: "",
};

const emptyStaffingWindowRows = [];

describe("staffingWindowRowDisplayAssigned", () => {
  it("uses uncapped projected count for planned rows", () => {
    expect(
      staffingWindowRowDisplayAssigned({
        serviceHourId: "hour-frueh",
        label: "Früh",
        assigned: 0,
        projectedAssigned: 2,
        required: 1,
      })
    ).toBe(2);
  });

  it("keeps confirmed count for met rows", () => {
    expect(
      staffingWindowRowDisplayAssigned({
        serviceHourId: "hour-frueh",
        label: "Früh",
        assigned: 1,
        projectedAssigned: 1,
        required: 1,
      })
    ).toBe(1);
  });

  it("shows projected count for partial planned understaffed rows", () => {
    expect(
      staffingWindowRowDisplayAssigned({
        serviceHourId: "hour-frueh",
        label: "Früh",
        assigned: 0,
        projectedAssigned: 1,
        required: 2,
      })
    ).toBe(1);
  });
});

describe("computeDashboardAreaWeekStats", () => {
  it("marks area as met when staffing is fully covered", () => {
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [testDate],
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
      ],
      staffingRules: [
        {
          id: "rule-1",
          location_area_id: "area-1",
          service_hour_id: "hour-1",
          qualification_id: "qual-1",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: "hour-1",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "11:00",
          end_time: "15:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [{ id: "qual-1", name: "Koch", sort_order: 0 }],
      profileQualificationIds: new Map([["e1", new Set(["qual-1"])]]),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    expect(stats.ampelLevel).toBe("met");
    expect(stats.openSlots).toBe(0);
    expect(stats.assignedTotal).toBe(1);
    expect(stats.requiredTotal).toBe(1);
    expect(stats.shiftCount).toBe(1);
    expect(stats.staffingWindowRows).toHaveLength(1);
    expect(stats.staffingWindowRows[0].status).toBe("met");
    expect(stats.staffingWindowRows[0].assigned).toBe(1);
    expect(stats.staffingWindowRows[0].required).toBe(1);
    expect(stats.hasAreaShiftTemplates).toBe(false);
    expect(stats.staffingWindowRows[0].shiftName).toBe("");
  });

  it("counts all planned shifts and shows uncapped row totals for overplanned windows", () => {
    const tourDate = "2026-07-07";
    const tourWeekday = weekdayIndexFromDate(tourDate);
    const hourFrueh = "hour-frueh";
    const hourSpaet = "hour-spaet";
    const qualPflege = "qual-pflege";

    const stats = computeDashboardAreaWeekStats({
      area: { ...baseArea, id: "area-tour-1", name: "Tour 1" },
      dates: [tourDate],
      shifts: [
        {
          id: "s-frueh-1",
          employee_id: "e1",
          shift_date: tourDate,
          shiftName: "Früh",
          color: "#000",
          startTime: "08:00",
          endTime: "17:00",
          location_area_id: "area-tour-1",
          area_shift_template_id: null,
          confirmationStatus: "proposed",
        },
        {
          id: "s-frueh-2",
          employee_id: "e3",
          shift_date: tourDate,
          shiftName: "Früh",
          color: "#000",
          startTime: "08:00",
          endTime: "17:00",
          location_area_id: "area-tour-1",
          area_shift_template_id: null,
          confirmationStatus: "proposed",
        },
        {
          id: "s-spaet",
          employee_id: "e2",
          shift_date: tourDate,
          shiftName: "Spät",
          color: "#000",
          startTime: "12:00",
          endTime: "20:00",
          location_area_id: "area-tour-1",
          area_shift_template_id: null,
          confirmationStatus: "proposed",
        },
      ],
      staffingRules: [
        {
          id: "rule-frueh",
          location_area_id: "area-tour-1",
          service_hour_id: hourFrueh,
          qualification_id: qualPflege,
          required_count: 1,
        },
        {
          id: "rule-spaet",
          location_area_id: "area-tour-1",
          service_hour_id: hourSpaet,
          qualification_id: qualPflege,
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: hourFrueh,
          location_area_id: "area-tour-1",
          weekday: tourWeekday,
          start_time: "08:00",
          end_time: "17:00",
        },
        {
          id: hourSpaet,
          location_area_id: "area-tour-1",
          weekday: tourWeekday,
          start_time: "12:00",
          end_time: "20:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [{ id: qualPflege, name: "Pflege", sort_order: 0 }],
      profileQualificationIds: new Map([
        ["e1", new Set([qualPflege])],
        ["e2", new Set([qualPflege])],
        ["e3", new Set([qualPflege])],
      ]),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    expect(stats.shiftCount).toBe(3);
    expect(stats.requiredTotal).toBe(2);
    expect(stats.projectedAssignedTotal).toBe(3);
    expect(stats.grossHours).toBe(26);
    expect(stats.hasPlannedCoverage).toBe(true);
    expect(stats.staffingWindowRows.filter((row) => row.rowKind === "staffing_window")).toHaveLength(2);
    expect(stats.staffingWindowRows.map((row) => row.status)).toEqual([
      "planned",
      "planned",
    ]);
    expect(stats.staffingWindowRows.map((row) => row.assigned)).toEqual([2, 1]);
  });

  it("shows partial planned coverage as 1/2 with unconfirmed planned flag", () => {
    const tourDate = "2026-07-08";
    const tourWeekday = weekdayIndexFromDate(tourDate);
    const hourFrueh = "hour-frueh";
    const qualPflege = "qual-pflege";

    const stats = computeDashboardAreaWeekStats({
      area: { ...baseArea, id: "area-tour-1", name: "Tour 1" },
      dates: [tourDate],
      shifts: [
        {
          id: "s-frueh-1",
          employee_id: "e1",
          shift_date: tourDate,
          shiftName: "Früh",
          color: "#000",
          startTime: "08:00",
          endTime: "17:00",
          location_area_id: "area-tour-1",
          area_shift_template_id: null,
          confirmationStatus: "proposed",
        },
      ],
      staffingRules: [
        {
          id: "rule-frueh",
          location_area_id: "area-tour-1",
          service_hour_id: hourFrueh,
          qualification_id: qualPflege,
          required_count: 2,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: hourFrueh,
          location_area_id: "area-tour-1",
          weekday: tourWeekday,
          start_time: "08:00",
          end_time: "17:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [{ id: qualPflege, name: "Pflege", sort_order: 0 }],
      profileQualificationIds: new Map([["e1", new Set([qualPflege])]]),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    const row = stats.staffingWindowRows.find(
      (item) => item.rowKind === "staffing_window"
    );
    expect(row).toMatchObject({
      assigned: 1,
      confirmedAssigned: 0,
      required: 2,
      status: "understaffed",
    });
    expect(staffingWindowRowHasUnconfirmedPlannedCoverage(row!)).toBe(true);
    expect(stats.openSlots).toBe(1);
  });

  it("counts shifts only for the requested dates scope", () => {
    const otherDate = "2026-06-17";
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [testDate],
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
        {
          id: "s2",
          employee_id: "e2",
          shift_date: otherDate,
          shiftName: "Abend",
          color: "#000",
          startTime: "17:00",
          endTime: "21:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
      ],
      staffingRules: [],
      staffingOverrides: [],
      serviceHours: [],
      areaShiftTemplates: [],
      qualifications: [],
      profileQualificationIds: new Map(),
      compensationByKey: {},
      staffingEnabled: false,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    expect(stats.shiftCount).toBe(1);
  });

  it("collects deduplicated confirmation conflict statuses for the area week", () => {
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [testDate],
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
          confirmationStatus: "pending",
        },
        {
          id: "s2",
          employee_id: "e2",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
          confirmationStatus: "rejected",
        },
        {
          id: "s3",
          employee_id: "e3",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
          confirmationStatus: "confirmed",
        },
      ],
      staffingRules: [
        {
          id: "rule-1",
          location_area_id: "area-1",
          service_hour_id: "hour-1",
          qualification_id: "qual-1",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: "hour-1",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "11:00",
          end_time: "15:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [{ id: "qual-1", name: "Koch", sort_order: 0 }],
      profileQualificationIds: new Map([
        ["e1", new Set(["qual-1"])],
        ["e2", new Set(["qual-1"])],
        ["e3", new Set(["qual-1"])],
      ]),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    expect(stats.confirmationConflictStatuses).toEqual(["pending", "rejected"]);
  });

  it("marks assignment-mismatch windows as overstaffed (ocker) when headcount matches", () => {
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [testDate],
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
        {
          id: "s2",
          employee_id: "e2",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
      ],
      staffingRules: [
        {
          id: "rule-koch",
          location_area_id: "area-1",
          service_hour_id: "hour-1",
          qualification_id: "qual-koch",
          required_count: 1,
        },
        {
          id: "rule-spuel",
          location_area_id: "area-1",
          service_hour_id: "hour-1",
          qualification_id: "qual-spuel",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: "hour-1",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "11:00",
          end_time: "15:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [
        { id: "qual-koch", name: "Koch", sort_order: 0 },
        { id: "qual-spuel", name: "Spülkraft", sort_order: 1 },
      ],
      profileQualificationIds: new Map([
        ["e1", new Set(["qual-koch"])],
        ["e2", new Set(["qual-koch"])],
      ]),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    expect(stats.hasAssignmentMismatch).toBe(true);
    expect(stats.assignedTotal).toBe(2);
    expect(stats.requiredTotal).toBe(2);
    expect(stats.staffingWindowRows).toHaveLength(1);
    expect(stats.staffingWindowRows[0]).toMatchObject({
      assigned: 2,
      required: 2,
      status: "overstaffed",
      hasConflict: false,
    });
    expect(stats.staffingWindowRows[0].staffingHints?.length).toBeGreaterThan(0);
    expect(stats.staffingWindowRows[0].staffingConflicts).toBeUndefined();
  });

  it("lists understaffed and met windows in staffing rows", () => {
    const secondDate = "2026-06-17";
    const secondWeekday = weekdayIndexFromDate(secondDate);
    const partialShifts = Array.from({ length: 5 }, (_, index) => ({
      id: `s-partial-${index}`,
      employee_id: `e${index + 2}`,
      shift_date: secondDate,
      shiftName: "Abend",
      color: "#000",
      startTime: "17:00",
      endTime: "21:00",
      location_area_id: "area-1",
      area_shift_template_id: null,
    }));

    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [testDate, secondDate],
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: testDate,
          shiftName: "Mittag",
          color: "#000",
          startTime: "11:00",
          endTime: "15:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
        ...partialShifts,
      ],
      staffingRules: [
        {
          id: "rule-critical",
          location_area_id: "area-1",
          service_hour_id: "hour-critical",
          qualification_id: "qual-1",
          required_count: 5,
        },
        {
          id: "rule-partial",
          location_area_id: "area-1",
          service_hour_id: "hour-partial",
          qualification_id: "qual-1",
          required_count: 6,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: "hour-critical",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "11:00",
          end_time: "15:00",
        },
        {
          id: "hour-partial",
          location_area_id: "area-1",
          weekday: secondWeekday,
          start_time: "17:00",
          end_time: "21:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [{ id: "qual-1", name: "Koch", sort_order: 0 }],
      profileQualificationIds: new Map([
        ["e1", new Set(["qual-1"])],
        ["e2", new Set(["qual-1"])],
        ["e3", new Set(["qual-1"])],
        ["e4", new Set(["qual-1"])],
        ["e5", new Set(["qual-1"])],
        ["e6", new Set(["qual-1"])],
      ]),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: (dateISO) => (dateISO === testDate ? "Di." : "Mi."),
    });

    expect(stats.staffingWindowRows).toHaveLength(2);
    expect(
      stats.staffingWindowRows.find((row) => row.dateISO === testDate)?.status
    ).toBe("understaffed");
    expect(
      stats.staffingWindowRows.find((row) => row.dateISO === secondDate)?.status
    ).toBe("understaffed");
    expect(
      stats.staffingWindowRows.find((row) => row.dateISO === secondDate)?.assigned
    ).toBe(5);
    expect(
      stats.staffingWindowRows.find((row) => row.dateISO === secondDate)?.required
    ).toBe(6);
    expect(stats.staffingIssues).toEqual([]);
  });

  it("uses shift template name only when demand times match a template", () => {
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [testDate],
      shifts: [],
      staffingRules: [
        {
          id: "rule-match",
          location_area_id: "area-1",
          service_hour_id: "hour-match",
          qualification_id: "qual-1",
          required_count: 1,
        },
        {
          id: "rule-miss",
          location_area_id: "area-1",
          service_hour_id: "hour-miss",
          qualification_id: "qual-1",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: "hour-match",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "17:00",
          end_time: "21:00",
        },
        {
          id: "hour-miss",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "11:00",
          end_time: "15:00",
        },
      ],
      areaShiftTemplates: [
        {
          id: "tpl-spaet",
          location_area_id: "area-1",
          name: "spät",
          color: "#000",
          start_time: "17:00",
          end_time: "21:00",
          sort_order: 0,
          archived_at: null,
        },
      ],
      qualifications: [{ id: "qual-1", name: "Koch", sort_order: 0 }],
      profileQualificationIds: new Map(),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "Di.",
    });

    expect(stats.hasAreaShiftTemplates).toBe(true);
    expect(
      stats.staffingWindowRows.find((row) => row.serviceHourId === "hour-match")
        ?.shiftName
    ).toBe("spät");
    expect(
      stats.staffingWindowRows.find((row) => row.serviceHourId === "hour-miss")
        ?.shiftName
    ).toBe("");
  });

  it("adds no-service-hours rows for closed days in the week", () => {
    const closedDate = "2026-06-14";
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [closedDate, testDate],
      shifts: [],
      staffingRules: [
        {
          id: "rule-1",
          location_area_id: "area-1",
          service_hour_id: "hour-1",
          qualification_id: "qual-1",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      serviceHours: [
        {
          id: "hour-1",
          location_area_id: "area-1",
          weekday: testWeekday,
          start_time: "11:00",
          end_time: "15:00",
        },
      ],
      areaShiftTemplates: [],
      qualifications: [{ id: "qual-1", name: "Koch", sort_order: 0 }],
      profileQualificationIds: new Map(),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "Di",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: (dateISO) => (dateISO === testDate ? "Di." : "So."),
    });

    expect(stats.staffingWindowRows).toHaveLength(2);
    expect(stats.staffingWindowRows[0]).toMatchObject({
      rowKind: "no_service_hours",
      dateISO: closedDate,
      hasUnplannedShifts: false,
    });
    expect(stats.staffingWindowRows[1]).toMatchObject({
      rowKind: "staffing_window",
      dateISO: testDate,
    });
  });

  it("flags unplanned shifts on days without service hours", () => {
    const closedDate = "2026-06-14";
    const stats = computeDashboardAreaWeekStats({
      area: baseArea,
      dates: [closedDate],
      shifts: [
        {
          id: "s1",
          employee_id: "e1",
          shift_date: closedDate,
          shiftName: "Sonder",
          color: "#000",
          startTime: "10:00",
          endTime: "14:00",
          location_area_id: "area-1",
          area_shift_template_id: null,
        },
      ],
      staffingRules: [],
      staffingOverrides: [],
      serviceHours: [],
      areaShiftTemplates: [],
      qualifications: [],
      profileQualificationIds: new Map(),
      compensationByKey: {},
      staffingEnabled: true,
      formatTimeLabel: (weekday, start, end) => `${weekday} ${start}-${end}`,
      weekdayLabel: () => "So",
      formatCalendarTimeLabel: (start, end) => `${start}-${end}`,
      formatWeekdayLabel: () => "So.",
    });

    expect(stats.staffingWindowRows).toHaveLength(1);
    expect(stats.staffingWindowRows[0]).toMatchObject({
      rowKind: "no_service_hours",
      dateISO: closedDate,
      hasUnplannedShifts: true,
      shiftName: "",
      assigned: 1,
      required: 1,
    });
  });

  it("aggregates location rollup across areas", () => {
    const rollup = computeDashboardLocationWeekRollup([
      {
        areaId: "a1",
        areaName: "A",
        sortOrder: 0,
        shiftCount: 2,
        assignedTotal: 2,
        requiredTotal: 4,
        openSlots: 2,
        understaffedWindowCount: 1,
        ampelLevel: "partial",
        gaugeVariant: "overstaffed",
        criticalWindowLabel: null,
        staffingWindowRows: emptyStaffingWindowRows,
        staffingIssues: [],
        confirmationConflictStatuses: [],
        totalHours: 10,
        grossHours: 10,
        breakHours: 0,
        baseCost: 100,
        surchargeCost: 20,
        totalCost: 120,
        hasCompensation: true,
        currency: "EUR",
        hasAssignmentMismatch: false,
        hasPlannedCoverage: false,
        hasUnderstaffed: true,
        projectedAssignedTotal: 2,
        headerOpenAssignedTotal: 0,
        headerOpenRequiredTotal: 0,
        headerPlannedAssignedTotal: 0,
        headerPlannedRequiredTotal: 0,
        headerMismatchAssignedTotal: 0,
        headerMismatchRequiredTotal: 0,
        headerOverstaffedAssignedTotal: 0,
        headerOverstaffedRequiredTotal: 0,
        headerMetAssignedTotal: 0,
        headerMetRequiredTotal: 0,
        hasAreaShiftTemplates: false,
      },
      {
        areaId: "a2",
        areaName: "B",
        sortOrder: 1,
        shiftCount: 1,
        assignedTotal: 1,
        requiredTotal: 5,
        openSlots: 4,
        understaffedWindowCount: 2,
        ampelLevel: "critical",
        gaugeVariant: "understaffed",
        criticalWindowLabel: "Fr 18-22",
        staffingWindowRows: emptyStaffingWindowRows,
        staffingIssues: [],
        confirmationConflictStatuses: [],
        totalHours: 8,
        grossHours: 8,
        breakHours: 0,
        baseCost: 80,
        surchargeCost: 10,
        totalCost: 90,
        hasCompensation: true,
        currency: "EUR",
        hasAssignmentMismatch: false,
        hasPlannedCoverage: false,
        hasUnderstaffed: true,
        projectedAssignedTotal: 2,
        headerOpenAssignedTotal: 0,
        headerOpenRequiredTotal: 0,
        headerPlannedAssignedTotal: 0,
        headerPlannedRequiredTotal: 0,
        headerMismatchAssignedTotal: 0,
        headerMismatchRequiredTotal: 0,
        headerOverstaffedAssignedTotal: 0,
        headerOverstaffedRequiredTotal: 0,
        headerMetAssignedTotal: 0,
        headerMetRequiredTotal: 0,
        hasAreaShiftTemplates: false,
      },
    ]);

    expect(rollup.openSlots).toBe(6);
    expect(rollup.criticalAreaCount).toBe(1);
    expect(rollup.totalCost).toBe(210);
  });
});

describe("sortDashboardAreaWeekStats", () => {
  it("sorts areas by sort_order then name", () => {
    const sorted = sortDashboardAreaWeekStats([
      {
        areaId: "b",
        areaName: "Bar",
        sortOrder: 2,
        shiftCount: 0,
        assignedTotal: 2,
        requiredTotal: 2,
        openSlots: 0,
        understaffedWindowCount: 0,
        ampelLevel: "met",
        gaugeVariant: "met",
        criticalWindowLabel: null,
        staffingWindowRows: emptyStaffingWindowRows,
        staffingIssues: [],
        confirmationConflictStatuses: [],
        totalHours: 0,
        grossHours: 0,
        breakHours: 0,
        baseCost: 200,
        surchargeCost: 0,
        totalCost: 200,
        hasCompensation: true,
        currency: "EUR",
        hasAssignmentMismatch: false,
        hasPlannedCoverage: false,
        hasUnderstaffed: false,
        projectedAssignedTotal: 2,
        headerOpenAssignedTotal: 0,
        headerOpenRequiredTotal: 0,
        headerPlannedAssignedTotal: 0,
        headerPlannedRequiredTotal: 0,
        headerMismatchAssignedTotal: 0,
        headerMismatchRequiredTotal: 0,
        headerOverstaffedAssignedTotal: 0,
        headerOverstaffedRequiredTotal: 0,
        headerMetAssignedTotal: 0,
        headerMetRequiredTotal: 0,
        hasAreaShiftTemplates: false,
      },
      {
        areaId: "a",
        areaName: "Küche",
        sortOrder: 1,
        shiftCount: 0,
        assignedTotal: 1,
        requiredTotal: 5,
        openSlots: 4,
        understaffedWindowCount: 2,
        ampelLevel: "critical",
        gaugeVariant: "understaffed",
        criticalWindowLabel: null,
        staffingWindowRows: emptyStaffingWindowRows,
        staffingIssues: [],
        confirmationConflictStatuses: [],
        totalHours: 0,
        grossHours: 0,
        breakHours: 0,
        baseCost: 50,
        surchargeCost: 10,
        totalCost: 60,
        hasCompensation: true,
        currency: "EUR",
        hasAssignmentMismatch: false,
        hasPlannedCoverage: false,
        hasUnderstaffed: true,
        projectedAssignedTotal: 1,
        headerOpenAssignedTotal: 0,
        headerOpenRequiredTotal: 0,
        headerPlannedAssignedTotal: 0,
        headerPlannedRequiredTotal: 0,
        headerMismatchAssignedTotal: 0,
        headerMismatchRequiredTotal: 0,
        headerOverstaffedAssignedTotal: 0,
        headerOverstaffedRequiredTotal: 0,
        headerMetAssignedTotal: 0,
        headerMetRequiredTotal: 0,
        hasAreaShiftTemplates: false,
      },
    ]);

    expect(sorted.map((entry) => entry.areaId)).toEqual(["a", "b"]);
  });
});

describe("resolveDashboardAreaAmpelLevelFromWindowRows", () => {
  it("returns met for a fully covered day even when the week has other gaps", () => {
    const metDayRows = [
      {
        rowKind: "staffing_window" as const,
        dateISO: "2026-06-24",
        serviceHourId: "hour-1",
        weekdayLabel: "Mi.",
        timeFrom: "12:00",
        timeTo: "15:00",
        shiftName: "Mittel",
        assigned: 2,
        required: 2,
        status: "met" as const,
        hasConflict: false,
      },
    ];

    expect(resolveDashboardAreaAmpelLevelFromWindowRows(metDayRows)).toBe("met");
  });

  it("returns partial for a day with planned but uncovered slots", () => {
    const partialDayRows = [
      {
        rowKind: "staffing_window" as const,
        dateISO: "2026-06-25",
        serviceHourId: "hour-1",
        weekdayLabel: "Do.",
        timeFrom: "12:00",
        timeTo: "15:00",
        shiftName: "Mittel",
        assigned: 1,
        required: 2,
        status: "planned" as const,
        hasConflict: false,
      },
    ];

    expect(resolveDashboardAreaAmpelLevelFromWindowRows(partialDayRows)).toBe(
      "partial"
    );
  });
});

describe("resolveDashboardDayAreaStaffingGaugeFromWindowRows", () => {
  it("aggregates assigned/required and maps planned coverage to gauge variant", () => {
    const rows = [
      {
        rowKind: "staffing_window" as const,
        dateISO: "2026-06-25",
        serviceHourId: "hour-1",
        weekdayLabel: "Do.",
        timeFrom: "12:00",
        timeTo: "15:00",
        shiftName: "Mittel",
        assigned: 1,
        required: 2,
        status: "planned" as const,
        hasConflict: false,
      },
      {
        rowKind: "staffing_window" as const,
        dateISO: "2026-06-25",
        serviceHourId: "hour-2",
        weekdayLabel: "Do.",
        timeFrom: "18:00",
        timeTo: "22:00",
        shiftName: "Abend",
        assigned: 2,
        required: 2,
        status: "met" as const,
        hasConflict: false,
      },
    ];

    expect(resolveDashboardDayAreaStaffingGaugeFromWindowRows(rows)).toEqual({
      assigned: 3,
      required: 4,
      variant: "planned",
    });
  });

  it("returns null when there is no staffing demand", () => {
    expect(
      resolveDashboardDayAreaStaffingGaugeFromWindowRows([
        {
          rowKind: "no_service_hours",
          dateISO: "2026-06-25",
          serviceHourId: "",
          weekdayLabel: "Do.",
          timeFrom: "",
          timeTo: "",
          shiftName: "",
          assigned: 0,
          required: 0,
          status: "met",
        },
      ])
    ).toBeNull();
  });
});
