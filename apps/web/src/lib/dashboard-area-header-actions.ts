import type {
  DashboardAreaAmpelLevel,
  DashboardStaffingWindowRow,
} from "@/lib/dashboard-area-week-stats";
import {
  findFirstPlannedStaffingWindowRow,
  findFirstRowWithConfirmationStatus,
  findFirstStaffingCandidatesRow,
} from "@/lib/dashboard-staffing-window-issues";
import { DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES } from "@/lib/dashboard-day-confirmation-counts";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export function isAreaStaffingUncovered(
  level: DashboardAreaAmpelLevel
): boolean {
  return level === "critical" || level === "partial";
}

/** Nur geplante Deckung ohne echte Unterbesetzung — kein „unbesetzt“, sondern Bestätigung ausstehend. */
export function isAreaStaffingPlannedOnly(input: {
  ampelLevel: DashboardAreaAmpelLevel;
  hasPlannedCoverage: boolean;
  hasUnderstaffed: boolean;
}): boolean {
  return (
    input.ampelLevel === "partial" &&
    input.hasPlannedCoverage &&
    !input.hasUnderstaffed
  );
}

/** Zusätzliche „Geplant“-Zeile im Wochen-Scope, wenn neben Lücken auch geplante Deckung existiert. */
export function shouldShowAreaCardPlannedCoverageStatusLine(input: {
  staffingScopeMode: "day" | "week";
  hasPlannedCoverage: boolean;
  plannedOnly: boolean;
}): boolean {
  return (
    input.staffingScopeMode === "week" &&
    input.hasPlannedCoverage &&
    !input.plannedOnly
  );
}

/**
 * Ampel-Status rechts oben im Bereichskarten-Header.
 * Lücken/Kritisch immer; „Gedeckt“ nur wenn Schichten im Scope existieren.
 */
export function shouldShowAreaCardStaffingAmpelStatus(input: {
  staffingEnabled: boolean;
  shiftCount: number;
  ampelLevel: DashboardAreaAmpelLevel;
}): boolean {
  if (!input.staffingEnabled) return false;
  if (isAreaStaffingUncovered(input.ampelLevel)) return true;
  return input.shiftCount > 0;
}

/** Klick auf „Noch unbesetzte Schichten“ im Bereichs-Header. */
export function isStaffingHeaderStatusClickable(input: {
  ampelLevel: DashboardAreaAmpelLevel;
  isPastScope: boolean;
  hasCandidatesPlanning: boolean;
  staffingWindowRows: readonly DashboardStaffingWindowRow[];
  todayISO: string;
}): boolean {
  return (
    isAreaStaffingUncovered(input.ampelLevel) &&
    !input.isPastScope &&
    input.hasCandidatesPlanning &&
    findFirstStaffingCandidatesRow(input.staffingWindowRows, input.todayISO) !==
      null
  );
}

/** Klick auf Bestätigungszeile im Bereichs-Header (z. B. „Ausstehende Anfragen“). */
export function canOpenConfirmationHeaderStatus(input: {
  windowIssuesEnabled: boolean;
  staffingWindowRows: readonly DashboardStaffingWindowRow[];
  status: (typeof DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES)[number];
}): boolean {
  return (
    input.windowIssuesEnabled &&
    findFirstRowWithConfirmationStatus(
      input.staffingWindowRows,
      input.status
    ) !== null
  );
}

/** Klick auf „Geplant“-Zeile im Wochen-Header → Offene Punkte für erste geplante Zeile. */
export function isPlannedCoverageHeaderStatusClickable(input: {
  windowIssuesEnabled: boolean;
  isPastScope: boolean;
  showPlannedCoverageStatusLine: boolean;
  staffingWindowRows: readonly DashboardStaffingWindowRow[];
  todayISO: string;
}): boolean {
  return (
    input.showPlannedCoverageStatusLine &&
    input.windowIssuesEnabled &&
    !input.isPastScope &&
    findFirstPlannedStaffingWindowRow(input.staffingWindowRows, input.todayISO) !==
      null
  );
}

/** Anzahl sichtbarer Header-Zeilen (für Scroll-Verhalten). */
export function countAreaHeaderStatusLines(input: {
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  confirmationConflictStatuses: readonly ShiftConfirmationStatus[];
  showStaffingIssuesButton: boolean;
  showPlannedCoverageStatusLine?: boolean;
}): number {
  let count = 0;
  if (input.staffingEnabled) count += 1;
  if (input.showPlannedCoverageStatusLine) count += 1;
  if (input.shiftConfirmationEnabled) {
    count += input.confirmationConflictStatuses.length;
  }
  if (input.showStaffingIssuesButton) count += 1;
  return count;
}
