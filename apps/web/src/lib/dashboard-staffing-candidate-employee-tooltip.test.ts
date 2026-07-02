import { describe, expect, it } from "vitest";
import {
  assignmentDurationHoursFromTimestamps,
  appendAssignmentTimeDurationSuffix,
  formatAssignmentProjectedWeeklyHoursLine,
  formatAssignmentDurationTooltipLine,
  formatDashboardStaffingCandidateEmployeeTooltipSections,
} from "./dashboard-staffing-candidate-employee-tooltip";
import type { DashboardStaffingCandidateEmployeeTooltipPayload } from "./dashboard-staffing-candidate-employee-tooltip";

const basePayload: DashboardStaffingCandidateEmployeeTooltipPayload = {
  schedulable: true,
  isActive: true,
  absenceType: null,
  availability: [],
  qualificationIds: [],
  shiftPreferences: [],
  locations: [],
  areas: [],
  adjacentAssignments: {
    lastPast: null,
    nextFuture: null,
  },
};

const labels = {
  anyDay: "Beliebig",
  noTime: "Keine Zeit",
  emptyPlacement: "—",
  noAbsence: "Keine",
  emptyAvailability: "—",
  emptyQualifications: "—",
  absenceType: () => "Krank",
};

describe("dashboard-staffing-candidate-employee-tooltip", () => {
  it("derives assignment duration from timestamps", () => {
    expect(
      assignmentDurationHoursFromTimestamps(
        "2026-06-30T07:00:00.000Z",
        "2026-06-30T11:00:00.000Z"
      )
    ).toBe(4);
  });

  it("formats assignment duration without weekly projection", () => {
    expect(formatAssignmentDurationTooltipLine(4, "de")).toBe("4 Std");
    expect(formatAssignmentDurationTooltipLine(4.5, "en")).toBe("4.5 h");
  });

  it("appends duration behind assignment time", () => {
    expect(appendAssignmentTimeDurationSuffix("09:00–17:00", 4, "de")).toBe(
      "09:00–17:00 (4 Std)"
    );
    expect(appendAssignmentTimeDurationSuffix("09:00–17:00", 0, "de")).toBe(
      "09:00–17:00"
    );
  });

  it("formats projected weekly hours line for next assignment", () => {
    expect(
      formatAssignmentProjectedWeeklyHoursLine(4, 28, 40, {
        lineLabel: (projected, target) =>
          `Wochen-Std: (inkl.) ${projected}/${target}`,
      })
    ).toBe("Wochen-Std: (inkl.) 32/40");
  });

  it("includes duration metadata on assignment sections", () => {
    const sections = formatDashboardStaffingCandidateEmployeeTooltipSections(
      {
        ...basePayload,
        adjacentAssignments: {
          lastPast: {
            shiftDate: "2026-06-28",
            locationName: "Restaurant",
            areaName: null,
            templateName: "Früh",
            startsAt: "2026-06-28T06:00:00.000Z",
            endsAt: "2026-06-28T10:00:00.000Z",
          },
          nextFuture: {
            shiftDate: "2026-07-02",
            locationName: "Restaurant",
            areaName: null,
            templateName: "Spät",
            startsAt: "2026-07-02T16:00:00.000Z",
            endsAt: "2026-07-02T20:00:00.000Z",
          },
        },
      },
      {
        locale: "de",
        qualifications: [],
        locations: [],
        areas: [],
        todayISO: "2026-06-30",
        weeklyHoursWeekDates: ["2026-06-30", "2026-07-01", "2026-07-02"],
        labels,
      }
    );

    expect(sections.lastPastAssignment?.durationHours).toBe(4);
    expect(sections.lastPastAssignment?.showProjectedWeeklyHours).toBe(false);
    expect(sections.nextFutureAssignment?.durationHours).toBe(4);
    expect(sections.nextFutureAssignment?.showProjectedWeeklyHours).toBe(true);
  });

  it("skips weekly projection when next assignment is outside planning week", () => {
    const sections = formatDashboardStaffingCandidateEmployeeTooltipSections(
      {
        ...basePayload,
        adjacentAssignments: {
          lastPast: null,
          nextFuture: {
            shiftDate: "2026-07-10",
            locationName: "Restaurant",
            areaName: null,
            templateName: "Spät",
            startsAt: "2026-07-10T16:00:00.000Z",
            endsAt: "2026-07-10T20:00:00.000Z",
          },
        },
      },
      {
        locale: "de",
        qualifications: [],
        locations: [],
        areas: [],
        todayISO: "2026-06-30",
        weeklyHoursWeekDates: ["2026-06-30", "2026-07-01", "2026-07-02"],
        labels,
      }
    );

    expect(sections.nextFutureAssignment?.showProjectedWeeklyHours).toBe(false);
  });
});
