import { isPastCalendarDate } from "@/lib/dates";
import { narrowDayColumnGridTrack } from "@/lib/day-column-width";
import { isAnyAreaOpenInCalendar, serviceWeekdayForDate } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  computeCollapsedDayColumnLineWidthPx,
  type CollapsedShiftTimeWindow,
} from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";

export const PLANNING_CELL_HEIGHT_PX = 44;
export const PLANNING_CELL_PADDING_PX = 4;
/** Graues Info-Panel in Kalenderzellen (keine Verfügbarkeit, vergangene Abwesenheit). */
export const PLANNING_CELL_INFO_LABEL_PANEL_CLASS =
  "rounded-lg bg-slate-100 text-xs text-slate-500";
export const PLANNING_CELL_BLOCKED_INFO_PANEL_CLASS =
  "flex min-h-0 flex-1 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500";
/** Abwesenheit in aktuellen/künftigen Tagen — nur Textfarbe, kein Hintergrund. */
export const PLANNING_CELL_ABSENT_ACTIVE_PANEL_CLASS =
  "flex min-h-0 flex-1 items-center justify-center text-xs font-medium text-rose-700";
/** Legende: keine Verfügbarkeit (slate-400). */
export const PLANNING_LEGEND_NO_AVAILABILITY_DOT_COLOR = "#94a3b8";
/** Legende: Abwesenheit in aktuellen/künftigen Tagen. */
export const PLANNING_LEGEND_ABSENT_ACTIVE_DOT_COLOR = "#f43f5e";
/** Eingeklappte Schichtkarte: fester Abstand vom linken Zellrand (Schichtplan). */
export const PLANNING_COLLAPSED_SHIFT_LEFT_INSET_PX = 5;
export const PLANNING_COLLAPSED_SHIFT_WIDTH_DELTA_PX = -2;
export const PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX = 5;
/** Aufgeklappte Tagzellen: Schichtkarten nutzen diese Breite weniger — visueller Abstand zum nächsten Tag. */
export const PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX = 10;
/** Dashboard: Schichtkarten höchstens 80 % der Zellbreite — Rest bleibt für weitere Schichten frei. */
export const DASHBOARD_SHIFT_CARD_MAX_CELL_WIDTH_RATIO = 0.8;

export function dashboardShiftCardTrackWidthPx(cellInnerWidthPx: number): number {
  if (cellInnerWidthPx <= 0) return 0;
  return cellInnerWidthPx * DASHBOARD_SHIFT_CARD_MAX_CELL_WIDTH_RATIO;
}
export const PLANNING_EMPLOYEE_ROW_HEIGHT = `${PLANNING_CELL_HEIGHT_PX + PLANNING_CELL_PADDING_PX * 2}px`;
export const PLANNING_DAY_HEADER_ROW_HEIGHT = "3.75rem";
export const PLANNING_DAY_HEADER_ROW_HEIGHT_PX = 60;
export const PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT = "40px";
export const PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT_PX = 40;
/** Kompakte Wochenzusammenfassung unten im Kalender (ehem. 3.5rem). */
export const PLANNING_DAY_FOOTER_ROW_HEIGHT = "36px";
/** Kalender-Footer oben: Gesamtstunden/Gesamtkosten pro Tag (Platzhalter). */
export const PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT = "22px";
export const PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT_PX = 22;
/** Bereich-Kalender Tag×Bereich: Bedarf-Strip (Personalbedarf-Overlay). */
export const TAG_AREA_HEADER_STRIP_HEIGHT = "44px";
export const TAG_AREA_HEADER_STRIP_HEIGHT_PX = 44;
export const PLANNING_DAY_FOOTER_ROW_HEIGHT_PX = 36;
/** Summe der sticky Footer-Zeilen — Grenze für Kalender-Inhalt darüber. */
export const PLANNING_CALENDAR_FOOTER_CHROME_HEIGHT_PX =
  PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT_PX + PLANNING_DAY_FOOTER_ROW_HEIGHT_PX;
export const PLANNING_STAFF_COLUMN_WIDTH_PX = 200;
/** Aktuelle/künftige Tage — leicht grau, damit weiße Schichtkarten minimal abheben. */
export const PLANNING_ACTIVE_DAY_CELL_BG = "#f8fafc";
/** Header-/Footer-Overlay in aktiven Tag-Bereich-Zellen (Bereich-Kalender). */
export const PLANNING_ACTIVE_DAY_OVERLAY_BG = "#f6f7f9";
export const PLANNING_PAST_DAY_CELL_BG = "#f3f6f9";
export const PLANNING_CLOSED_DAY_CELL_BG = "#e6edf2";
/** UX-Experiment: sichtbares „+ / frei“ in leeren aufgeklappten Zellen ausblenden (Klickzonen neben Schichten bleiben aktiv). */
export const DASHBOARD_CELL_FREE_PLUS_ENABLED = false;
export const PLANNING_OPEN_DAY_COLUMN_WIDTH = "minmax(110px, 1fr)";
export const PLANNING_EQUAL_FILL_DAY_COLUMN_WIDTH = "minmax(0, 1fr)";
export const PLANNING_CALENDAR_LAYOUT_ANIMATION_DELAY_MS = 120;
export const PLANNING_CALENDAR_GRID_TRANSITION_DURATION_MS = 280;
export const PLANNING_CALENDAR_GRID_TRANSITION_CLASS =
  "transition-[grid-template-columns,min-width] duration-[280ms] ease-in-out";
export const PLANNING_CELL_CONTENT_TRANSITION_CLASS =
  "transition-opacity duration-[280ms] ease-in-out";
export const PLANNING_COLUMN_DIVIDER_CLASS = "border-r border-slate-300";
export const PLANNING_ROW_DIVIDER_CLASS = "border-b border-slate-300";
export const PLANNING_CALENDAR_MEDIUM_BORDER = "border-slate-400";
export const PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS = `border-r ${PLANNING_CALENDAR_MEDIUM_BORDER}`;
export const PLANNING_HEADER_ROW_BORDER_CLASS = `border-b ${PLANNING_CALENDAR_MEDIUM_BORDER}`;
/** Sticky Mitarbeiterspalte: untere Kante per inset-shadow (normale border-b wird sonst überdeckt). */
export const PLANNING_STAFF_COLUMN_BOTTOM_EDGE_CLASS =
  "shadow-[inset_0_-1px_0_0_theme(colors.slate.400)]";

/** Einheitliche schmale Breite für zugeklappte Schicht-Marker im Schichtplan. */
export function computePlanningCollapsedMarkerWidthPx(
  cellInnerWidthPx: number,
  dayReferenceShiftTimes: readonly CollapsedShiftTimeWindow[],
  serviceTimeline: ShiftCardServiceTimeline
): number {
  if (cellInnerWidthPx <= 0) return 1;
  const contentWidthPx = Math.max(
    1,
    cellInnerWidthPx + PLANNING_CELL_PADDING_PX * 2
  );
  const referenceTimes =
    dayReferenceShiftTimes.length > 0
      ? dayReferenceShiftTimes
      : [{ startTime: "08:00", endTime: "16:00" }];
  return Math.max(
    1,
    computeCollapsedDayColumnLineWidthPx(
      contentWidthPx,
      referenceTimes,
      serviceTimeline
    ) + PLANNING_COLLAPSED_SHIFT_WIDTH_DELTA_PX
  );
}

const OPEN_DAY_COLUMN_WIDTH = PLANNING_OPEN_DAY_COLUMN_WIDTH;
const EQUAL_FILL_DAY_COLUMN_WIDTH = PLANNING_EQUAL_FILL_DAY_COLUMN_WIDTH;

export function planningStaffColumnGridTrack(widthPx: number): string {
  return `minmax(${widthPx}px, ${widthPx}px)`;
}

export function planningGridTemplateColumns(
  staffColumnWidthPx: number,
  dayUsesWideColumn: boolean[],
  narrowDayColumnWidthsPx: number[],
  fillColumnsEqually: boolean
): string {
  const dayColumns = fillColumnsEqually
    ? dayUsesWideColumn.map(() => EQUAL_FILL_DAY_COLUMN_WIDTH)
    : dayUsesWideColumn.map((wide, dayIndex) =>
        wide
          ? OPEN_DAY_COLUMN_WIDTH
          : narrowDayColumnGridTrack(narrowDayColumnWidthsPx[dayIndex])
      );
  return [planningStaffColumnGridTrack(staffColumnWidthPx), ...dayColumns].join(
    " "
  );
}

export function planningCalendarMinWidth(
  staffColumnWidthPx: number,
  dayUsesWideColumn: boolean[],
  narrowDayColumnWidthsPx: number[]
): number {
  return (
    staffColumnWidthPx +
    dayUsesWideColumn.reduce(
      (sum, wide, dayIndex) =>
        sum + (wide ? 110 : narrowDayColumnWidthsPx[dayIndex]),
      0
    )
  );
}

export function createPlanningActiveDayDates(
  dates: readonly string[],
  areaIds: readonly string[],
  serviceHours: AreaServiceHourRef[],
  shiftsByDate: ReadonlyMap<string, number>,
  options: { simplePlanning: boolean; todayISO: string }
): Set<string> {
  return new Set(
    dates.filter((date) => {
      const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
      if (options.simplePlanning) {
        return !isPastCalendarDate(date, options.todayISO);
      }
      return isAnyAreaOpenInCalendar(serviceHours, areaIds, date, hasShifts);
    })
  );
}

export function resolvePlanningLayoutDayDates(
  dates: readonly string[],
  areaIds: readonly string[],
  serviceHours: AreaServiceHourRef[],
  shiftsByDate: ReadonlyMap<string, number>,
  options: {
    weekStart: string;
    currentWeekStart: string;
    todayISO: string;
    savedCurrentWeekExpansion: Set<string> | null;
    isFirstCurrentWeekView: boolean;
    simplePlanning: boolean;
  }
): Set<string> {
  const openDays = createPlanningActiveDayDates(
    dates,
    areaIds,
    serviceHours,
    shiftsByDate,
    { simplePlanning: options.simplePlanning, todayISO: options.todayISO }
  );
  const isCurrentWeek = options.weekStart === options.currentWeekStart;

  if (!isCurrentWeek) {
    return openDays;
  }

  if (options.isFirstCurrentWeekView) {
    return new Set(dates);
  }

  if (options.savedCurrentWeekExpansion) {
    const expanded = new Set<string>();
    for (const date of openDays) {
      if (options.savedCurrentWeekExpansion.has(date)) {
        expanded.add(date);
      }
    }
    return expanded;
  }

  return openDays;
}

/**
 * Dashboard: Tage mit Servicezeiten (oder Schichten) aufgeklappt; Tage ohne Service
 * initial zugeklappt. Per Wochentag merken, wenn Nutzer einen solchen Tag aufklappt.
 */
export function resolveDashboardExpandedDayDates(
  dates: readonly string[],
  dayHasServiceHours: readonly boolean[],
  shiftsByDate: ReadonlyMap<string, number>,
  userExpandedNoServiceWeekdays: ReadonlySet<number>
): Set<string> {
  const expanded = new Set<string>();
  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const date = dates[dayIndex]!;
    const hasService = dayHasServiceHours[dayIndex] ?? false;
    const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
    if (hasService || hasShifts) {
      expanded.add(date);
      continue;
    }
    if (userExpandedNoServiceWeekdays.has(serviceWeekdayForDate(date))) {
      expanded.add(date);
    }
  }
  return expanded;
}

export function resolvePlanningCellBackground(
  date: string,
  dayIndex: number,
  dayHasServiceHours: readonly boolean[],
  hasShift: boolean,
  todayISO: string
): string | undefined {
  const hasService = dayHasServiceHours[dayIndex];
  const isPast = isPastCalendarDate(date, todayISO);

  if (!hasService && !hasShift) {
    return PLANNING_CLOSED_DAY_CELL_BG;
  }
  if (isPast) {
    return PLANNING_PAST_DAY_CELL_BG;
  }
  return PLANNING_ACTIVE_DAY_CELL_BG;
}
