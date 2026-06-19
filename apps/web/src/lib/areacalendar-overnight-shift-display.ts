import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  isPlanningOvernightShift,
  planningOvernightShiftEndDateISO,
} from "@/lib/planning-overnight-shift-display";

export {
  isPlanningOvernightShift as isAreaCalendarOvernightShift,
  planningOvernightShiftEndDateISO as areaCalendarOvernightShiftEndDateISO,
};

export type AreaCalendarOvernightSpan = {
  areaId: string;
  shift: AreaCalendarShiftCard;
  startDate: string;
  endDate: string;
  startDayIndex: number;
  endDayIndex: number;
};

export function isAreaCalendarOvernightSpanRenderable(
  shift: AreaCalendarShiftCard,
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

export function collectAreaCalendarOvernightSpansForArea(
  areaId: string,
  dates: readonly string[],
  shifts: readonly AreaCalendarShiftCard[]
): AreaCalendarOvernightSpan[] {
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const spans: AreaCalendarOvernightSpan[] = [];

  for (const shift of shifts) {
    if (areaId !== "" && shift.locationAreaId !== areaId) continue;
    if (areaId === "" && shift.locationAreaId) continue;
    if (!isAreaCalendarOvernightSpanRenderable(shift, dates)) continue;
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

export function collectAreaCalendarOvernightSpansByArea(
  areas: readonly { id: string }[],
  dates: readonly string[],
  shifts: readonly AreaCalendarShiftCard[]
): Map<string, AreaCalendarOvernightSpan[]> {
  const map = new Map<string, AreaCalendarOvernightSpan[]>();
  for (const area of areas) {
    const spans = collectAreaCalendarOvernightSpansForArea(area.id, dates, shifts);
    if (spans.length > 0) {
      map.set(area.id, spans);
    }
  }
  return map;
}

/** Schichten, die als Durchgangs-Karte über die Tagesgrenze gerendert werden. */
export function filterAreaCalendarShiftsForCellRendering(
  shifts: readonly AreaCalendarShiftCard[],
  dates: readonly string[]
): AreaCalendarShiftCard[] {
  return shifts.filter(
    (shift) => !isAreaCalendarOvernightSpanRenderable(shift, dates)
  );
}

export function areaCalendarOvernightAnchorShiftIds(
  shifts: readonly AreaCalendarShiftCard[],
  dates: readonly string[]
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const shift of shifts) {
    if (isAreaCalendarOvernightSpanRenderable(shift, dates)) {
      ids.add(shift.id);
    }
  }
  return ids;
}

export function resolveAreaCalendarOvernightSpanDisplayMode(
  span: Pick<AreaCalendarOvernightSpan, "startDate" | "endDate" | "areaId">,
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

function compareAreaCalendarShiftCardsForRowOrder(
  a: AreaCalendarShiftCard,
  b: AreaCalendarShiftCard
): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff = a.endTime.localeCompare(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

/** Zeilenindex der Nachtschicht in der sortierten Starttag-Liste (inkl. Anker). */
export function resolveAreaCalendarOvernightStartDayRowIndex(
  span: Pick<AreaCalendarOvernightSpan, "shift">,
  startDayShifts: readonly AreaCalendarShiftCard[]
): number {
  const sorted = [...startDayShifts].sort(compareAreaCalendarShiftCardsForRowOrder);
  const index = sorted.findIndex((shift) => shift.id === span.shift.id);
  return index >= 0 ? index : 0;
}

/**
 * Nachtschicht-Fortsetzungen, die am Endtag in derselben Zeile wie am Starttag enden.
 * Schlüssel = Zeilenindex, Wert = Schicht-ID (für Platzhalter).
 */
export function collectAreaCalendarIncomingOvernightTailRowsByIndex(
  areaId: string,
  dateISO: string,
  overnightSpans: readonly AreaCalendarOvernightSpan[],
  startDayShiftsForDate: (startDate: string) => readonly AreaCalendarShiftCard[]
): ReadonlyMap<number, string> {
  const rows = new Map<number, string>();

  for (const span of overnightSpans) {
    if (span.endDate !== dateISO) continue;
    if (span.startDate >= dateISO) continue;
    if (areaId !== "" && span.areaId !== areaId) continue;
    if (areaId === "" && span.areaId !== "") continue;

    const rowIndex = resolveAreaCalendarOvernightStartDayRowIndex(
      span,
      startDayShiftsForDate(span.startDate)
    );
    rows.set(rowIndex, span.shift.id);
  }

  return rows;
}

export type AreaCalendarCellShiftRow =
  | { kind: "shift"; shift: AreaCalendarShiftCard }
  | { kind: "overnight-anchor"; shiftId: string }
  | { kind: "overnight-tail-spacer"; shiftId: string }
  | { kind: "row-gap" };

/**
 * Vertikale Reihenfolge in einer Kalenderzelle: Same-Day-Schichten und Platzhalter
 * für Nachtschicht-Anker (Starttag) bzw. Fortsetzung (Endtag) ohne Überlappung.
 */
export function buildAreaCalendarCellShiftRows(
  shifts: readonly AreaCalendarShiftCard[],
  options?: {
    overnightAnchorShiftIds?: ReadonlySet<string>;
    incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
  }
): AreaCalendarCellShiftRow[] {
  const sortedShifts = [...shifts].sort(compareAreaCalendarShiftCardsForRowOrder);
  const incomingTailRows = options?.incomingOvernightTailRowsByIndex ?? new Map();
  const overnightAnchorShiftIds = options?.overnightAnchorShiftIds;

  let maxReservedRow = -1;
  for (const rowIndex of incomingTailRows.keys()) {
    maxReservedRow = Math.max(maxReservedRow, rowIndex);
  }

  const result: AreaCalendarCellShiftRow[] = [];
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

export function countAreaCalendarCellVisualRows(
  shifts: readonly AreaCalendarShiftCard[],
  options?: {
    overnightAnchorShiftIds?: ReadonlySet<string>;
    incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
  }
): number {
  return buildAreaCalendarCellShiftRows(shifts, options).length;
}
