import { describe, expect, it } from "vitest";
import {
  buildStaffingWindowRowBesetztTooltip,
  buildStaffingWindowRowDisplayLineBesetztTooltip,
  filterStaffingWindowRowsForWeekView,
  flattenStaffingWindowTableLines,
  resolveStaffingWindowDisplayLineActions,
  resolveStaffingWindowDisplayLinePrimaryAction,
  resolveStaffingWindowRowCompactPrimaryAction,
  resolveStaffingWindowRowDisplayLines,
  staffingWindowRowsHaveDetailsPerStatusSplit,
  staffingWindowDisplayLineCountClassName,
  staffingWindowRowShowsOnlyOpenSlots,
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

  it("builds besetzt tooltip with open slot count and confirmation counts", () => {
    const tooltip = buildStaffingWindowRowBesetztTooltip(
      {
        ...baseRow,
        confirmationCounts: { requested: 2, pending: 0 },
      },
      true,
      (key, values) =>
        ({
          "dashboard.ampelStatusOpenSlots": `${values?.count} offen`,
          "shiftConfirmation.status.requested": "Angefragt",
        })[key] ?? key
    );

    expect(tooltip).toBe("1 offen\n2 Angefragt");
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

  it("splits confirmed and planned coverage into separate display lines", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 2,
      required: 2,
      status: "planned",
      confirmedAssigned: 1,
    };

    expect(resolveStaffingWindowRowDisplayLines(row)).toEqual([
      { kind: "single", assigned: 2, required: 2 },
    ]);
    expect(
      resolveStaffingWindowRowDisplayLines(row, { compactStaffingRows: true })
    ).toEqual([
      { kind: "confirmed", assigned: 1, required: 2 },
      { kind: "planned", assigned: 1, required: 2 },
    ]);
  });

  it("keeps a single line when only planned coverage exists", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmedAssigned: 0,
    };

    expect(resolveStaffingWindowRowDisplayLines(row)).toEqual([
      { kind: "single", assigned: 1, required: 2 },
    ]);
  });

  const splitContextOptions = {
    todayISO: "2026-06-17",
    shiftConfirmationEnabled: true,
    windowIssuesEnabled: true,
    compactStaffingRows: true,
  };

  it("splits open slots and window issues into two lines when details per status is on", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmedAssigned: 0,
      confirmationCounts: { pending: 1 },
    };

    expect(
      resolveStaffingWindowRowDisplayLines(row, splitContextOptions)
    ).toEqual([
      { kind: "openSlots", assigned: 0, required: 1 },
      { kind: "windowIssues", assigned: 1, required: 2 },
    ]);

    const lines = resolveStaffingWindowRowDisplayLines(row, splitContextOptions);
    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        lines[0]!,
        "2026-06-17",
        true,
        true,
        splitContextOptions
      )
    ).toBe("candidates");
    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        lines[1]!,
        "2026-06-17",
        true,
        true,
        splitContextOptions
      )
    ).toBe("windowIssues");
  });

  it("keeps a single line for open slots and window issues when details per status is off", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmationCounts: { pending: 1 },
    };

    expect(
      resolveStaffingWindowRowDisplayLines(row, {
        todayISO: "2026-06-17",
        shiftConfirmationEnabled: true,
        windowIssuesEnabled: true,
        compactStaffingRows: false,
      })
    ).toEqual([{ kind: "single", assigned: 1, required: 2 }]);

    const flat = flattenStaffingWindowTableLines([row], {
      todayISO: "2026-06-17",
      shiftConfirmationEnabled: true,
      windowIssuesEnabled: true,
      compactStaffingRows: false,
    });

    expect(flat).toHaveLength(1);
    expect(flat[0]?.line.kind).toBe("single");
    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        flat[0]!.line,
        "2026-06-17",
        true,
        true,
        { compactStaffingRows: false }
      )
    ).toBe("windowIssues");
  });

  it("shows candidates in single-row mode for partial understaffing without window issues", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmedAssigned: 0,
    };

    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        { kind: "single", assigned: 1, required: 2 },
        "2026-06-17",
        true,
        true,
        { compactStaffingRows: false }
      )
    ).toBe("candidates");
  });

  it("flattens open slots and window issues with details per status on", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmationCounts: { pending: 1 },
    };

    const flat = flattenStaffingWindowTableLines([row], splitContextOptions);

    expect(flat).toHaveLength(2);
    expect(flat[0]?.line.kind).toBe("openSlots");
    expect(flat[1]?.line.kind).toBe("windowIssues");
    expect(flat[0]?.isFirstInShiftGroup).toBe(true);
    expect(flat[1]?.isFirstInShiftGroup).toBe(false);
  });

  it("builds per-line tooltips for open slots and window issues split", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmationCounts: { pending: 1 },
    };
    const lines = resolveStaffingWindowRowDisplayLines(row, splitContextOptions);
    const t = (key: string, values?: Record<string, string | number>) =>
      key === "dashboard.ampelStatusOpenSlots"
        ? `${values?.count} offen`
        : key === "shiftConfirmation.status.pending"
          ? "Ausstehend"
          : key;

    expect(
      buildStaffingWindowRowDisplayLineBesetztTooltip(
        row,
        lines[0]!,
        true,
        t
      )
    ).toBe("1 offen");
    expect(
      buildStaffingWindowRowDisplayLineBesetztTooltip(
        row,
        lines[1]!,
        true,
        t
      )
    ).toBe("1 Ausstehend");
  });

  it("colors confirmed and planned display lines separately", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 2,
      required: 2,
      status: "planned",
      confirmedAssigned: 1,
    };
    const lines = resolveStaffingWindowRowDisplayLines(row, {
      compactStaffingRows: true,
    });

    expect(
      staffingWindowDisplayLineCountClassName(
        row,
        lines[0]!,
        false,
        true
      )
    ).toContain("emerald");
    expect(
      staffingWindowDisplayLineCountClassName(row, lines[1]!, false, true)
    ).toContain("text-[#784e00]");
  });

  it("shows window issues on the planned sub-line only", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 2,
      required: 2,
      status: "planned",
      confirmedAssigned: 1,
    };
    const lines = resolveStaffingWindowRowDisplayLines(row, {
      compactStaffingRows: true,
    });

    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        lines[0]!,
        "2026-06-17",
        true,
        true,
        { compactStaffingRows: true }
      )
    ).toBeNull();
    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        lines[1]!,
        "2026-06-17",
        true,
        true,
        { compactStaffingRows: true }
      )
    ).toBe("windowIssues");
  });

  it("returns only one primary action per display line", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      status: "understaffed",
      staffingConflicts: [
        {
          id: "c1",
          kind: "qualification_mismatch",
          dateISO: "2026-06-17",
          weekdayLabel: "Di",
          timeLabel: "08:00",
          message: "Konflikt",
        },
      ],
    };

    expect(
      resolveStaffingWindowDisplayLinePrimaryAction(
        row,
        { kind: "single", assigned: 1, required: 2 },
        "2026-06-17",
        true,
        true,
        { compactStaffingRows: true }
      )
    ).toBe("candidates");
  });

  it("flattens split statuses with empty follow-up cells for the same shift", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 2,
      required: 2,
      status: "planned",
      confirmedAssigned: 1,
    };

    const flat = flattenStaffingWindowTableLines([row], {
      compactStaffingRows: true,
    });

    expect(flat).toHaveLength(2);
    expect(flat[0]?.isFirstInShiftGroup).toBe(true);
    expect(flat[1]?.isFirstInShiftGroup).toBe(false);
    expect(flat[0]?.line.kind).toBe("confirmed");
    expect(flat[1]?.line.kind).toBe("planned");
  });

  it("groups consecutive rows for the same shift into one block", () => {
    const rowA: DashboardStaffingWindowRow = {
      ...baseRow,
      serviceHourId: "hour-a",
      assigned: 2,
      required: 2,
      status: "met",
      confirmedAssigned: 2,
    };
    const rowB: DashboardStaffingWindowRow = {
      ...baseRow,
      serviceHourId: "hour-b",
      assigned: 1,
      required: 2,
      status: "met",
      confirmedAssigned: 1,
    };

    const flat = flattenStaffingWindowTableLines([rowA, rowB], {
      compactStaffingRows: true,
    });

    expect(flat).toHaveLength(2);
    expect(flat[0]?.isFirstInShiftGroup).toBe(true);
    expect(flat[1]?.isFirstInShiftGroup).toBe(false);
  });

  it("builds per-line besetzt tooltips for split rows", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 2,
      required: 2,
      status: "planned",
      confirmedAssigned: 1,
    };
    const lines = resolveStaffingWindowRowDisplayLines(row, {
      compactStaffingRows: true,
    });
    const t = (key: string, values?: Record<string, string | number>) =>
      `${key}:${values?.assigned}/${values?.required}`;

    expect(
      buildStaffingWindowRowDisplayLineBesetztTooltip(
        row,
        lines[0]!,
        true,
        t
      )
    ).toBe("areaCalendar.staffingTooltipTotalConfirmed:1/2");
    expect(
      buildStaffingWindowRowDisplayLineBesetztTooltip(
        row,
        lines[1]!,
        true,
        t
      )
    ).toBe("areaCalendar.staffingTooltipTotalPlanned:1/2");
  });

  it("uses candidates in single-row mode for any understaffed open gap", () => {
    const emptyRow: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 0,
      required: 2,
      status: "understaffed",
      confirmedAssigned: 0,
    };
    const partialRow: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmedAssigned: 0,
    };

    expect(staffingWindowRowShowsOnlyOpenSlots(emptyRow, "2026-06-17", true)).toBe(
      true
    );
    expect(
      resolveStaffingWindowRowCompactPrimaryAction(emptyRow, "2026-06-17", true, true)
    ).toBe("candidates");
    expect(
      resolveStaffingWindowRowCompactPrimaryAction(partialRow, "2026-06-17", true, true)
    ).toBe("candidates");
  });

  it("uses window issues in single-row mode when planned coverage exists", () => {
    const row: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 2,
      required: 2,
      status: "planned",
      confirmedAssigned: 1,
    };

    expect(staffingWindowRowShowsOnlyOpenSlots(row, "2026-06-17", true)).toBe(
      false
    );
    expect(
      resolveStaffingWindowRowCompactPrimaryAction(row, "2026-06-17", true, true)
    ).toBe("windowIssues");
  });

  it("detects when any row supports details-per-status split", () => {
    const splitContext = {
      todayISO: "2026-06-17",
      shiftConfirmationEnabled: true,
      windowIssuesEnabled: true,
    };
    const multiStatusRow: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmationCounts: { pending: 1 },
    };
    const singleStatusRow: DashboardStaffingWindowRow = {
      ...baseRow,
      assigned: 1,
      required: 2,
      status: "understaffed",
      confirmedAssigned: 0,
    };

    expect(
      staffingWindowRowsHaveDetailsPerStatusSplit([multiStatusRow], splitContext)
    ).toBe(true);
    expect(
      staffingWindowRowsHaveDetailsPerStatusSplit(
        [singleStatusRow],
        splitContext
      )
    ).toBe(false);
    expect(
      staffingWindowRowsHaveDetailsPerStatusSplit(
        [singleStatusRow, multiStatusRow],
        splitContext
      )
    ).toBe(true);
  });

  it("filters past days from week view when includePastDays is false", () => {
    const rows: DashboardStaffingWindowRow[] = [
      { ...baseRow, dateISO: "2026-06-15", weekdayLabel: "Mo" },
      { ...baseRow, dateISO: "2026-06-17", weekdayLabel: "Mi" },
    ];

    expect(
      filterStaffingWindowRowsForWeekView(rows, "2026-06-17", false)
    ).toEqual([rows[1]]);
    expect(
      filterStaffingWindowRowsForWeekView(rows, "2026-06-17", true)
    ).toEqual(rows);
  });
});
