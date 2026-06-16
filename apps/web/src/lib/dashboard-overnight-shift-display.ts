import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import {
  isPlanningOvernightShift,
  planningOvernightShiftEndDateISO,
} from "@/lib/planning-overnight-shift-display";

export {
  isPlanningOvernightShift as isDashboardOvernightShift,
  planningOvernightShiftEndDateISO as dashboardOvernightShiftEndDateISO,
};

export type DashboardOvernightSpan = {
  areaId: string;
  shift: DashboardShiftCard;
  startDate: string;
  endDate: string;
  startDayIndex: number;
  endDayIndex: number;
};

export function isDashboardOvernightSpanRenderable(
  shift: DashboardShiftCard,
  dates: readonly string[]
): boolean {
  if (!isPlanningOvernightShift(shift.startTime, shift.endTime)) return false;
  const dateSet = new Set(dates);
  if (!dateSet.has(shift.shift_date)) return false;
  const endDate = planningOvernightShiftEndDateISO(
    shift.shift_date,
    shift.startTime,
    shift.endTime
  );
  return dateSet.has(endDate);
}

export function collectDashboardOvernightSpansForArea(
  areaId: string,
  dates: readonly string[],
  shifts: readonly DashboardShiftCard[]
): DashboardOvernightSpan[] {
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const spans: DashboardOvernightSpan[] = [];

  for (const shift of shifts) {
    if (areaId !== "" && shift.locationAreaId !== areaId) continue;
    if (areaId === "" && shift.locationAreaId) continue;
    if (!isDashboardOvernightSpanRenderable(shift, dates)) continue;
    const endDate = planningOvernightShiftEndDateISO(
      shift.shift_date,
      shift.startTime,
      shift.endTime
    );
    spans.push({
      areaId,
      shift,
      startDate: shift.shift_date,
      endDate,
      startDayIndex: dateIndex.get(shift.shift_date)!,
      endDayIndex: dateIndex.get(endDate)!,
    });
  }

  return spans.sort((a, b) => {
    const startDiff = a.startDayIndex - b.startDayIndex;
    if (startDiff !== 0) return startDiff;
    return a.shift.startTime.localeCompare(b.shift.startTime);
  });
}

export function collectDashboardOvernightSpansByArea(
  areas: readonly { id: string }[],
  dates: readonly string[],
  shifts: readonly DashboardShiftCard[]
): Map<string, DashboardOvernightSpan[]> {
  const map = new Map<string, DashboardOvernightSpan[]>();
  for (const area of areas) {
    const spans = collectDashboardOvernightSpansForArea(area.id, dates, shifts);
    if (spans.length > 0) {
      map.set(area.id, spans);
    }
  }
  return map;
}

/** Schichten, die als Durchgangs-Karte über die Tagesgrenze gerendert werden. */
export function filterDashboardShiftsForCellRendering(
  shifts: readonly DashboardShiftCard[],
  dates: readonly string[]
): DashboardShiftCard[] {
  return shifts.filter(
    (shift) => !isDashboardOvernightSpanRenderable(shift, dates)
  );
}

export function dashboardOvernightAnchorShiftIds(
  shifts: readonly DashboardShiftCard[],
  dates: readonly string[]
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const shift of shifts) {
    if (isDashboardOvernightSpanRenderable(shift, dates)) {
      ids.add(shift.id);
    }
  }
  return ids;
}

export function resolveDashboardOvernightSpanDisplayMode(
  span: Pick<DashboardOvernightSpan, "startDate" | "endDate" | "areaId">,
  layoutActiveDayDates: ReadonlySet<string>,
  layoutActiveAreaIds: ReadonlySet<string>,
  options?: { forceAreaExpanded?: boolean }
): "expanded" | "collapsed" {
  if (!options?.forceAreaExpanded && !layoutActiveAreaIds.has(span.areaId)) {
    return "collapsed";
  }
  const startExpanded = layoutActiveDayDates.has(span.startDate);
  const endExpanded = layoutActiveDayDates.has(span.endDate);
  return startExpanded || endExpanded ? "expanded" : "collapsed";
}

function compareDashboardShiftCardsForRowOrder(
  a: DashboardShiftCard,
  b: DashboardShiftCard
): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff = a.endTime.localeCompare(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

/** Zeilenindex der Nachtschicht in der sortierten Starttag-Liste (inkl. Anker). */
export function resolveDashboardOvernightStartDayRowIndex(
  span: Pick<DashboardOvernightSpan, "shift">,
  startDayShifts: readonly DashboardShiftCard[]
): number {
  const sorted = [...startDayShifts].sort(compareDashboardShiftCardsForRowOrder);
  const index = sorted.findIndex((shift) => shift.id === span.shift.id);
  return index >= 0 ? index : 0;
}

/**
 * Nachtschicht-Fortsetzungen, die am Endtag in derselben Zeile wie am Starttag enden.
 * Schlüssel = Zeilenindex, Wert = Schicht-ID (für Platzhalter).
 */
export function collectDashboardIncomingOvernightTailRowsByIndex(
  areaId: string,
  dateISO: string,
  overnightSpans: readonly DashboardOvernightSpan[],
  startDayShiftsForDate: (startDate: string) => readonly DashboardShiftCard[]
): ReadonlyMap<number, string> {
  const rows = new Map<number, string>();

  for (const span of overnightSpans) {
    if (span.endDate !== dateISO) continue;
    if (span.startDate >= dateISO) continue;
    if (areaId !== "" && span.areaId !== areaId) continue;
    if (areaId === "" && span.areaId !== "") continue;

    const rowIndex = resolveDashboardOvernightStartDayRowIndex(
      span,
      startDayShiftsForDate(span.startDate)
    );
    rows.set(rowIndex, span.shift.id);
  }

  return rows;
}

export type DashboardCellShiftRow =
  | { kind: "shift"; shift: DashboardShiftCard }
  | { kind: "overnight-anchor"; shiftId: string }
  | { kind: "overnight-tail-spacer"; shiftId: string }
  | { kind: "row-gap" };

/**
 * Vertikale Reihenfolge in einer Kalenderzelle: Same-Day-Schichten und Platzhalter
 * für Nachtschicht-Anker (Starttag) bzw. Fortsetzung (Endtag) ohne Überlappung.
 */
export function buildDashboardCellShiftRows(
  shifts: readonly DashboardShiftCard[],
  options?: {
    overnightAnchorShiftIds?: ReadonlySet<string>;
    incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
  }
): DashboardCellShiftRow[] {
  const sortedShifts = [...shifts].sort(compareDashboardShiftCardsForRowOrder);
  const incomingTailRows = options?.incomingOvernightTailRowsByIndex ?? new Map();
  const overnightAnchorShiftIds = options?.overnightAnchorShiftIds;

  let maxReservedRow = -1;
  for (const rowIndex of incomingTailRows.keys()) {
    maxReservedRow = Math.max(maxReservedRow, rowIndex);
  }

  const result: DashboardCellShiftRow[] = [];
  let shiftIdx = 0;
  let row = 0;

  while (
    shiftIdx < sortedShifts.length ||
    (maxReservedRow >= 0 && row <= maxReservedRow)
  ) {
    const tailShiftId = incomingTailRows.get(row);
    if (tailShiftId !== undefined) {
      result.push({ kind: "overnight-tail-spacer", shiftId: tailShiftId });
    } else if (shiftIdx < sortedShifts.length) {
      const shift = sortedShifts[shiftIdx]!;
      shiftIdx += 1;
      if (overnightAnchorShiftIds?.has(shift.id)) {
        result.push({ kind: "overnight-anchor", shiftId: shift.id });
      } else {
        result.push({ kind: "shift", shift });
      }
    } else if (row <= maxReservedRow) {
      result.push({ kind: "row-gap" });
    } else {
      break;
    }
    row += 1;
  }

  return result;
}

export function countDashboardCellVisualRows(
  shifts: readonly DashboardShiftCard[],
  options?: {
    overnightAnchorShiftIds?: ReadonlySet<string>;
    incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
  }
): number {
  return buildDashboardCellShiftRows(shifts, options).length;
}
