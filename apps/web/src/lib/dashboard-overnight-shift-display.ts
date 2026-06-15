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
