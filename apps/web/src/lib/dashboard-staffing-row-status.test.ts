import { describe, expect, it } from "vitest";
import {
  buildStaffingWindowRowBesetztTooltip,
  staffingWindowRowStatusLabelKey,
} from "./dashboard-staffing-row-status";
import type { DashboardStaffingWindowRow } from "./dashboard-area-week-stats";

const baseRow: DashboardStaffingWindowRow = {
  rowKind: "staffing_window",
  dateISO: "2026-06-17",
  serviceHourId: "hour-1",
  weekdayLabel: "Di",
  timeFrom: "08:00",
  timeTo: "16:00",
  shiftName: "Früh",
  assigned: 1,
  required: 2,
  status: "understaffed",
};

describe("dashboard-staffing-row-status", () => {
  it("maps staffing window status to existing i18n keys", () => {
    expect(staffingWindowRowStatusLabelKey("understaffed")).toBe(
      "dashboard.areaAssignmentOverviewWindowStatusUnderstaffed"
    );
    expect(staffingWindowRowStatusLabelKey("planned")).toBe(
      "dashboard.areaAssignmentOverviewWindowStatusPlanned"
    );
  });

  it("builds besetzt tooltip with staffing status and confirmation counts", () => {
    const tooltip = buildStaffingWindowRowBesetztTooltip(
      {
        ...baseRow,
        confirmationCounts: { requested: +2, pending: 0 },
      },
      true,
      (key) =>
        ({
          "dashboard.areaAssignmentOverviewWindowStatusUnderstaffed":
            "Unterbesetzt",
          "shiftConfirmation.status.requested": "Angefragt",
        })[key] ?? key
    );

    expect(tooltip).toBe("Unterbesetzt\n2 Angefragt");
  });

  it("returns null for no-service-hours rows", () => {
    expect(
      buildStaffingWindowRowBesetztTooltip(
        { ...baseRow, rowKind: "no_service_hours" },
        true,
        () => "x"
      )
    ).toBeNull();
  });
});
