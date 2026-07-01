import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import {
  type DashboardDayConfirmationCounts,
  aggregateConfirmationCountsForDates,
} from "@/lib/dashboard-day-confirmation-counts";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { shiftConfirmationTooltipStatusTextClass } from "@/lib/shift-confirmation-display";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

export const DASHBOARD_AREA_STATUS_FOOTER_MAX_LINES = 8;

export type DashboardAreaStatusFooterLineId =
  | "open"
  | "proposed"
  | "requested"
  | "pending"
  | "rejected"
  | "canceled"
  | "swap_requested"
  | "unresolved";

export type DashboardAreaStatusFooterLine = {
  id: DashboardAreaStatusFooterLineId;
  count: number;
};

export const DASHBOARD_AREA_STATUS_FOOTER_CONFIRMATION_LINE_ORDER = [
  "proposed",
  "requested",
  "pending",
  "rejected",
  "canceled",
  "swap_requested",
  "unresolved",
] as const satisfies readonly Exclude<
  DashboardAreaStatusFooterLineId,
  "open"
>[];

/** Tausch-Anfragen — kein Bestätigungs-Status, Blau als Akzent. */
export const DASHBOARD_AREA_STATUS_FOOTER_SWAP_REQUESTED_TEXT_CLASS =
  "text-blue-600";

const DASHBOARD_AREA_STATUS_FOOTER_OPEN_TEXT_CLASS = "text-red-600";

export function dashboardAreaStatusFooterNumberClass(
  id: DashboardAreaStatusFooterLineId
): string {
  if (id === "open") {
    return DASHBOARD_AREA_STATUS_FOOTER_OPEN_TEXT_CLASS;
  }
  if (id === "swap_requested") {
    return DASHBOARD_AREA_STATUS_FOOTER_SWAP_REQUESTED_TEXT_CLASS;
  }
  return shiftConfirmationTooltipStatusTextClass(
    id satisfies ShiftConfirmationStatus
  );
}

export function countSwapRequestsForAreaDates(input: {
  swapRequests: readonly CommunicationSwapRequestRow[];
  shifts?: readonly Pick<PlanningShift, "id" | "location_area_id">[];
  areaId: string;
  dateISOs: readonly string[];
}): number {
  const dateSet = new Set(input.dateISOs);
  const shiftAreaById = new Map(
    (input.shifts ?? []).map((shift) => [shift.id, shift.location_area_id] as const)
  );

  let count = 0;
  for (const swap of input.swapRequests) {
    if (swap.status !== "pending") continue;
    if (!dateSet.has(swap.shiftDate)) continue;
    const areaId =
      swap.locationAreaId ?? shiftAreaById.get(swap.shiftId) ?? null;
    if (areaId !== input.areaId) continue;
    count += 1;
  }
  return count;
}

export function resolveDashboardAreaStatusFooterLines(input: {
  openSlots: number;
  shiftConfirmationEnabled: boolean;
  shiftCount: number;
  confirmationCounts: DashboardDayConfirmationCounts;
  swapRequestedCount: number;
}): DashboardAreaStatusFooterLine[] {
  const lines: DashboardAreaStatusFooterLine[] = [];

  if (input.openSlots > 0) {
    lines.push({ id: "open", count: input.openSlots });
  }

  if (input.shiftConfirmationEnabled && input.shiftCount > 0) {
    for (const id of DASHBOARD_AREA_STATUS_FOOTER_CONFIRMATION_LINE_ORDER) {
      if (id === "swap_requested") {
        if (input.swapRequestedCount > 0) {
          lines.push({ id, count: input.swapRequestedCount });
        }
        continue;
      }
      const count = input.confirmationCounts[id];
      if (count > 0) {
        lines.push({ id, count });
      }
    }
  } else if (input.swapRequestedCount > 0) {
    lines.push({ id: "swap_requested", count: input.swapRequestedCount });
  }

  return lines;
}

export function buildDashboardAreaStatusFooterLineData(input: {
  openSlots: number;
  shiftConfirmationEnabled: boolean;
  shiftCount: number;
  confirmationShifts: readonly PlanningShift[];
  swapRequests: readonly CommunicationSwapRequestRow[];
  areaId: string;
  dateISOs: readonly string[];
}): {
  confirmationCounts: DashboardDayConfirmationCounts;
  swapRequestedCount: number;
  lines: DashboardAreaStatusFooterLine[];
} {
  const confirmationCounts = aggregateConfirmationCountsForDates(
    input.confirmationShifts,
    input.dateISOs,
    input.areaId
  );
  const swapRequestedCount = countSwapRequestsForAreaDates({
    swapRequests: input.swapRequests,
    shifts: input.confirmationShifts,
    areaId: input.areaId,
    dateISOs: input.dateISOs,
  });

  return {
    confirmationCounts,
    swapRequestedCount,
    lines: resolveDashboardAreaStatusFooterLines({
      openSlots: input.openSlots,
      shiftConfirmationEnabled: input.shiftConfirmationEnabled,
      shiftCount: input.shiftCount,
      confirmationCounts,
      swapRequestedCount,
    }),
  };
}

export function countDashboardAreaStatusFooterLines(
  lines: readonly DashboardAreaStatusFooterLine[]
): number {
  return lines.length;
}

/** Zweispalten-Layout: bei ungerader Gesamtzahl zuerst rechte Spalte (zeilenweise). */
export function resolveDashboardAreaStatusFooterTwoColumnPlacement(
  index: number,
  total: number
): { row: number; column: 1 | 2 } {
  const row = Math.floor(index / 2) + 1;
  if (total % 2 === 1) {
    return { row, column: index % 2 === 0 ? 2 : 1 };
  }
  return { row, column: index % 2 === 0 ? 1 : 2 };
}

/** Gruppiert Stati zeilenweise für Zweispalten-Header (linker Status vor rechtem). */
export function groupDashboardAreaStatusFooterLinesForTwoColumnRows(
  lines: readonly DashboardAreaStatusFooterLine[]
): DashboardAreaStatusFooterLine[][] {
  if (lines.length === 0) return [];

  const rowCount = Math.ceil(lines.length / 2);
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowNumber = rowIndex + 1;
    return lines
      .map((line, index) => ({
        line,
        placement: resolveDashboardAreaStatusFooterTwoColumnPlacement(
          index,
          lines.length
        ),
      }))
      .filter(({ placement }) => placement.row === rowNumber)
      .sort((left, right) => left.placement.column - right.placement.column)
      .map(({ line }) => line);
  });
}
