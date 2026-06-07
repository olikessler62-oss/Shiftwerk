"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isPastCalendarDate } from "@/lib/dates";
import { buildHolidayNamesByDate, isGermanPublicHoliday } from "@/lib/german-public-holidays";
import { formatDayHeader, formatTimeRange } from "@/lib/planning-utils";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { LocationArea, ShiftTypeWithBreaks } from "@schichtwerk/types";
import {
  areaHasServiceHours,
  areaHasStaffingRequirementInWeek,
  hasStaffingRequirementInCalendar,
  isAnyAreaOpenInCalendar,
  isAreaOpenInCalendar,
  tagAreaHeaderStaffingEntriesInCalendar,
  weekdayIndexFromDate,
  type AreaServiceHourRef,
  type StaffingRule,
} from "@/lib/location-staffing-client";
import {
  addManualAssignmentDay,
  clearManualAssignmentDaysWithShifts,
  readManualAssignmentDays,
  removeManualAssignmentDay,
} from "@/lib/dashboard-manual-assignment-days";
import {
  addExplicitDayOffDay,
  readExplicitDayOffDays,
  removeExplicitDayOffDay,
} from "@/lib/dashboard-explicit-day-off-days";
import { cn } from "@/lib/cn";
import {
  CalendarAreaCheckbox,
  CalendarCornerCheckbox,
} from "@/components/dashboard/calendar-corner-checkbox";
import { TagAreaHeaderStrip } from "@/components/dashboard/tag-area-header-strip";
import {
  areaColumnGridTrack,
  resolveAreaColumnWidthPx,
} from "@/lib/area-column-width";

export type DashboardShiftCard = {
  id: string;
  shift_date: string;
  locationAreaId: string | null;
  shiftTypeId: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  employeeName: string;
};

type Props = {
  dates: string[];
  locationId: string | null;
  areas: LocationArea[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: StaffingRule[];
  shifts: DashboardShiftCard[];
  shiftTypes: ShiftTypeWithBreaks[];
};

const CALENDAR_HOUR_COUNT = 24;
const OPEN_DAY_COLUMN_WIDTH = "minmax(120px, 1fr)";
/** Nur Header-Datum lesbar; Spaltenbreite kommt aus dem gemeinsamen Grid (Header + Raster). */
const CLOSED_DAY_COLUMN_WIDTH = "minmax(max-content, max-content)";
/** Gleichverteilung, wenn die Woche keinen Spalten-Inhalt hat — füllt das Kalender-Div horizontal. */
const EQUAL_FILL_DAY_COLUMN_WIDTH = "minmax(0, 1fr)";

function gridTemplateColumns(
  areaColumnWidthPx: number,
  dayUsesWideColumn: boolean[],
  fillColumnsEqually: boolean
): string {
  const dayColumns = fillColumnsEqually
    ? dayUsesWideColumn.map(() => EQUAL_FILL_DAY_COLUMN_WIDTH)
    : dayUsesWideColumn.map((wide) =>
        wide ? OPEN_DAY_COLUMN_WIDTH : CLOSED_DAY_COLUMN_WIDTH
      );
  return [areaColumnGridTrack(areaColumnWidthPx), ...dayColumns].join(" ");
}

function calendarMinWidth(
  areaColumnWidthPx: number,
  dayUsesWideColumn: boolean[]
): number {
  const narrowDayEstimate = 56;
  return (
    areaColumnWidthPx +
    dayUsesWideColumn.reduce(
      (sum, wide) => sum + (wide ? 120 : narrowDayEstimate),
      0
    )
  );
}

const HOUR_GRID_LINE_OPACITY = 35;
/** Etwas dunkler als HOUR_GRID_LINE_OPACITY — auf Header-Overlay-Hintergrund gerade noch erkennbar. */
const PAST_HOUR_GRID_LINE_OPACITY = 48;

function createHourGridBackgroundStyle(
  lineOpacityPercent: number
): React.CSSProperties {
  const lineColor = `color-mix(in srgb, var(--color-border) ${lineOpacityPercent}%, transparent)`;
  return {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(100% / ${CALENDAR_HOUR_COUNT} - 1px), ${lineColor} calc(100% / ${CALENDAR_HOUR_COUNT} - 1px), ${lineColor} calc(100% / ${CALENDAR_HOUR_COUNT}))`,
  };
}

/** Vergangene Tag-Bereich-Zellen: gleiche Fläche wie Header-Overlay, dezent sichtbare Stundenlinien. */
function createPastTagAreaDayBackgroundStyle(): React.CSSProperties {
  return {
    backgroundColor: "var(--color-background)",
    ...createHourGridBackgroundStyle(PAST_HOUR_GRID_LINE_OPACITY),
  };
}

const hourGridBackgroundStyle = createHourGridBackgroundStyle(
  HOUR_GRID_LINE_OPACITY
);
const pastTagAreaDayBackgroundStyle = createPastTagAreaDayBackgroundStyle();

/** Feste Header-Höhe (3 Zeilen inkl. Feiertag), damit Wochenwechsel nicht springt. */
const CALENDAR_HEADER_ROW_HEIGHT = "3.5rem";

/** Bereich mit Arbeitszeiten, aber ohne Personalbedarf und ohne Schichten. */
const EMPTY_AREA_ROW_HEIGHT = "50px";

/** Tag-Bereich-Header-Overlay-Höhe. */
const TAG_AREA_HEADER_STRIP_HEIGHT = "20px";

/** Tag-Bereich-Footer-Streifen-Höhe. */
const TAG_AREA_FOOTER_STRIP_HEIGHT = "18px";

/** Tag-Bereich-Footer — Streifen unten in Bereich × Tag (bei Arbeitszeit). */
const TAG_AREA_FOOTER_STRIP_CLASS =
  "absolute inset-x-0 bottom-0 z-20 flex items-center justify-center overflow-hidden border-t border-border bg-background px-1";

/** Geschlossener Bereich × Tag (keine Arbeitszeit). */
const CLOSED_AREA_DAY_CLASS = "bg-background";

/** Header: nur Feiertage und Wochenende (Sa/So). */
const MUTED_DAY_HEADER_CLASS = "bg-calendar-muted-header";

/** Werktag-Header (Mo–Fr, kein Feiertag) — etwas heller als Feiertag/Wochenende. */
const ACTIVE_DAY_HEADER_CLASS = "bg-calendar-active-header";

/** Erste Spalte (Header-Ecke + Bereichsnamen). */
const AREA_COLUMN_BG_CLASS = "bg-calendar-active-header";

/** Trennlinie Header ↔ Bereiche — überall gleich intensiv (inkl. Sonntag). */
const HEADER_ROW_DIVIDER_CLASS = "border-b border-slate-300";

function dayHeaderUsesMutedBackground(
  dateISO: string,
  isHoliday: boolean
): boolean {
  if (isHoliday) return true;
  return weekdayIndexFromDate(dateISO) >= 5;
}

/** Grau: kein Arbeitstag, kein Personalbedarf, keine Schichten, nicht manuell geöffnet. */
function isDayFullyGray(
  dateISO: string,
  manualAssignmentDates: ReadonlySet<string>,
  serviceHours: AreaServiceHourRef[],
  areaIds: readonly string[],
  staffingRules: StaffingRule[],
  hasShiftsOnDate: boolean
): boolean {
  if (manualAssignmentDates.has(dateISO)) return false;
  if (hasShiftsOnDate) return false;
  if (
    hasStaffingRequirementInCalendar(
      staffingRules,
      areaIds,
      dateISO,
      serviceHours
    )
  ) {
    return false;
  }
  return !isAnyAreaOpenInCalendar(
    serviceHours,
    areaIds,
    dateISO,
    false
  );
}

/** Manuell geöffnet, aber ohne Personalbedarf, Arbeitszeit und Schichten — wieder grau setzen. */
function canSetDayOff(
  dateISO: string,
  manualAssignmentDates: ReadonlySet<string>,
  serviceHours: AreaServiceHourRef[],
  areaIds: readonly string[],
  staffingRules: StaffingRule[],
  hasShiftsOnDate: boolean
): boolean {
  if (!manualAssignmentDates.has(dateISO)) return false;
  if (hasShiftsOnDate) return false;
  if (
    hasStaffingRequirementInCalendar(
      staffingRules,
      areaIds,
      dateISO,
      serviceHours
    )
  ) {
    return false;
  }
  return !isAnyAreaOpenInCalendar(
    serviceHours,
    areaIds,
    dateISO,
    false
  );
}

type DayContextMenuAction = "assign" | "dayOff";

function dayHasScheduleActivityOnDate(
  dateISO: string,
  manualAssignmentDates: ReadonlySet<string>,
  serviceHours: AreaServiceHourRef[],
  areaIds: readonly string[],
  staffingRules: StaffingRule[],
  hasShiftsOnDate: boolean
): boolean {
  if (hasShiftsOnDate) return true;
  if (
    hasStaffingRequirementInCalendar(
      staffingRules,
      areaIds,
      dateISO,
      serviceHours
    )
  ) {
    return true;
  }
  return (
    manualAssignmentDates.has(dateISO) ||
    isAnyAreaOpenInCalendar(serviceHours, areaIds, dateISO, false)
  );
}

/** Platzhalter-Schichtkarte in kompakten Zeilen (50px), z. B. Bereich-Checkbox inaktiv. */
function InactiveAreaDummyShiftCard({
  shiftTypes,
}: {
  shiftTypes: ShiftTypeWithBreaks[];
}) {
  const lineColors =
    shiftTypes.length > 0
      ? shiftTypes.map((type) => type.color)
      : ["#0d9488", "#f59e0b", "#6366f1"];

  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg border border-border/80 bg-surface px-2.5 py-2 shadow-sm"
      aria-hidden
    >
      <div className="flex flex-col gap-1.5">
        {lineColors.slice(0, 3).map((color, index) => (
          <div
            key={`${color}-${index}`}
            className="h-0.5 rounded-full"
            style={{
              backgroundColor: color,
              width: `${100 - index * 14}%`,
              opacity: 0.9 - index * 0.12,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Vertikale Spalten-Trennung – Bereiche ↔ Tage und Tag ↔ Tag (nicht am Sonntag). */
const COLUMN_DIVIDER_CLASS = "border-r border-slate-300";

/** Rahmen des Kalender-Divs — abschließende Kante rechts (statt Sonntags-Spaltenlinie). */
const CALENDAR_FRAME_CLASS = "border border-slate-300";

/** Horizontale Bereichs-Trennung – gleiche Intensität wie Spalten-Linien. */
const ROW_DIVIDER_CLASS = "border-b border-slate-300";

export function DashboardCalendar({
  dates,
  locationId,
  areas,
  serviceHours,
  staffingRules,
  shifts,
  shiftTypes,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);

  const [manualAssignmentDates, setManualAssignmentDates] = useState<
    Set<string>
  >(() => new Set());
  const [explicitDayOffDates, setExplicitDayOffDates] = useState<Set<string>>(
    () => new Set()
  );
  const [activeAreaIds, setActiveAreaIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activeDayDates, setActiveDayDates] = useState<Set<string>>(
    () => new Set()
  );
  const [contextMenu, setContextMenu] = useState<{
    date: string;
    x: number;
    y: number;
    action: DayContextMenuAction;
  } | null>(null);

  useEffect(() => {
    setActiveAreaIds(new Set(areas.map((area) => area.id)));
  }, [areas]);

  useEffect(() => {
    if (!locationId) {
      setManualAssignmentDates(new Set());
      setExplicitDayOffDates(new Set());
      setContextMenu(null);
      return;
    }
    setManualAssignmentDates(readManualAssignmentDays(locationId));
    setExplicitDayOffDates(readExplicitDayOffDays(locationId));
    setContextMenu(null);
  }, [locationId]);

  const shiftDatesOnLocation = useMemo(() => {
    const unique = new Set<string>();
    for (const shift of shifts) {
      if (shift.locationAreaId) unique.add(shift.shift_date);
    }
    return [...unique];
  }, [shifts]);

  useEffect(() => {
    if (!locationId || shiftDatesOnLocation.length === 0) return;
    clearManualAssignmentDaysWithShifts(locationId, shiftDatesOnLocation);
    setManualAssignmentDates((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const date of shiftDatesOnLocation) {
        if (next.delete(date)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [locationId, shiftDatesOnLocation]);

  useEffect(() => {
    setContextMenu(null);
  }, [dates]);

  useEffect(() => {
    if (!contextMenu) return;
    function closeMenu() {
      setContextMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contextMenu]);

  const enableManualAssignment = useCallback(
    (date: string) => {
      if (!locationId) return;
      removeExplicitDayOffDay(locationId, date);
      addManualAssignmentDay(locationId, date);
      setExplicitDayOffDates((prev) => {
        if (!prev.has(date)) return prev;
        const next = new Set(prev);
        next.delete(date);
        return next;
      });
      setManualAssignmentDates((prev) => {
        const next = new Set(prev);
        next.add(date);
        return next;
      });
      setContextMenu(null);
    },
    [locationId]
  );

  const disableManualAssignment = useCallback(
    (date: string) => {
      if (!locationId) return;
      addExplicitDayOffDay(locationId, date);
      removeManualAssignmentDay(locationId, date);
      setExplicitDayOffDates((prev) => {
        const next = new Set(prev);
        next.add(date);
        return next;
      });
      setManualAssignmentDates((prev) => {
        const next = new Set(prev);
        next.delete(date);
        return next;
      });
      setContextMenu(null);
    },
    [locationId]
  );

  const areaIds = useMemo(() => areas.map((area) => area.id), [areas]);

  const shiftTypeNameById = useMemo(
    () => new Map(shiftTypes.map((type) => [type.id, type.name])),
    [shiftTypes]
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, DashboardShiftCard[]>();
    for (const shift of shifts) {
      if (!shift.locationAreaId) continue;
      const list = map.get(shift.shift_date) ?? [];
      list.push(shift);
      map.set(shift.shift_date, list);
    }
    return map;
  }, [shifts]);

  const dayHasOpenArea = useMemo(
    () =>
      dates.map((date) => {
        const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
        return (
          manualAssignmentDates.has(date) ||
          isAnyAreaOpenInCalendar(
            serviceHours,
            areaIds,
            date,
            hasShifts
          )
        );
      }),
    [dates, serviceHours, areaIds, shiftsByDate, manualAssignmentDates]
  );

  useEffect(() => {
    setActiveDayDates(
      new Set(dates.filter((date, dayIndex) => dayHasOpenArea[dayIndex]))
    );
  }, [dates, locationId, dayHasOpenArea]);

  useEffect(() => {
    setActiveDayDates((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
        const date = dates[dayIndex];
        if (dayHasOpenArea[dayIndex] && !next.has(date)) {
          next.add(date);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dates, dayHasOpenArea]);

  const dayUsesWideColumn = useMemo(
    () =>
      dates.map((date, dayIndex) => {
        if (!activeDayDates.has(date)) return false;
        const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
        const isManual = manualAssignmentDates.has(date);
        if (!dayHasOpenArea[dayIndex]) return false;
        const hasStaffing = hasStaffingRequirementInCalendar(
          staffingRules,
          areaIds,
          date,
          serviceHours
        );
        return hasStaffing || hasShifts || isManual;
      }),
    [
      dates,
      dayHasOpenArea,
      staffingRules,
      areaIds,
      serviceHours,
      shiftsByDate,
      manualAssignmentDates,
      activeDayDates,
    ]
  );

  /** Kein Tag hat Schichten/Personalbedarf — Spalten gleich breit statt verkleinern. */
  const fillColumnsEqually = useMemo(
    () => !dayUsesWideColumn.some(Boolean),
    [dayUsesWideColumn]
  );

  const areaColumnWidthPx = useMemo(
    () => resolveAreaColumnWidthPx(areas.map((area) => area.name)),
    [areas]
  );

  const columnTemplate = useMemo(
    () =>
      gridTemplateColumns(
        areaColumnWidthPx,
        dayUsesWideColumn,
        fillColumnsEqually
      ),
    [areaColumnWidthPx, dayUsesWideColumn, fillColumnsEqually]
  );

  const minCalendarWidth = useMemo(() => {
    if (fillColumnsEqually) return undefined;
    return calendarMinWidth(areaColumnWidthPx, dayUsesWideColumn);
  }, [areaColumnWidthPx, dayUsesWideColumn, fillColumnsEqually]);

  const areaHasWeekContent = useMemo(
    () =>
      areas.map((area) => {
        if (shifts.some((shift) => shift.locationAreaId === area.id)) {
          return true;
        }
        return areaHasStaffingRequirementInWeek(
          staffingRules,
          area.id,
          dates,
          serviceHours
        );
      }),
    [areas, shifts, staffingRules, dates, serviceHours]
  );

  const areaHasManualAssignmentDisplay = useMemo(
    () =>
      areas.map((area) =>
        [...manualAssignmentDates].some(
          (date) =>
            !isAreaOpenInCalendar(
              serviceHours,
              area.id,
              date,
              (shiftsByDate.get(date) ?? []).some(
                (shift) => shift.locationAreaId === area.id
              )
            )
        )
      ),
    [areas, manualAssignmentDates, serviceHours, shiftsByDate]
  );

  const areaUsesCompactRow = useMemo(
    () =>
      areas.map((area, index) => {
        if (areaHasWeekContent[index]) return false;
        if (areaHasManualAssignmentDisplay[index]) return false;
        return areaHasServiceHours(serviceHours, area.id);
      }),
    [areas, areaHasWeekContent, areaHasManualAssignmentDisplay, serviceHours]
  );

  /** Kein Bereich hat Schichten/Personalbedarf — Zeilen gleich hoch statt 50px. */
  const fillRowsEqually = useMemo(
    () => areas.length > 0 && !areaHasWeekContent.some(Boolean),
    [areas.length, areaHasWeekContent]
  );

  const rowTemplate = useMemo(() => {
    if (areas.length === 0) {
      return `${CALENDAR_HEADER_ROW_HEIGHT} minmax(0, 1fr)`;
    }
    const bodyRows = areas
      .map((area, index) => {
        if (!activeAreaIds.has(area.id)) return EMPTY_AREA_ROW_HEIGHT;
        if (fillRowsEqually) return "minmax(0, 1fr)";
        return areaUsesCompactRow[index]
          ? EMPTY_AREA_ROW_HEIGHT
          : "minmax(0, 1fr)";
      })
      .join(" ");
    return `${CALENDAR_HEADER_ROW_HEIGHT} ${bodyRows}`;
  }, [areas, areaUsesCompactRow, fillRowsEqually, activeAreaIds]);

  const toggleAreaActive = useCallback((areaId: string, active: boolean) => {
    setActiveAreaIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(areaId);
      else next.delete(areaId);
      return next;
    });
  }, []);

  const toggleDayActive = useCallback((date: string, active: boolean) => {
    setActiveDayDates((prev) => {
      const next = new Set(prev);
      if (active) next.add(date);
      else next.delete(date);
      return next;
    });
  }, []);

  const dayHasScheduleActivity = useMemo(
    () =>
      dates.map((date) =>
        dayHasScheduleActivityOnDate(
          date,
          manualAssignmentDates,
          serviceHours,
          areaIds,
          staffingRules,
          (shiftsByDate.get(date)?.length ?? 0) > 0
        )
      ),
    [
      dates,
      manualAssignmentDates,
      serviceHours,
      areaIds,
      staffingRules,
      shiftsByDate,
    ]
  );

  const holidayNames = useMemo(
    () => buildHolidayNamesByDate(dates, locale === "en" ? "en" : "de"),
    [dates, locale]
  );

  const byAreaDate = useMemo(() => {
    const map = new Map<string, DashboardShiftCard[]>();
    for (const shift of shifts) {
      if (!shift.locationAreaId) continue;
      const key = `${shift.locationAreaId}:${shift.shift_date}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  const dayShowsHourGrid = (dayIndex: number) => {
    const date = dates[dayIndex];
    if (!activeDayDates.has(date)) return false;
    if (manualAssignmentDates.has(date)) return true;
    return fillColumnsEqually
      ? dayHasOpenArea[dayIndex]
      : dayUsesWideColumn[dayIndex];
  };

  const isFullyGrayDay = (date: string) => {
    const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
    return isDayFullyGray(
      date,
      manualAssignmentDates,
      serviceHours,
      areaIds,
      staffingRules,
      hasShifts
    );
  };

  const canSetDayOffForDate = (date: string) => {
    const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
    return canSetDayOff(
      date,
      manualAssignmentDates,
      serviceHours,
      areaIds,
      staffingRules,
      hasShifts
    );
  };

  const dayColumnDivider = (dayIndex: number) =>
    dayIndex < dates.length - 1 ? COLUMN_DIVIDER_CLASS : undefined;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface shadow-sm",
        CALENDAR_FRAME_CLASS
      )}
    >
      <div
        className={cn(
          "h-full min-h-0",
          fillColumnsEqually ? "overflow-x-hidden" : "overflow-x-auto",
          "overflow-y-hidden"
        )}
      >
        <div
          className="grid h-full min-h-0"
          style={{
            gridTemplateColumns: columnTemplate,
            gridTemplateRows: rowTemplate,
            ...(fillColumnsEqually
              ? { width: "100%" }
              : minCalendarWidth !== undefined
                ? { minWidth: minCalendarWidth }
                : undefined),
          }}
        >
          <div
            className={cn(
              "sticky left-0 z-30",
              AREA_COLUMN_BG_CLASS,
              HEADER_ROW_DIVIDER_CLASS,
              COLUMN_DIVIDER_CLASS
            )}
            style={{ gridColumn: 1, gridRow: 1 }}
            aria-hidden
          />

          {dates.map((date, dayIndex) => {
            const { weekday, label } = formatDayHeader(date, intlLocale);
            const holiday = holidayNames[date];
            const isHoliday = isGermanPublicHoliday(date);
            const mutedHeader = dayHeaderUsesMutedBackground(date, isHoliday);
            return (
              <div
                key={`header-${date}`}
                className={cn(
                  "relative flex min-h-0 flex-col items-center justify-center gap-px overflow-hidden py-1 text-center",
                  HEADER_ROW_DIVIDER_CLASS,
                  mutedHeader ? MUTED_DAY_HEADER_CLASS : ACTIVE_DAY_HEADER_CLASS,
                  dayColumnDivider(dayIndex)
                )}
                style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
              >
                {dayHasOpenArea[dayIndex] ? (
                  <CalendarCornerCheckbox
                    aria-label={`${weekday} ${label}`}
                    checked={activeDayDates.has(date)}
                    onChange={(event) =>
                      toggleDayActive(date, event.target.checked)
                    }
                  />
                ) : null}
                <div className="shrink-0 whitespace-nowrap text-xs font-semibold leading-none text-muted">
                  {weekday}
                </div>
                <div className="shrink-0 whitespace-nowrap text-sm font-medium leading-none">
                  {label}
                </div>
                {holiday ? (
                  <div
                    className="w-full shrink-0 truncate whitespace-nowrap text-[0.625rem] leading-tight text-blue-600"
                    title={holiday}
                  >
                    {holiday}
                  </div>
                ) : null}
              </div>
            );
          })}

          {areas.length === 0 ? (
            <div
              className="flex items-center justify-center px-4 py-12 text-center text-muted"
              style={{ gridColumn: "1 / -1", gridRow: 2 }}
            >
              {t("dashboard.noAreas")}
            </div>
          ) : (
            <>
              {dates.map((date, dayIndex) => (
                <div
                  key={`day-grid-${date}`}
                  aria-hidden
                  className={cn(
                    "pointer-events-none z-[1] min-h-0",
                    !dayShowsHourGrid(dayIndex) && CLOSED_AREA_DAY_CLASS,
                    dayColumnDivider(dayIndex)
                  )}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: "2 / -1",
                    ...(dayShowsHourGrid(dayIndex)
                      ? isPastCalendarDate(date)
                        ? pastTagAreaDayBackgroundStyle
                        : hourGridBackgroundStyle
                      : undefined),
                  }}
                />
              ))}

              {areas.map((area, rowIndex) => {
                const isLastRow = rowIndex === areas.length - 1;
                const gridRow = rowIndex + 2;
                const isAreaActive = activeAreaIds.has(area.id);
                const isCompactRow =
                  !isAreaActive ||
                  (!fillRowsEqually && areaUsesCompactRow[rowIndex]);

                return (
                  <Fragment key={area.id}>
                    <div
                      className={cn(
                        "sticky left-0 z-20 h-full min-h-0 pt-[5px] pl-[2px] pr-2",
                        AREA_COLUMN_BG_CLASS,
                        COLUMN_DIVIDER_CLASS,
                        !isLastRow && ROW_DIVIDER_CLASS
                      )}
                      style={{ gridColumn: 1, gridRow }}
                    >
                      <div className="flex items-center gap-[10px]">
                        <CalendarAreaCheckbox
                          aria-label={area.name}
                          checked={isAreaActive}
                          onChange={(event) =>
                            toggleAreaActive(area.id, event.target.checked)
                          }
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate whitespace-nowrap text-sm font-semibold leading-[14px]">
                          {area.name}
                        </p>
                        {area.archived_at ? (
                          <span className="mt-0.5 block text-xs font-normal text-muted">
                            ({t("common.archived")})
                          </span>
                        ) : null}
                        </div>
                      </div>
                    </div>

                    {dates.map((date, dayIndex) => {
                      const dayShifts =
                        byAreaDate.get(`${area.id}:${date}`) ?? [];
                      const isManualAssignmentDay =
                        manualAssignmentDates.has(date);
                      const isOpen =
                        isManualAssignmentDay ||
                        isAreaOpenInCalendar(
                          serviceHours,
                          area.id,
                          date,
                          dayShifts.length > 0
                        );
                      const isDayActive = activeDayDates.has(date);
                      const showOpenDayCell =
                        isAreaActive &&
                        isDayActive &&
                        isOpen &&
                        (!isCompactRow || isManualAssignmentDay);
                      const showInactivePreviewCell =
                        (!isAreaActive || !isDayActive) &&
                        dayHasScheduleActivity[dayIndex];
                      const showInactivePreviewDummy =
                        showInactivePreviewCell && isCompactRow;
                      const showDayCellContent =
                        showOpenDayCell || showInactivePreviewCell;
                      const showDaytimesGradient =
                        showOpenDayCell &&
                        isOpen &&
                        dayHasOpenArea[dayIndex] &&
                        !explicitDayOffDates.has(date);
                      const headerStaffing = tagAreaHeaderStaffingEntriesInCalendar(
                        staffingRules,
                        area.id,
                        date,
                        serviceHours,
                        shiftTypes,
                        dayShifts.map((shift) => ({
                          shiftTypeId: shift.shiftTypeId,
                        }))
                      );
                      const fullyGray = isFullyGrayDay(date);
                      const showDayOffMenu = canSetDayOffForDate(date);
                      const hasContextMenu = fullyGray || showDayOffMenu;

                      return (
                        <div
                          key={date}
                          className={cn(
                            "relative z-10 flex min-h-0 flex-col overflow-hidden",
                            showDayCellContent ? "p-2" : CLOSED_AREA_DAY_CLASS,
                            hasContextMenu && "cursor-context-menu",
                            dayColumnDivider(dayIndex),
                            !isLastRow && ROW_DIVIDER_CLASS
                          )}
                          style={{ gridColumn: dayIndex + 2, gridRow }}
                          onContextMenu={
                            hasContextMenu
                              ? (event) => {
                                  event.preventDefault();
                                  setContextMenu({
                                    date,
                                    x: event.clientX,
                                    y: event.clientY,
                                    action: fullyGray ? "assign" : "dayOff",
                                  });
                                }
                              : undefined
                          }
                        >
                          {showDayCellContent ? (
                            <>
                              <TagAreaHeaderStrip
                                showDaytimesGradient={showDaytimesGradient}
                                entries={headerStaffing}
                                shiftTypeNameById={shiftTypeNameById}
                                style={{ height: TAG_AREA_HEADER_STRIP_HEIGHT }}
                              />
                              <div
                                className={TAG_AREA_FOOTER_STRIP_CLASS}
                                style={{ height: TAG_AREA_FOOTER_STRIP_HEIGHT }}
                              />
                              <div
                                className="flex h-full min-h-0 flex-col gap-1.5"
                                style={{
                                  paddingTop: TAG_AREA_HEADER_STRIP_HEIGHT,
                                  paddingBottom: TAG_AREA_FOOTER_STRIP_HEIGHT,
                                }}
                              >
                                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                                  {showInactivePreviewDummy ? (
                                    <InactiveAreaDummyShiftCard
                                      shiftTypes={shiftTypes}
                                    />
                                  ) : showOpenDayCell ? (
                                    dayShifts.map((shift) => (
                                      <div
                                        key={shift.id}
                                        className="shrink-0 rounded-lg px-2.5 py-2 text-white shadow-sm"
                                        style={{
                                          backgroundColor: shift.color,
                                        }}
                                      >
                                        <p className="text-xs font-semibold leading-tight">
                                          {shift.shiftName}{" "}
                                          {formatTimeRange(
                                            shift.startTime,
                                            shift.endTime
                                          )}
                                        </p>
                                        <p className="mt-1 text-xs leading-tight opacity-95">
                                          {shift.employeeName}
                                        </p>
                                      </div>
                                    ))
                                  ) : null}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </>
          )}
        </div>
      </div>

      {contextMenu ? (
        <>
          <button
            type="button"
            aria-label={t("common.close")}
            className="fixed inset-0 z-40 cursor-default border-0 bg-transparent p-0"
            onClick={() => setContextMenu(null)}
          />
          <div
            role="menu"
            className="fixed z-50 min-w-[14rem] overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-subtle"
              onClick={() =>
                contextMenu.action === "assign"
                  ? enableManualAssignment(contextMenu.date)
                  : disableManualAssignment(contextMenu.date)
              }
            >
              {contextMenu.action === "assign"
                ? t("dashboard.assignEmployeeToDay")
                : t("dashboard.setDayOffForAllAreas")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
