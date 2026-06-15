import type { PlanningShift } from "@/lib/planning-shift-card";
import type { PlanningShiftDisplaySegment } from "@/lib/planning-overnight-shift-display";
import { planningShiftSegmentMaxWidthPx } from "@/lib/planning-overnight-shift-display";

export const PLANNING_EXPANDED_SHIFT_CELL_GAP_PX = 2;

/** Gruppierung gleicher Schichtarten (Früh/Mittel/Spät) an einem Tag. */
export function planningExpandedShiftUniformKey(shift: PlanningShift): string {
  if (shift.area_shift_template_id) {
    return `template:${shift.area_shift_template_id}`;
  }
  return `time:${shift.startTime.slice(0, 5)}:${shift.endTime.slice(0, 5)}`;
}

function segmentUniformKey(segment: PlanningShiftDisplaySegment): string {
  const base = planningExpandedShiftUniformKey(segment.shift);
  return segment.part === "full" ? base : `${base}:${segment.part}`;
}

function capSegmentWidthPx(
  layoutWidthPx: number,
  fairShareWidthPx: number,
  part: PlanningShiftDisplaySegment["part"]
): number {
  return Math.min(
    fairShareWidthPx,
    planningShiftSegmentMaxWidthPx(layoutWidthPx, part)
  );
}

/**
 * Kleinste Fair-Share-Breite pro Schichtart über alle Mitarbeiterzellen eines Tages.
 * Nachtschicht-Hälften sind auf höchstens die halbe Zellbreite begrenzt.
 */
export function computeExpandedDayUniformShiftWidths(
  layoutWidthPx: number,
  employees: readonly { id: string }[],
  shiftsByCellDisplay: ReadonlyMap<string, readonly PlanningShiftDisplaySegment[]>,
  date: string,
  cellGapPx = PLANNING_EXPANDED_SHIFT_CELL_GAP_PX
): Map<string, number> {
  const minByKey = new Map<string, number>();
  if (layoutWidthPx <= 0) return minByKey;

  for (const employee of employees) {
    const cellSegments = shiftsByCellDisplay.get(`${employee.id}:${date}`) ?? [];
    const count = cellSegments.length;
    if (count === 0) continue;

    const gaps = Math.max(0, count - 1) * cellGapPx;
    const fairShareWidthPx = Math.max(0, (layoutWidthPx - gaps) / count);

    for (const segment of cellSegments) {
      const key = segmentUniformKey(segment);
      const widthPx = capSegmentWidthPx(
        layoutWidthPx,
        fairShareWidthPx,
        segment.part
      );
      const existing = minByKey.get(key);
      minByKey.set(
        key,
        existing === undefined ? widthPx : Math.min(existing, widthPx)
      );
    }
  }

  return minByKey;
}
