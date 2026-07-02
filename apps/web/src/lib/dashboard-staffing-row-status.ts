import {
  staffingWindowRowHasUnconfirmedPlannedCoverage,
  type DashboardStaffingWindowRow,
  type DashboardStaffingWindowRowStatus,
} from "@/lib/dashboard-area-week-stats";
import { listStaffingWindowConfirmationStatuses } from "@/lib/dashboard-day-confirmation-counts";
import {
  staffingRowShowsIssuesButton,
} from "@/lib/dashboard-staffing-window-issues";
import { cn } from "@/lib/cn";
import { isPastCalendarDate } from "@/lib/dates";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";

export type StaffingWindowRowDisplayLineKind =
  | "single"
  | "confirmed"
  | "planned"
  | "openSlots"
  | "windowIssues";

export type StaffingWindowRowDisplayLine = {
  kind: StaffingWindowRowDisplayLineKind;
  assigned: number;
  required: number;
};

export type FlattenStaffingWindowTableLinesOptions = {
  /** Mehrzeilen pro Status — nur wenn true; Standard ist eine Zeile pro Schichtfenster. */
  compactStaffingRows?: boolean;
  todayISO?: string;
  shiftConfirmationEnabled?: boolean;
  windowIssuesEnabled?: boolean;
};

export function staffingWindowRowOpenSlotCount(
  row: Pick<DashboardStaffingWindowRow, "rowKind" | "assigned" | "required">
): number {
  if (row.rowKind !== "staffing_window") return 0;
  return Math.max(0, row.required - row.assigned);
}

/** Offene Punkte (Bestätigung/Geplant) — nicht bloß Unterbesetzung mit Zuweisungslücke. */
export function staffingWindowRowShowsWindowIssuesAction(
  row: DashboardStaffingWindowRow,
  shiftConfirmationEnabled: boolean
): boolean {
  if (row.rowKind !== "staffing_window") return false;
  if (!shiftConfirmationEnabled) return false;
  if (row.status === "planned") return true;
  if (
    listStaffingWindowConfirmationStatuses(row.confirmationCounts).length > 0
  ) {
    return true;
  }
  if (
    row.status !== "understaffed" &&
    staffingWindowRowHasUnconfirmedPlannedCoverage(row)
  ) {
    return true;
  }
  return false;
}

function staffingWindowRowShouldSplitOpenSlotsAndWindowIssues(
  row: DashboardStaffingWindowRow,
  todayISO: string,
  shiftConfirmationEnabled: boolean,
  windowIssuesEnabled: boolean
): boolean {
  if (row.rowKind !== "staffing_window") return false;
  if (staffingWindowRowOpenSlotCount(row) === 0) return false;
  if (!staffingWindowRowShowsCandidatesButton(row, todayISO)) return false;
  if (
    !windowIssuesEnabled ||
    !staffingWindowRowShowsWindowIssuesAction(row, shiftConfirmationEnabled)
  ) {
    return false;
  }
  if (
    staffingWindowRowShowsOnlyOpenSlots(row, todayISO, shiftConfirmationEnabled)
  ) {
    return false;
  }
  return true;
}

/** Nur offene Stellen, keine weiteren offenen Punkte (Bestätigung, geplant, Konflikte). */
export function staffingWindowRowShowsOnlyOpenSlots(
  row: DashboardStaffingWindowRow,
  todayISO: string,
  shiftConfirmationEnabled: boolean
): boolean {
  if (row.rowKind !== "staffing_window") return false;
  if (!staffingWindowRowShowsCandidatesButton(row, todayISO)) return false;
  if (row.assigned > 0) return false;
  if ((row.staffingConflicts?.length ?? 0) > 0) return false;
  if ((row.staffingHints?.length ?? 0) > 0) return false;
  if (
    shiftConfirmationEnabled &&
    listStaffingWindowConfirmationStatuses(row.confirmationCounts).length > 0
  ) {
    return false;
  }
  return true;
}

/** Bestätigt + geplant getrennt, wenn beides gleichzeitig zur Deckung beiträgt. */
export function resolveStaffingWindowRowDisplayLines(
  row: DashboardStaffingWindowRow,
  options?: FlattenStaffingWindowTableLinesOptions
): StaffingWindowRowDisplayLine[] {
  if (row.rowKind !== "staffing_window") {
    return [{ kind: "single", assigned: row.assigned, required: row.required }];
  }

  if (options?.compactStaffingRows !== true) {
    return [{ kind: "single", assigned: row.assigned, required: row.required }];
  }

  const confirmed = row.confirmedAssigned ?? 0;
  const projected = row.assigned;
  const unconfirmed = projected - confirmed;

  const shouldSplitConfirmedPlanned =
    staffingWindowRowHasUnconfirmedPlannedCoverage(row) &&
    confirmed > 0 &&
    unconfirmed > 0;

  if (shouldSplitConfirmedPlanned) {
    return [
      { kind: "confirmed", assigned: confirmed, required: row.required },
      { kind: "planned", assigned: unconfirmed, required: row.required },
    ];
  }

  const todayISO = options.todayISO;
  if (
    todayISO &&
    options.windowIssuesEnabled &&
    options.shiftConfirmationEnabled !== undefined &&
    staffingWindowRowShouldSplitOpenSlotsAndWindowIssues(
      row,
      todayISO,
      options.shiftConfirmationEnabled,
      options.windowIssuesEnabled
    )
  ) {
    const openCount = staffingWindowRowOpenSlotCount(row);
    return [
      { kind: "openSlots", assigned: 0, required: openCount },
      {
        kind: "windowIssues",
        assigned: row.assigned,
        required: row.required,
      },
    ];
  }

  return [{ kind: "single", assigned: projected, required: row.required }];
}

/** Mindestens eine Zeile würde bei „Details pro Status“ in mehrere Status-Zeilen aufgeteilt. */
export function staffingWindowRowsHaveDetailsPerStatusSplit(
  rows: readonly DashboardStaffingWindowRow[],
  options: Omit<FlattenStaffingWindowTableLinesOptions, "compactStaffingRows">
): boolean {
  const splitOptions: FlattenStaffingWindowTableLinesOptions = {
    ...options,
    compactStaffingRows: true,
  };
  return rows.some(
    (row) => resolveStaffingWindowRowDisplayLines(row, splitOptions).length > 1
  );
}

export function staffingWindowRowShowsCandidatesButton(
  row: DashboardStaffingWindowRow,
  _todayISO: string
): boolean {
  return (
    row.rowKind === "staffing_window" &&
    staffingWindowRowOpenSlotCount(row) > 0
  );
}

export type StaffingWindowDisplayLineAction =
  | "candidates"
  | "staffingIssues"
  | "windowIssues";

export type StaffingWindowDisplayLineActions = {
  showCandidatesButton: boolean;
  showIssuesButton: boolean;
  showWindowIssuesButton: boolean;
};

export function staffingWindowShiftGroupKey(
  row: DashboardStaffingWindowRow
): string {
  if (row.rowKind === "no_service_hours") {
    return `no-service:${row.dateISO}`;
  }
  return `${row.dateISO}:${row.timeFrom}:${row.timeTo}:${row.shiftName}`;
}

export type StaffingWindowTableRenderLine = {
  row: DashboardStaffingWindowRow;
  line: StaffingWindowRowDisplayLine;
  /** Erste Zeile einer Schicht (Uhrzeit/Schicht sichtbar). */
  isFirstInShiftGroup: boolean;
  /** Wochentag nur einmal pro Kalendertag. */
  showDayLabel: boolean;
};

export function filterStaffingWindowRowsForWeekView(
  rows: readonly DashboardStaffingWindowRow[],
  todayISO: string,
  includePastDays: boolean
): DashboardStaffingWindowRow[] {
  if (includePastDays) return [...rows];
  return rows.filter((row) => !isPastCalendarDate(row.dateISO, todayISO));
}

/** Eine Tabellenzeile pro Status — Schicht-Gruppe mit leeren Folgezellen. */
export function flattenStaffingWindowTableLines(
  rows: readonly DashboardStaffingWindowRow[],
  options?: FlattenStaffingWindowTableLinesOptions
): StaffingWindowTableRenderLine[] {
  const flat: StaffingWindowTableRenderLine[] = [];
  let activeShiftGroupKey: string | null = null;
  const datesWithDayLabel = new Set<string>();

  for (const row of rows) {
    const groupKey = staffingWindowShiftGroupKey(row);
    const isNewShiftGroup = groupKey !== activeShiftGroupKey;
    if (isNewShiftGroup) {
      activeShiftGroupKey = groupKey;
    }

    const showDayForRow = !datesWithDayLabel.has(row.dateISO);

    if (row.rowKind === "no_service_hours") {
      const showDayLabel = showDayForRow;
      if (showDayLabel) {
        datesWithDayLabel.add(row.dateISO);
      }
      flat.push({
        row,
        line: {
          kind: "single",
          assigned: row.assigned,
          required: row.required,
        },
        isFirstInShiftGroup: true,
        showDayLabel,
      });
      continue;
    }

    const displayLines = resolveStaffingWindowRowDisplayLines(row, options);
    for (let lineIndex = 0; lineIndex < displayLines.length; lineIndex++) {
      const isFirstInShiftGroup = isNewShiftGroup && lineIndex === 0;
      const showDayLabel = showDayForRow && isFirstInShiftGroup;

      flat.push({
        row,
        line: displayLines[lineIndex]!,
        isFirstInShiftGroup,
        showDayLabel,
      });

      if (showDayLabel) {
        datesWithDayLabel.add(row.dateISO);
      }
    }
  }

  return flat;
}

/** Einzeilen-Modus: Kandidaten bei offenem Bedarf, sonst offene Punkte/Konflikte. */
export function resolveStaffingWindowRowCompactPrimaryAction(
  row: DashboardStaffingWindowRow,
  todayISO: string,
  shiftConfirmationEnabled: boolean,
  windowIssuesEnabled: boolean
): StaffingWindowDisplayLineAction | null {
  if (row.rowKind !== "staffing_window") return null;

  const staffingIssues =
    (row.staffingConflicts?.length ?? 0) > 0 ||
    (row.staffingHints?.length ?? 0) > 0;
  if (staffingIssues) return "staffingIssues";

  const hasOpenSlots =
    staffingWindowRowShowsCandidatesButton(row, todayISO) &&
    staffingWindowRowOpenSlotCount(row) > 0;
  const hasWindowIssues =
    windowIssuesEnabled &&
    staffingWindowRowShowsWindowIssuesAction(row, shiftConfirmationEnabled);

  if (hasOpenSlots && hasWindowIssues) {
    if (
      staffingWindowRowShowsOnlyOpenSlots(
        row,
        todayISO,
        shiftConfirmationEnabled
      )
    ) {
      return "candidates";
    }
    return "windowIssues";
  }
  if (hasOpenSlots) return "candidates";
  if (hasWindowIssues) return "windowIssues";

  return null;
}

export function staffingWindowDisplayLineHasOpenGap(
  line: StaffingWindowRowDisplayLine
): boolean {
  return line.required > line.assigned;
}

/** Tabellenzeile: Primäraktion oder Zuweisen, wenn die Anzeigezeile eine offene Lücke hat. */
export function resolveStaffingWindowTableRowAction(
  row: DashboardStaffingWindowRow,
  line: StaffingWindowRowDisplayLine,
  todayISO: string,
  shiftConfirmationEnabled: boolean,
  windowIssuesEnabled: boolean,
  options?: FlattenStaffingWindowTableLinesOptions
): StaffingWindowDisplayLineAction | null {
  const primary = resolveStaffingWindowDisplayLinePrimaryAction(
    row,
    line,
    todayISO,
    shiftConfirmationEnabled,
    windowIssuesEnabled,
    options
  );
  if (primary) return primary;

  const staffingIssues =
    (row.staffingConflicts?.length ?? 0) > 0 ||
    (row.staffingHints?.length ?? 0) > 0;
  if (staffingIssues) return null;

  if (
    row.rowKind === "staffing_window" &&
    staffingWindowDisplayLineHasOpenGap(line)
  ) {
    return "candidates";
  }

  return null;
}

export function resolveStaffingWindowDisplayLinePrimaryAction(
  row: DashboardStaffingWindowRow,
  line: StaffingWindowRowDisplayLine,
  todayISO: string,
  shiftConfirmationEnabled: boolean,
  windowIssuesEnabled: boolean,
  options?: FlattenStaffingWindowTableLinesOptions
): StaffingWindowDisplayLineAction | null {
  if (options?.compactStaffingRows !== true) {
    return resolveStaffingWindowRowCompactPrimaryAction(
      row,
      todayISO,
      shiftConfirmationEnabled,
      windowIssuesEnabled
    );
  }
  const actions = resolveStaffingWindowDisplayLineActions(
    row,
    line,
    todayISO,
    shiftConfirmationEnabled,
    windowIssuesEnabled
  );

  if (actions.showCandidatesButton) return "candidates";
  if (actions.showIssuesButton) return "staffingIssues";
  if (actions.showWindowIssuesButton) return "windowIssues";
  return null;
}

export function resolveStaffingWindowDisplayLineActions(
  row: DashboardStaffingWindowRow,
  line: StaffingWindowRowDisplayLine,
  todayISO: string,
  shiftConfirmationEnabled: boolean,
  windowIssuesEnabled: boolean
): StaffingWindowDisplayLineActions {
  const staffingIssues =
    (row.staffingConflicts?.length ?? 0) > 0 ||
    (row.staffingHints?.length ?? 0) > 0;

  if (line.kind === "openSlots") {
    return {
      showCandidatesButton: staffingWindowRowShowsCandidatesButton(
        row,
        todayISO
      ),
      showIssuesButton: false,
      showWindowIssuesButton: false,
    };
  }

  if (line.kind === "windowIssues") {
    return {
      showCandidatesButton: false,
      showIssuesButton: staffingIssues,
      showWindowIssuesButton:
        !staffingIssues &&
        windowIssuesEnabled &&
        staffingWindowRowShowsWindowIssuesAction(row, shiftConfirmationEnabled),
    };
  }

  if (line.kind === "confirmed") {
    return {
      showCandidatesButton: false,
      showIssuesButton: staffingIssues,
      showWindowIssuesButton: false,
    };
  }

  if (line.kind === "planned") {
    const showCandidatesButton = staffingWindowRowShowsCandidatesButton(
      row,
      todayISO
    );
    const showWindowIssuesButton =
      !showCandidatesButton &&
      !staffingIssues &&
      windowIssuesEnabled &&
      staffingWindowRowShowsWindowIssuesAction(row, shiftConfirmationEnabled);

    return {
      showCandidatesButton,
      showIssuesButton: staffingIssues,
      showWindowIssuesButton,
    };
  }

  const showCandidatesButton =
    staffingWindowRowShowsCandidatesButton(row, todayISO) &&
    staffingWindowRowOpenSlotCount(row) > 0;
  const showIssuesButton = !showCandidatesButton && staffingIssues;
  const showWindowIssuesButton =
    !showCandidatesButton &&
    !showIssuesButton &&
    windowIssuesEnabled &&
    staffingWindowRowShowsWindowIssuesAction(row, shiftConfirmationEnabled);

  return {
    showCandidatesButton,
    showIssuesButton,
    showWindowIssuesButton,
  };
}

export function staffingWindowDisplayLineCountClassName(
  row: DashboardStaffingWindowRow,
  line: StaffingWindowRowDisplayLine,
  isPastDay: boolean,
  shiftConfirmationEnabled: boolean
): string {
  if (line.kind === "confirmed") {
    return isPastDay
      ? "font-semibold text-emerald-950"
      : "font-semibold text-emerald-600";
  }

  if (line.kind === "planned" || line.kind === "windowIssues") {
    return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
  }

  if (line.kind === "openSlots") {
    return isPastDay
      ? "font-semibold text-red-950"
      : "font-semibold text-red-600";
  }

  if (staffingRowShowsIssuesButton(row, shiftConfirmationEnabled)) {
    return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
  }

  const status = row.status;
  if (isPastDay) {
    switch (status) {
      case "understaffed":
        return staffingWindowRowHasUnconfirmedPlannedCoverage(row)
          ? cn("font-semibold", STAFFING_OCHER_TEXT_CLASS)
          : "font-semibold text-red-950";
      case "planned":
      case "overstaffed":
        return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
      case "met":
        return "font-semibold text-emerald-950";
    }
  }

  switch (status) {
    case "understaffed":
      return staffingWindowRowHasUnconfirmedPlannedCoverage(row)
        ? cn("font-semibold", STAFFING_OCHER_TEXT_CLASS)
        : "font-semibold text-red-600";
    case "planned":
    case "overstaffed":
      return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
    case "met":
      return "font-semibold text-emerald-700";
  }

  return "font-semibold";
}

export function buildStaffingWindowRowDisplayLineBesetztTooltip(
  row: DashboardStaffingWindowRow,
  line: StaffingWindowRowDisplayLine,
  shiftConfirmationEnabled: boolean,
  t: (key: string, values?: Record<string, string | number>) => string
): string | null {
  if (row.rowKind !== "staffing_window") return null;

  if (line.kind === "confirmed") {
    return t("areaCalendar.staffingTooltipTotalConfirmed", {
      assigned: line.assigned,
      required: line.required,
      shiftTime: "",
    });
  }

  if (line.kind === "planned") {
    return t("areaCalendar.staffingTooltipTotalPlanned", {
      assigned: line.assigned,
      required: line.required,
      shiftTime: "",
    });
  }

  if (line.kind === "openSlots") {
    return t("dashboard.ampelStatusOpenSlots", { count: line.required });
  }

  if (line.kind === "windowIssues") {
    return buildStaffingWindowRowWindowIssuesTooltip(
      row,
      shiftConfirmationEnabled,
      t
    );
  }

  return buildStaffingWindowRowBesetztTooltip(row, shiftConfirmationEnabled, t);
}

function buildStaffingWindowRowWindowIssuesTooltip(
  row: DashboardStaffingWindowRow,
  shiftConfirmationEnabled: boolean,
  t: (key: string, values?: Record<string, string | number>) => string
): string | null {
  if (row.rowKind !== "staffing_window") return null;

  const lines: string[] = [];

  if (shiftConfirmationEnabled && row.confirmationCounts) {
    for (const status of listStaffingWindowConfirmationStatuses(
      row.confirmationCounts
    )) {
      const count = row.confirmationCounts[status] ?? 0;
      if (count > 0) {
        lines.push(`${count} ${t(shiftConfirmationStatusLabelKey(status))}`);
      }
    }
  }

  if (lines.length === 0 && row.status === "planned") {
    return t("areaCalendar.staffingTooltipTotalPlanned", {
      assigned: row.assigned,
      required: row.required,
      shiftTime: "",
    });
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

export function staffingWindowRowStatusLabelKey(
  status: DashboardStaffingWindowRowStatus
): string {
  switch (status) {
    case "understaffed":
      return "dashboard.areaAssignmentOverviewWindowStatusUnderstaffed";
    case "planned":
      return "dashboard.areaAssignmentOverviewWindowStatusPlanned";
    case "overstaffed":
      return "dashboard.areaAssignmentOverviewWindowStatusOverstaffed";
    case "met":
      return "dashboard.areaAssignmentOverviewWindowStatusMet";
  }
}

export function buildStaffingWindowRowBesetztTooltip(
  row: DashboardStaffingWindowRow,
  shiftConfirmationEnabled: boolean,
  t: (key: string, values?: Record<string, string | number>) => string
): string | null {
  if (row.rowKind !== "staffing_window") return null;

  const lines: string[] = [];
  const openCount = staffingWindowRowOpenSlotCount(row);

  if (row.status === "understaffed" && openCount > 0) {
    lines.push(t("dashboard.ampelStatusOpenSlots", { count: openCount }));
  } else {
    lines.push(t(staffingWindowRowStatusLabelKey(row.status)));
  }

  if (shiftConfirmationEnabled && row.confirmationCounts) {
    for (const status of listStaffingWindowConfirmationStatuses(
      row.confirmationCounts
    )) {
      const count = row.confirmationCounts[status] ?? 0;
      if (count > 0) {
        lines.push(`${count} ${t(shiftConfirmationStatusLabelKey(status))}`);
      }
    }
  }

  return lines.join("\n");
}
