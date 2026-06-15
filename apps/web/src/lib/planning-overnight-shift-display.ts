import { parseISODate, toISODate } from "@/lib/dates";
import { parseClockTimeToMinutes } from "@/lib/shift-card-time-gradient";
import type { PlanningShift } from "@/lib/planning-shift-card";

export type PlanningShiftDisplayPart = "full" | "overnight-start" | "overnight-end";

export type PlanningShiftDisplaySegment = {
  shift: PlanningShift;
  part: PlanningShiftDisplayPart;
};

export function isPlanningOvernightShift(
  startTime: string,
  endTime: string
): boolean {
  return parseClockTimeToMinutes(endTime) <= parseClockTimeToMinutes(startTime);
}

export function planningOvernightShiftEndDateISO(
  shiftDate: string,
  startTime: string,
  endTime: string
): string {
  if (!isPlanningOvernightShift(startTime, endTime)) return shiftDate;
  const next = parseISODate(shiftDate);
  next.setDate(next.getDate() + 1);
  return toISODate(next);
}

function pushSegment(
  map: Map<string, PlanningShiftDisplaySegment[]>,
  key: string,
  segment: PlanningShiftDisplaySegment
) {
  const list = map.get(key) ?? [];
  list.push(segment);
  map.set(key, list);
}

const PART_SORT_ORDER: Record<PlanningShiftDisplayPart, number> = {
  "overnight-end": 0,
  full: 1,
  "overnight-start": 2,
};

export function comparePlanningShiftDisplaySegments(
  a: PlanningShiftDisplaySegment,
  b: PlanningShiftDisplaySegment
): number {
  const partDiff = PART_SORT_ORDER[a.part] - PART_SORT_ORDER[b.part];
  if (partDiff !== 0) return partDiff;
  const startDiff = a.shift.startTime.localeCompare(b.shift.startTime);
  if (startDiff !== 0) return startDiff;
  return a.shift.id.localeCompare(b.shift.id);
}

/** Kalenderzellen inkl. Fortsetzung/Nachtschicht am Folgetag. */
export function buildPlanningShiftsByCellDisplay(
  dates: readonly string[],
  shifts: readonly PlanningShift[]
): Map<string, PlanningShiftDisplaySegment[]> {
  const dateSet = new Set(dates);
  const map = new Map<string, PlanningShiftDisplaySegment[]>();

  for (const shift of shifts) {
    const startKey = `${shift.employee_id}:${shift.shift_date}`;
    if (isPlanningOvernightShift(shift.startTime, shift.endTime)) {
      pushSegment(map, startKey, { shift, part: "overnight-start" });
      const endDate = planningOvernightShiftEndDateISO(
        shift.shift_date,
        shift.startTime,
        shift.endTime
      );
      if (dateSet.has(endDate)) {
        pushSegment(map, `${shift.employee_id}:${endDate}`, {
          shift,
          part: "overnight-end",
        });
      }
    } else {
      pushSegment(map, startKey, { shift, part: "full" });
    }
  }

  for (const list of map.values()) {
    list.sort(comparePlanningShiftDisplaySegments);
  }
  return map;
}

/** Maximal halbe Zellbreite für geteilte Nachtschicht-Hälften (aufgeklappt). */
export function planningShiftSegmentMaxWidthPx(
  layoutWidthPx: number,
  part: PlanningShiftDisplayPart
): number {
  if (part === "full") return layoutWidthPx;
  return layoutWidthPx / 2;
}

/** Eingeklappt: Nachtschicht-Hälften ein Viertel der Standard-Balkenbreite (zwei Mal halbiert). */
export const PLANNING_OVERNIGHT_COLLAPSED_WIDTH_FACTOR = 0.25;

export function planningCollapsedOvernightSegmentWidthPx(
  baseWidthPx: number,
  layoutWidthPx: number,
  part: PlanningShiftDisplayPart
): number {
  const cappedWidthPx = Math.min(
    baseWidthPx,
    planningShiftSegmentMaxWidthPx(layoutWidthPx, part)
  );
  if (part === "full") return cappedWidthPx;
  return Math.max(1, cappedWidthPx * PLANNING_OVERNIGHT_COLLAPSED_WIDTH_FACTOR);
}

export function planningShiftSegmentAlignTimeRight(
  part: PlanningShiftDisplayPart
): boolean {
  return part === "overnight-start";
}

export function planningShiftSegmentShowsEmployeeStrip(
  part: PlanningShiftDisplayPart
): boolean {
  return part !== "overnight-end";
}

export function planningShiftSegmentTouchesDayBorder(
  part: PlanningShiftDisplayPart
): boolean {
  return part === "overnight-start" || part === "overnight-end";
}

export type PlanningOvernightSpan = {
  shift: PlanningShift;
  startDate: string;
  endDate: string;
  startDayIndex: number;
  endDayIndex: number;
};

export function isPlanningOvernightSpanRenderable(
  shift: PlanningShift,
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

export function collectPlanningOvernightSpansForEmployee(
  employeeId: string,
  dates: readonly string[],
  shifts: readonly PlanningShift[]
): PlanningOvernightSpan[] {
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const spans: PlanningOvernightSpan[] = [];

  for (const shift of shifts) {
    if (shift.employee_id !== employeeId) continue;
    if (!isPlanningOvernightSpanRenderable(shift, dates)) continue;
    const endDate = planningOvernightShiftEndDateISO(
      shift.shift_date,
      shift.startTime,
      shift.endTime
    );
    spans.push({
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

export function collectPlanningOvernightSpansByEmployee(
  employees: readonly { id: string }[],
  dates: readonly string[],
  shifts: readonly PlanningShift[]
): Map<string, PlanningOvernightSpan[]> {
  const map = new Map<string, PlanningOvernightSpan[]>();
  for (const employee of employees) {
    const spans = collectPlanningOvernightSpansForEmployee(
      employee.id,
      dates,
      shifts
    );
    if (spans.length > 0) {
      map.set(employee.id, spans);
    }
  }
  return map;
}

/** Zell-Inhalt ohne Nachtschicht-Segmente, wenn diese als Durchgangs-Karte gerendert werden. */
export function filterPlanningCellSegmentsForRendering(
  segments: readonly PlanningShiftDisplaySegment[],
  dates: readonly string[]
): PlanningShiftDisplaySegment[] {
  return segments.filter((segment) => {
    if (segment.part === "full") return true;
    return !isPlanningOvernightSpanRenderable(segment.shift, dates);
  });
}

export function planningCellTouchesOvernightSpan(
  employeeId: string,
  date: string,
  spans: readonly PlanningOvernightSpan[]
): boolean {
  return spans.some(
    (span) => span.startDate === date || span.endDate === date
  );
}

export function resolveOvernightSpanDisplayMode(
  span: PlanningOvernightSpan,
  layoutActiveDayDates: ReadonlySet<string>
): "expanded" | "collapsed" {
  const startExpanded = layoutActiveDayDates.has(span.startDate);
  const endExpanded = layoutActiveDayDates.has(span.endDate);
  return startExpanded || endExpanded ? "expanded" : "collapsed";
}
