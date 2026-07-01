import { describe, expect, it } from "vitest";
import type { DashboardStaffingWindowRow } from "@/lib/dashboard-area-week-stats";
import {
  canOpenConfirmationHeaderStatus,
  countAreaHeaderStatusLines,
  isAreaStaffingPlannedOnly,
  isAreaStaffingUncovered,
  isPlannedCoverageHeaderStatusClickable,
  isStaffingHeaderStatusClickable,
  resolveDashboardStaffingHeaderDisplay,
  resolveDashboardStaffingHeaderSegmentGaugeVariant,
  shouldShowDashboardStaffingHeaderTooltip,
  shouldShowAreaCardPlannedCoverageStatusLine,
  shouldShowAreaCardStaffingAmpelStatus,
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

describe("resolveDashboardStaffingHeaderDisplay", () => {
  const baseStats = {
    assignedTotal: 0,
    requiredTotal: 10,
    headerOpenAssignedTotal: 0,
    headerOpenRequiredTotal: 7,
    headerPlannedAssignedTotal: 4,
    headerPlannedRequiredTotal: 3,
    headerMismatchAssignedTotal: 0,
    headerMismatchRequiredTotal: 0,
    headerOverstaffedAssignedTotal: 0,
    headerOverstaffedRequiredTotal: 0,
    headerMetAssignedTotal: 0,
    headerMetRequiredTotal: 0,
  };

  it("returns ordered segments when open and planned windows coexist", () => {
    expect(resolveDashboardStaffingHeaderDisplay(baseStats)).toEqual({
      segments: [
        { kind: "understaffed", assigned: 0, required: 7 },
        { kind: "planned", assigned: 4, required: 3 },
      ],
    });
  });

  it("returns planned-only segment", () => {
    expect(
      resolveDashboardStaffingHeaderDisplay({
        ...baseStats,
        headerOpenRequiredTotal: 0,
      })
    ).toEqual({
      segments: [{ kind: "planned", assigned: 4, required: 3 }],
    });
  });

  it("returns open-only segment", () => {
    expect(
      resolveDashboardStaffingHeaderDisplay({
        ...baseStats,
        headerPlannedAssignedTotal: 0,
        headerPlannedRequiredTotal: 0,
      })
    ).toEqual({
      segments: [{ kind: "understaffed", assigned: 0, required: 7 }],
    });
  });

  it("appends further status segments in display order", () => {
    expect(
      resolveDashboardStaffingHeaderDisplay({
        ...baseStats,
        headerMetAssignedTotal: 2,
        headerMetRequiredTotal: 2,
      })
    ).toEqual({
      segments: [
        { kind: "understaffed", assigned: 0, required: 7 },
        { kind: "planned", assigned: 4, required: 3 },
        { kind: "met", assigned: 2, required: 2 },
      ],
    });
  });

  it("returns met 0/0 when there is no staffing demand", () => {
    expect(
      resolveDashboardStaffingHeaderDisplay({
        assignedTotal: 0,
        requiredTotal: 0,
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
      })
    ).toEqual({
      segments: [{ kind: "met", assigned: 0, required: 0 }],
    });
  });
});

describe("resolveDashboardStaffingHeaderSegmentGaugeVariant", () => {
  it("maps header segment kinds to gauge variants", () => {
    expect(resolveDashboardStaffingHeaderSegmentGaugeVariant("understaffed")).toBe(
      "understaffed"
    );
    expect(resolveDashboardStaffingHeaderSegmentGaugeVariant("planned")).toBe(
      "planned"
    );
    expect(resolveDashboardStaffingHeaderSegmentGaugeVariant("mismatch")).toBe(
      "overstaffed"
    );
    expect(resolveDashboardStaffingHeaderSegmentGaugeVariant("overstaffed")).toBe(
      "overstaffed"
    );
    expect(resolveDashboardStaffingHeaderSegmentGaugeVariant("met")).toBe("met");
  });
});

describe("shouldShowDashboardStaffingHeaderTooltip", () => {
  it("shows tooltip for multiple segments and single non-met segments", () => {
    expect(
      shouldShowDashboardStaffingHeaderTooltip([
        { kind: "understaffed", assigned: 0, required: 7 },
        { kind: "planned", assigned: 4, required: 3 },
      ])
    ).toBe(true);
    expect(
      shouldShowDashboardStaffingHeaderTooltip([
        { kind: "planned", assigned: 4, required: 3 },
      ])
    ).toBe(true);
  });

  it("hides tooltip for a single met segment", () => {
    expect(
      shouldShowDashboardStaffingHeaderTooltip([
        { kind: "met", assigned: 10, required: 10 },
      ])
    ).toBe(false);
  });
});

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

describe("isAreaStaffingPlannedOnly", () => {
  it("is true for partial ampel with planned coverage only", () => {
    expect(
      isAreaStaffingPlannedOnly({
        ampelLevel: "partial",
        hasPlannedCoverage: true,
        hasUnderstaffed: false,
      })
    ).toBe(true);
  });

  it("is false when understaffed windows exist", () => {
    expect(
      isAreaStaffingPlannedOnly({
        ampelLevel: "partial",
        hasPlannedCoverage: true,
        hasUnderstaffed: true,
      })
    ).toBe(false);
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

  it("is not clickable for planned-only rows (use window issues instead)", () => {
    expect(
      isStaffingHeaderStatusClickable({
        ampelLevel: "partial",
        isPastScope: false,
        hasCandidatesPlanning: true,
        staffingWindowRows: [row({ status: "planned", assigned: 2, required: 2 })],
        todayISO,
      })
    ).toBe(false);
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

describe("shouldShowAreaCardStaffingAmpelStatus", () => {
  it("shows uncovered levels even without planned shifts", () => {
    expect(
      shouldShowAreaCardStaffingAmpelStatus({
        staffingEnabled: true,
        shiftCount: 0,
        ampelLevel: "critical",
      })
    ).toBe(true);
    expect(
      shouldShowAreaCardStaffingAmpelStatus({
        staffingEnabled: true,
        shiftCount: 0,
        ampelLevel: "partial",
      })
    ).toBe(true);
  });

  it("hides covered-like levels when there are no shifts in scope", () => {
    expect(
      shouldShowAreaCardStaffingAmpelStatus({
        staffingEnabled: true,
        shiftCount: 0,
        ampelLevel: "met",
      })
    ).toBe(false);
    expect(
      shouldShowAreaCardStaffingAmpelStatus({
        staffingEnabled: true,
        shiftCount: 0,
        ampelLevel: "no_demand",
      })
    ).toBe(false);
  });

  it("shows covered-like levels when shifts exist in scope", () => {
    expect(
      shouldShowAreaCardStaffingAmpelStatus({
        staffingEnabled: true,
        shiftCount: 2,
        ampelLevel: "met",
      })
    ).toBe(true);
  });

  it("returns false when staffing is disabled", () => {
    expect(
      shouldShowAreaCardStaffingAmpelStatus({
        staffingEnabled: false,
        shiftCount: 3,
        ampelLevel: "critical",
      })
    ).toBe(false);
  });
});

describe("shouldShowAreaCardPlannedCoverageStatusLine", () => {
  it("shows in week scope when planned coverage coexists with gaps", () => {
    expect(
      shouldShowAreaCardPlannedCoverageStatusLine({
        staffingScopeMode: "week",
        hasPlannedCoverage: true,
        plannedOnly: false,
      })
    ).toBe(true);
  });

  it("hides in day scope", () => {
    expect(
      shouldShowAreaCardPlannedCoverageStatusLine({
        staffingScopeMode: "day",
        hasPlannedCoverage: true,
        plannedOnly: false,
      })
    ).toBe(false);
  });

  it("hides when only planned coverage exists", () => {
    expect(
      shouldShowAreaCardPlannedCoverageStatusLine({
        staffingScopeMode: "week",
        hasPlannedCoverage: true,
        plannedOnly: true,
      })
    ).toBe(false);
  });
});

describe("isPlannedCoverageHeaderStatusClickable", () => {
  it("is clickable when week planned line is shown and a future planned row exists", () => {
    expect(
      isPlannedCoverageHeaderStatusClickable({
        windowIssuesEnabled: true,
        isPastScope: false,
        showPlannedCoverageStatusLine: true,
        staffingWindowRows: [row({ status: "planned" })],
        todayISO,
      })
    ).toBe(true);
  });

  it("is not clickable without window issues", () => {
    expect(
      isPlannedCoverageHeaderStatusClickable({
        windowIssuesEnabled: false,
        isPastScope: false,
        showPlannedCoverageStatusLine: true,
        staffingWindowRows: [row({ status: "planned" })],
        todayISO,
      })
    ).toBe(false);
  });

  it("is not clickable when only past planned rows exist", () => {
    expect(
      isPlannedCoverageHeaderStatusClickable({
        windowIssuesEnabled: true,
        isPastScope: false,
        showPlannedCoverageStatusLine: true,
        staffingWindowRows: [
          row({ dateISO: "2026-06-20", status: "planned" }),
        ],
        todayISO,
      })
    ).toBe(false);
  });
});

describe("countAreaHeaderStatusLines", () => {
  it("counts status footer lines", () => {
    expect(
      countAreaHeaderStatusLines({
        statusFooterLines: [
          { id: "open", count: 2 },
          { id: "pending", count: 1 },
        ],
      })
    ).toBe(2);
  });

  it("returns zero for empty footer lines", () => {
    expect(
      countAreaHeaderStatusLines({
        statusFooterLines: [],
      })
    ).toBe(0);
  });
});
