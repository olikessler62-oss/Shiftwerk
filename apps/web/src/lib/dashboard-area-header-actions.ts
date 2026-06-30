import type {
  DashboardAreaAmpelLevel,
  DashboardAreaWeekStats,
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

export const DASHBOARD_STAFFING_HEADER_SEGMENT_ORDER = [
  "understaffed",
  "planned",
  "mismatch",
  "overstaffed",
  "met",
] as const;

export type DashboardStaffingHeaderSegmentKind =
  (typeof DASHBOARD_STAFFING_HEADER_SEGMENT_ORDER)[number];

export type DashboardStaffingHeaderSegment = {
  kind: DashboardStaffingHeaderSegmentKind;
  assigned: number;
  required: number;
};

export type DashboardStaffingHeaderDisplay = {
  segments: DashboardStaffingHeaderSegment[];
};

function pushDashboardStaffingHeaderSegment(
  segments: DashboardStaffingHeaderSegment[],
  kind: DashboardStaffingHeaderSegmentKind,
  assigned: number,
  required: number
): void {
  if (required <= 0) return;
  segments.push({ kind, assigned, required });
}

/** Besetzt/Bedarf im Bereichskarten-Header — je Status ein Wertepaar, mit Pipe verbunden. */
export function resolveDashboardStaffingHeaderDisplay(
  stats: Pick<
    DashboardAreaWeekStats,
    | "assignedTotal"
    | "requiredTotal"
    | "headerOpenAssignedTotal"
    | "headerOpenRequiredTotal"
    | "headerPlannedAssignedTotal"
    | "headerPlannedRequiredTotal"
    | "headerMismatchAssignedTotal"
    | "headerMismatchRequiredTotal"
    | "headerOverstaffedAssignedTotal"
    | "headerOverstaffedRequiredTotal"
    | "headerMetAssignedTotal"
    | "headerMetRequiredTotal"
  >
): DashboardStaffingHeaderDisplay {
  const segments: DashboardStaffingHeaderSegment[] = [];

  pushDashboardStaffingHeaderSegment(
    segments,
    "understaffed",
    stats.headerOpenAssignedTotal,
    stats.headerOpenRequiredTotal
  );
  pushDashboardStaffingHeaderSegment(
    segments,
    "planned",
    stats.headerPlannedAssignedTotal,
    stats.headerPlannedRequiredTotal
  );
  pushDashboardStaffingHeaderSegment(
    segments,
    "mismatch",
    stats.headerMismatchAssignedTotal,
    stats.headerMismatchRequiredTotal
  );
  pushDashboardStaffingHeaderSegment(
    segments,
    "overstaffed",
    stats.headerOverstaffedAssignedTotal,
    stats.headerOverstaffedRequiredTotal
  );
  pushDashboardStaffingHeaderSegment(
    segments,
    "met",
    stats.headerMetAssignedTotal,
    stats.headerMetRequiredTotal
  );

  if (segments.length > 0) {
    segments.sort(
      (left, right) =>
        DASHBOARD_STAFFING_HEADER_SEGMENT_ORDER.indexOf(left.kind) -
        DASHBOARD_STAFFING_HEADER_SEGMENT_ORDER.indexOf(right.kind)
    );
    return { segments };
  }

  return {
    segments: [
      {
        kind: "met",
        assigned: stats.assignedTotal,
        required: stats.requiredTotal,
      },
    ],
  };
}

export function shouldShowDashboardStaffingHeaderTooltip(
  segments: readonly DashboardStaffingHeaderSegment[]
): boolean {
  if (segments.length === 0) return false;
  if (segments.length > 1) return true;
  return segments[0]!.kind !== "met";
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
