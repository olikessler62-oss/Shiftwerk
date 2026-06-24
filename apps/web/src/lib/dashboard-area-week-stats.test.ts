import { describe, expect, it } from "vitest";
import { weekdayIndexFromDate } from "@/lib/location-staffing-client";
import {
  computeDashboardAreaWeekStats,
  computeDashboardLocationWeekRollup,
  sortDashboardAreaWeekStats,
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
    });

    expect(stats.ampelLevel).toBe("met");
    expect(stats.openSlots).toBe(0);
    expect(stats.assignedTotal).toBe(1);
    expect(stats.requiredTotal).toBe(1);
  });

  it("aggregates location rollup across areas", () => {
    const rollup = computeDashboardLocationWeekRollup([
      {
        areaId: "a1",
        areaName: "A",
        assignedTotal: 2,
        requiredTotal: 4,
        openSlots: 2,
        understaffedWindowCount: 1,
        ampelLevel: "partial",
        gaugeVariant: "overstaffed",
        criticalWindowLabel: null,
        totalHours: 10,
        baseCost: 100,
        surchargeCost: 20,
        totalCost: 120,
        hasCompensation: true,
        currency: "EUR",
        hasAssignmentMismatch: false,
      },
      {
        areaId: "a2",
        areaName: "B",
        assignedTotal: 1,
        requiredTotal: 5,
        openSlots: 4,
        understaffedWindowCount: 2,
        ampelLevel: "critical",
        gaugeVariant: "understaffed",
        criticalWindowLabel: "Fr 18-22",
        totalHours: 8,
        baseCost: 80,
        surchargeCost: 10,
        totalCost: 90,
        hasCompensation: true,
        currency: "EUR",
        hasAssignmentMismatch: false,
      },
    ]);

    expect(rollup.openSlots).toBe(6);
    expect(rollup.criticalAreaCount).toBe(1);
    expect(rollup.totalCost).toBe(210);
  });
});

describe("sortDashboardAreaWeekStats", () => {
  it("sorts critical areas before met areas", () => {
    const sorted = sortDashboardAreaWeekStats([
      {
        areaId: "met",
        areaName: "Met",
        assignedTotal: 2,
        requiredTotal: 2,
        openSlots: 0,
        understaffedWindowCount: 0,
        ampelLevel: "met",
        gaugeVariant: "met",
        criticalWindowLabel: null,
        totalHours: 0,
        baseCost: 0,
        surchargeCost: 0,
        totalCost: 0,
        hasCompensation: false,
        currency: "EUR",
        hasAssignmentMismatch: false,
      },
      {
        areaId: "crit",
        areaName: "Crit",
        assignedTotal: 1,
        requiredTotal: 5,
        openSlots: 4,
        understaffedWindowCount: 2,
        ampelLevel: "critical",
        gaugeVariant: "understaffed",
        criticalWindowLabel: null,
        totalHours: 0,
        baseCost: 0,
        surchargeCost: 0,
        totalCost: 0,
        hasCompensation: false,
        currency: "EUR",
        hasAssignmentMismatch: false,
      },
    ]);

    expect(sorted[0].areaId).toBe("crit");
  });
});
