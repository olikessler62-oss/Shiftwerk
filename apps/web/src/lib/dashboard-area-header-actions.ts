import type {
  DashboardAreaAmpelLevel,
  DashboardStaffingWindowRow,
} from "@/lib/dashboard-area-week-stats";
import {
  findFirstRowWithConfirmationStatus,
  findFirstStaffingCandidatesRow,
} from "@/lib/dashboard-staffing-window-issues";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export function isAreaStaffingUncovered(
  level: DashboardAreaAmpelLevel
): boolean {
  return level === "critical" || level === "partial";
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
  status: ShiftConfirmationStatus;
}): boolean {
  return (
    input.windowIssuesEnabled &&
    findFirstRowWithConfirmationStatus(
      input.staffingWindowRows,
      input.status
    ) !== null
  );
}

/** Anzahl sichtbarer Header-Zeilen (für Scroll-Verhalten). */
export function countAreaHeaderStatusLines(input: {
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  confirmationConflictStatuses: readonly ShiftConfirmationStatus[];
  showStaffingIssuesButton: boolean;
}): number {
  let count = 0;
  if (input.staffingEnabled) count += 1;
  if (input.shiftConfirmationEnabled) {
    count += input.confirmationConflictStatuses.length;
  }
  if (input.showStaffingIssuesButton) count += 1;
  return count;
}
