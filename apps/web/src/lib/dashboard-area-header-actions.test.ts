import { describe, expect, it } from "vitest";
import type { DashboardStaffingWindowRow } from "@/lib/dashboard-area-week-stats";
import {
  canOpenConfirmationHeaderStatus,
  countAreaHeaderStatusLines,
  isAreaStaffingUncovered,
  isStaffingHeaderStatusClickable,
} from "@/lib/dashboard-area-header-actions";

const todayISO = "2026-06-25";

function row(
  overrides: Partial<DashboardStaffingWindowRow> = {}
): DashboardStaffingWindowRow {
  return {
    rowKind: "staffing_window",
    dateISO: "2026-06-25",
    serviceHourId: "hour-1",
    weekdayLabel: "Mi",
    timeFrom: "11:00",
    timeTo: "15:00",
    shiftName: "Mittag",
    assigned: 1,
    required: 2,
    status: "understaffed",
    ...overrides,
  };
}

describe("isAreaStaffingUncovered", () => {
  it("treats critical and partial as uncovered", () => {
    expect(isAreaStaffingUncovered("critical")).toBe(true);
    expect(isAreaStaffingUncovered("partial")).toBe(true);
  });

  it("treats met and overstaffed as covered", () => {
    expect(isAreaStaffingUncovered("met")).toBe(false);
    expect(isAreaStaffingUncovered("overstaffed")).toBe(false);
  });
});

describe("isStaffingHeaderStatusClickable", () => {
  it("is clickable for future understaffed row with planning context", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "critical",
        isPastScope: false,
        hasCandidatesPlanning: true,
        staffingWindowRows: [row()],
        todayISO,
      })
    ).toBe(true);
  });

  it("is not clickable when area is covered", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "met",
        isPastScope: false,
        hasCandidatesPlanning: true,
        staffingWindowRows: [row()],
        todayISO,
      })
    ).toBe(false);
  });

  it("is not clickable in past scope", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "critical",
        isPastScope: true,
        hasCandidatesPlanning: true,
        staffingWindowRows: [row()],
        todayISO,
      })
    ).toBe(false);
  });

  it("is not clickable without candidates planning", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "critical",
        isPastScope: false,
        hasCandidatesPlanning: false,
        staffingWindowRows: [row()],
        todayISO,
      })
    ).toBe(false);
  });

  it("is not clickable when only past rows are understaffed", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "critical",
        isPastScope: false,
        hasCandidatesPlanning: true,
        staffingWindowRows: [
          row({ dateISO: "2026-06-20", status: "understaffed" }),
        ],
        todayISO,
      })
    ).toBe(false);
  });

  it("is clickable for planned (yellow) rows", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "partial",
        isPastScope: false,
        hasCandidatesPlanning: true,
        staffingWindowRows: [row({ status: "planned", assigned: 2, required: 2 })],
        todayISO,
      })
    ).toBe(true);
  });
});

describe("canOpenConfirmationHeaderStatus", () => {
  it("is true when window issues are enabled and status exists on a row", () => {
    expect(
      canOpenConfirmationHeaderStatus({
        windowIssuesEnabled: true,
        staffingWindowRows: [row({ confirmationCounts: { pending: 2 } })],
        status: "pending",
      })
    ).toBe(true);
  });

  it("is false when confirmation is disabled", () => {
    expect(
      canOpenConfirmationHeaderStatus({
        windowIssuesEnabled: false,
        staffingWindowRows: [row({ confirmationCounts: { pending: 1 } })],
        status: "pending",
      })
    ).toBe(false);
  });

  it("is false when no row has the requested status", () => {
    expect(
      canOpenConfirmationHeaderStatus({
        windowIssuesEnabled: true,
        staffingWindowRows: [row({ confirmationCounts: { rejected: 1 } })],
        status: "pending",
      })
    ).toBe(false);
  });
});

describe("countAreaHeaderStatusLines", () => {
  it("counts staffing line, confirmation lines, and assignment notes line", () => {
    expect(
      countAreaHeaderStatusLines({
        staffingEnabled: true,
        shiftConfirmationEnabled: true,
        confirmationConflictStatuses: ["pending", "rejected"],
        showStaffingIssuesButton: true,
      })
    ).toBe(4);
  });

  it("counts only staffing line when confirmation is off", () => {
    expect(
      countAreaHeaderStatusLines({
        staffingEnabled: true,
        shiftConfirmationEnabled: false,
        confirmationConflictStatuses: [],
        showStaffingIssuesButton: false,
      })
    ).toBe(1);
  });

  it("returns zero when staffing is disabled and no other lines apply", () => {
    expect(
      countAreaHeaderStatusLines({
        staffingEnabled: false,
        shiftConfirmationEnabled: false,
        confirmationConflictStatuses: [],
        showStaffingIssuesButton: false,
      })
    ).toBe(0);
  });
});
