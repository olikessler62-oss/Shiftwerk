"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isPastCalendarDate } from "@/lib/dates";
import { buildHolidayNamesByDate, isGermanPublicHoliday } from "@/lib/german-public-holidays";
import { shiftColorStyle } from "@/lib/shift-color-style";
import { formatDayHeader, formatTimeRange } from "@/lib/planning-utils";
import { shortenShiftTypeDisplayName } from "@/lib/profile-availability-label";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import {
  areaHasStaffingRequirementOnDate,
  hasStaffingRequirementInCalendar,
  isAnyAreaOpenInCalendar,
  isAreaOpenInCalendar,
  isAreaOpenOnDate,
  isPastAreaWorkDayCell,
  tagAreaHeaderStaffingEntriesInCalendar,
  weekdayIndexFromDate,
  type AreaServiceHourRef,
  type StaffingRule,
} from "@/lib/location-staffing-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import {
  CalendarAreaCheckbox,
  CalendarCornerCheckbox,
} from "@/components/dashboard/calendar-corner-checkbox";
import { TagAreaHeaderStrip } from "@/components/dashboard/tag-area-header-strip";
import {
  areaColumnGridTrack,
  resolveAreaColumnWidthPx,
} from "@/lib/area-column-width";
import {
  narrowDayColumnGridTrack,
  resolveNarrowDayColumnWidthsPx,
} from "@/lib/day-column-width";
import {
  DashboardAddShiftModal,
  type DashboardAddShiftDialogState,
} from "@/components/dashboard/dashboard-add-shift-modal";
import {
  DashboardBulkShiftModal,
  type DashboardBulkShiftDialogState,
} from "@/components/dashboard/dashboard-bulk-shift-modal";
import { undoLastShiftAssignBatch } from "@/app/actions/shifts";
import type { LocationAreaStaffing, Profile, Qualification } from "@schichtwerk/types";

export type DashboardShiftCard = {
  id: string;
  shift_date: string;
  locationAreaId: string | null;
  shiftTypeId: string | null;
  employeeId: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  employeeName: string;
  employeeColor: string | null;
};

type Props = {
  dates: string[];
  locationId: string | null;
  locationName: string;
  areas: LocationArea[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: StaffingRule[];
  shifts: DashboardShiftCard[];
  shiftTypes: ShiftTypeWithBreaks[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profiles: Profile[];
  fullStaffingRules: LocationAreaStaffing[];
};

const CALENDAR_HOUR_COUNT = 24;
const OPEN_DAY_COLUMN_WIDTH = "minmax(120px, 1fr)";
/** Gleichverteilung, wenn die Woche keinen Spalten-Inhalt hat — füllt das Kalender-Div horizontal. */
const EQUAL_FILL_DAY_COLUMN_WIDTH = "minmax(0, 1fr)";

function gridTemplateColumns(
  areaColumnWidthPx: number,
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
  return [areaColumnGridTrack(areaColumnWidthPx), ...dayColumns].join(" ");
}

function calendarMinWidth(
  areaColumnWidthPx: number,
  dayUsesWideColumn: boolean[],
  narrowDayColumnWidthsPx: number[]
): number {
  return (
    areaColumnWidthPx +
    dayUsesWideColumn.reduce(
      (sum, wide, dayIndex) =>
        sum + (wide ? 120 : narrowDayColumnWidthsPx[dayIndex]),
      0
    )
  );
}

const HOUR_GRID_LINE_OPACITY = 35;

function createHourGridBackgroundStyle(
  lineOpacityPercent: number
): React.CSSProperties {
  const lineColor = `color-mix(in srgb, var(--color-border) ${lineOpacityPercent}%, transparent)`;
  return {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(100% / ${CALENDAR_HOUR_COUNT} - 1px), ${lineColor} calc(100% / ${CALENDAR_HOUR_COUNT} - 1px), ${lineColor} calc(100% / ${CALENDAR_HOUR_COUNT}))`,
  };
}

/** Vergangene Tag-Bereich-Zellen (Arbeitstag). */
const PAST_TAG_AREA_CELL_BG = "#f3f6f9";
const PAST_TAG_AREA_OVERLAY_BG = "#eff3f7";
const PAST_TAG_AREA_HOUR_LINE_COLOR = "#eef2f6";

/** 23 Stunden-Trennlinien zwischen Header- und Footer-Overlay. */
function createPastTagAreaHourGridStyle(): React.CSSProperties {
  const lineColor = PAST_TAG_AREA_HOUR_LINE_COLOR;
  const stops: string[] = ["transparent 0"];
  for (let hour = 1; hour < CALENDAR_HOUR_COUNT; hour += 1) {
    const pos = `calc(100% * ${hour} / ${CALENDAR_HOUR_COUNT})`;
    stops.push(`transparent calc(${pos} - 1px)`);
    stops.push(`${lineColor} calc(${pos} - 1px)`);
    stops.push(`${lineColor} ${pos}`);
  }
  return {
    backgroundImage: `linear-gradient(to right, ${stops.join(", ")})`,
  };
}

const hourGridBackgroundStyle = createHourGridBackgroundStyle(
  HOUR_GRID_LINE_OPACITY
);
const pastTagAreaHourGridStyle = createPastTagAreaHourGridStyle();

/** Feste Header-Höhe (3 Zeilen inkl. Feiertag), damit Wochenwechsel nicht springt. */
const CALENDAR_HEADER_ROW_HEIGHT = "3.5rem";

/** Bereichszeile bei inaktiver Bereichs-Checkbox. */
const EMPTY_AREA_ROW_HEIGHT = "50px";

/** Tag-Bereich-Header-Overlay-Höhe. */
const TAG_AREA_HEADER_STRIP_HEIGHT = "20px";

/** Tag-Bereich-Footer-Streifen-Höhe. */
const TAG_AREA_FOOTER_STRIP_HEIGHT = "18px";

/** Kompakte Einzeilen-Schichtkarte (Name links, Schicht/Zeit rechts). */
const DASHBOARD_SHIFT_CARD_CLASS =
  "flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white shadow-sm";

/** Geschlossener Bereich × Tag (kein Arbeitstag laut Arbeitszeit / Feiertag). */
const CLOSED_AREA_DAY_BG = "#e6edf2";

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

function dayHasScheduleActivityOnDate(
  dateISO: string,
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
  return isAnyAreaOpenInCalendar(serviceHours, areaIds, dateISO, false);
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
      className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border/80 bg-surface px-2 py-1.5 shadow-sm"
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

function ShiftCardEmployeeSwatch({ hex }: { hex: string | null }) {
  if (!hex) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-white/40 bg-transparent"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-white/40"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function dashboardShiftCardTimeLabel(shift: DashboardShiftCard): string {
  const times = formatTimeRange(shift.startTime, shift.endTime);
  if (!shift.shiftName.trim()) return times;
  return `${shortenShiftTypeDisplayName(shift.shiftName)} ${times}`;
}

function DashboardShiftCardView({ shift }: { shift: DashboardShiftCard }) {
  return (
    <div
      className={DASHBOARD_SHIFT_CARD_CLASS}
      style={shiftColorStyle(shift.color)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <ShiftCardEmployeeSwatch hex={shift.employeeColor} />
        <span className="truncate font-medium leading-none">
          {shift.employeeName}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap leading-none tabular-nums opacity-95">
        {dashboardShiftCardTimeLabel(shift)}
      </span>
    </div>
  );
}

/** Vertikale Spalten-Trennung – Bereiche ↔ Tage und Tag ↔ Tag (nicht am Sonntag). */
const COLUMN_DIVIDER_CLASS = "border-r border-slate-300";

/** Rahmen des Kalender-Divs — abschließende Kante rechts (statt Sonntags-Spaltenlinie). */
const CALENDAR_FRAME_CLASS = "border border-slate-300";

/** Horizontale Bereichs-Trennung — gleiche Intensität wie Spalten-Linien. */
const ROW_DIVIDER_CLASS = "border-b border-slate-300";

type AreaDayContextMenuState = {
  x: number;
  y: number;
  areaId: string;
  date: string;
};

const ASSIGN_SHIFT_CONTEXT_MENU_WIDTH_PX = 176;
const ASSIGN_SHIFT_CONTEXT_MENU_HEIGHT_PX = 40;
const CONTEXT_MENU_CLOSE_DISTANCE_PX = 20;

function distanceFromPointToMenu(
  clientX: number,
  clientY: number,
  menu: HTMLElement
): number {
  const rect = menu.getBoundingClientRect();
  const closestX = Math.max(rect.left, Math.min(clientX, rect.right));
  const closestY = Math.max(rect.top, Math.min(clientY, rect.bottom));
  return Math.hypot(clientX - closestX, clientY - closestY);
}

/** Rechtsklick „Schicht zuweisen“: Arbeitstag laut Servicezeiten, Checkboxen aktiv, heute/Zukunft. */
export function canOpenAssignShiftContextMenu(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: AreaServiceHourRef[]
): boolean {
  if (!isAreaActive || !isDayActive) return false;
  if (isPastCalendarDate(dateISO)) return false;
  return isAreaOpenOnDate(serviceHours, areaId, dateISO);
}

function clampContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth = ASSIGN_SHIFT_CONTEXT_MENU_WIDTH_PX,
  menuHeight = ASSIGN_SHIFT_CONTEXT_MENU_HEIGHT_PX
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }
  const padding = 8;
  const maxX = window.innerWidth - menuWidth - padding;
  const maxY = window.innerHeight - menuHeight - padding;
  return {
    x: Math.max(padding, Math.min(clientX, maxX)),
    y: Math.max(padding, Math.min(clientY, maxY)),
  };
}

function createActiveAreaIds(areas: LocationArea[]): Set<string> {
  return new Set(areas.map((area) => area.id));
}

function createActiveDayDates(
  dates: readonly string[],
  areaIds: readonly string[],
  serviceHours: AreaServiceHourRef[],
  shifts: DashboardShiftCard[]
): Set<string> {
  const shiftsByDate = new Map<string, number>();
  for (const shift of shifts) {
    if (!shift.locationAreaId) continue;
    shiftsByDate.set(
      shift.shift_date,
      (shiftsByDate.get(shift.shift_date) ?? 0) + 1
    );
  }
  return new Set(
    dates.filter((date) => {
      const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
      return isAnyAreaOpenInCalendar(serviceHours, areaIds, date, hasShifts);
    })
  );
}

export function DashboardCalendar({
  dates,
  locationId,
  locationName,
  areas,
  serviceHours,
  staffingRules,
  shifts,
  shiftTypes,
  areaShiftTemplates,
  qualifications,
  profiles,
  fullStaffingRules,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);

  const areaIds = useMemo(() => areas.map((area) => area.id), [areas]);

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
        return isAnyAreaOpenInCalendar(
          serviceHours,
          areaIds,
          date,
          hasShifts
        );
      }),
    [dates, serviceHours, areaIds, shiftsByDate]
  );

  const [activeAreaIds, setActiveAreaIds] = useState<Set<string>>(() =>
    createActiveAreaIds(areas)
  );
  const [activeDayDates, setActiveDayDates] = useState<Set<string>>(() =>
    createActiveDayDates(dates, areaIds, serviceHours, shifts)
  );
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<AreaDayContextMenuState | null>(
    null
  );
  const [addShiftDialog, setAddShiftDialog] =
    useState<DashboardAddShiftDialogState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<DashboardBulkShiftDialogState | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setActiveAreaIds(createActiveAreaIds(areas));
  }, [areas]);

  useLayoutEffect(() => {
    setActiveDayDates(createActiveDayDates(dates, areaIds, serviceHours, shifts));
    setIsCalendarVisible(true);
  }, [dates, areaIds, serviceHours, shifts]);

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

  useEffect(() => {
    if (!contextMenu) return;

    function closeMenu() {
      setContextMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onMouseMove(event: MouseEvent) {
      const menu = contextMenuRef.current;
      if (!menu) return;
      if (
        distanceFromPointToMenu(event.clientX, event.clientY, menu) >
        CONTEXT_MENU_CLOSE_DISTANCE_PX
      ) {
        closeMenu();
      }
    }

    document.addEventListener("click", closeMenu);
    document.addEventListener("contextmenu", closeMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("contextmenu", closeMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  const dayUsesWideColumn = useMemo(
    () =>
      dates.map((date, dayIndex) => {
        if (!activeDayDates.has(date)) return false;
        const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
        if (!dayHasOpenArea[dayIndex]) return false;
        const hasStaffing = hasStaffingRequirementInCalendar(
          staffingRules,
          areaIds,
          date,
          serviceHours
        );
        return hasStaffing || hasShifts;
      }),
    [
      dates,
      dayHasOpenArea,
      staffingRules,
      areaIds,
      serviceHours,
      shiftsByDate,
      activeDayDates,
    ]
  );

  /** Kein Tag hat Schichten/Personalbedarf — Spalten gleich breit statt verkleinern. */
  const fillColumnsEqually = useMemo(
    () => !dayUsesWideColumn.some(Boolean),
    [dayUsesWideColumn]
  );

  const holidayNames = useMemo(
    () => buildHolidayNamesByDate(dates, locale === "en" ? "en" : "de"),
    [dates, locale]
  );

  const narrowDayColumnWidthsPx = useMemo(
    () =>
      resolveNarrowDayColumnWidthsPx(dates, holidayNames, intlLocale),
    [dates, holidayNames, intlLocale]
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
        narrowDayColumnWidthsPx,
        fillColumnsEqually
      ),
    [
      areaColumnWidthPx,
      dayUsesWideColumn,
      narrowDayColumnWidthsPx,
      fillColumnsEqually,
    ]
  );

  const minCalendarWidth = useMemo(() => {
    if (fillColumnsEqually) return undefined;
    return calendarMinWidth(
      areaColumnWidthPx,
      dayUsesWideColumn,
      narrowDayColumnWidthsPx
    );
  }, [
    areaColumnWidthPx,
    dayUsesWideColumn,
    narrowDayColumnWidthsPx,
    fillColumnsEqually,
  ]);

  const rowTemplate = useMemo(() => {
    if (areas.length === 0) {
      return `${CALENDAR_HEADER_ROW_HEIGHT} minmax(0, 1fr)`;
    }
    const bodyRows = areas
      .map((area) =>
        activeAreaIds.has(area.id)
          ? "minmax(0, 1fr)"
          : EMPTY_AREA_ROW_HEIGHT
      )
      .join(" ");
    return `${CALENDAR_HEADER_ROW_HEIGHT} ${bodyRows}`;
  }, [areas, activeAreaIds]);

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

  const handleAreaDayContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean
    ) => {
      if (
        !canOpenAssignShiftContextMenu(
          areaId,
          date,
          isAreaActive,
          isDayActive,
          serviceHours
        )
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const { x, y } = clampContextMenuPosition(event.clientX, event.clientY);
      setContextMenu({ x, y, areaId, date });
    },
    [serviceHours]
  );

  const openAddShiftDialog = useCallback(() => {
    if (!contextMenu) return;
    setAddShiftDialog({
      areaId: contextMenu.areaId,
      date: contextMenu.date,
    });
    setContextMenu(null);
  }, [contextMenu]);

  const openBulkShiftDialog = useCallback(() => {
    if (!contextMenu) return;
    setBulkShiftDialog({
      areaId: contextMenu.areaId,
      date: contextMenu.date,
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleShiftSaved = useCallback(() => {
    setUndoVisible(true);
  }, []);

  useEffect(() => {
    if (!undoVisible) return;
    const timer = window.setTimeout(() => setUndoVisible(false), 30_000);
    return () => window.clearTimeout(timer);
  }, [undoVisible]);

  const handleUndo = useCallback(async () => {
    const result = await undoLastShiftAssignBatch();
    if (result.ok) {
      setUndoVisible(false);
      window.location.reload();
    }
  }, []);

  const dayHasScheduleActivity = useMemo(
    () =>
      dates.map((date) =>
        dayHasScheduleActivityOnDate(
          date,
          serviceHours,
          areaIds,
          staffingRules,
          (shiftsByDate.get(date)?.length ?? 0) > 0
        )
      ),
    [dates, serviceHours, areaIds, staffingRules, shiftsByDate]
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
    return fillColumnsEqually
      ? dayHasOpenArea[dayIndex]
      : dayUsesWideColumn[dayIndex];
  };

  const dayColumnDivider = (dayIndex: number) =>
    dayIndex < dates.length - 1 ? COLUMN_DIVIDER_CLASS : undefined;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface shadow-sm",
        CALENDAR_FRAME_CLASS,
        !isCalendarVisible && "invisible"
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
                    dayColumnDivider(dayIndex)
                  )}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: "2 / -1",
                    ...(!dayShowsHourGrid(dayIndex)
                      ? { backgroundColor: CLOSED_AREA_DAY_BG }
                      : undefined),
                    ...(dayShowsHourGrid(dayIndex)
                      ? hourGridBackgroundStyle
                      : undefined),
                  }}
                />
              ))}

              {areas.map((area, rowIndex) => {
                const isLastRow = rowIndex === areas.length - 1;
                const gridRow = rowIndex + 2;
                const isAreaActive = activeAreaIds.has(area.id);
                const isCompactRow = !isAreaActive;

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
                      const isPastAreaWorkDay = isPastAreaWorkDayCell(
                        serviceHours,
                        area.id,
                        date,
                        false
                      );
                      const isOpen = isAreaOpenInCalendar(
                        serviceHours,
                        area.id,
                        date,
                        dayShifts.length > 0
                      );
                      const isDayActive = activeDayDates.has(date);
                      const showOpenDayCell =
                        isAreaActive && isDayActive && isOpen;
                      const showInactivePreviewCell =
                        (!isAreaActive || !isDayActive) &&
                        dayHasScheduleActivity[dayIndex];
                      const showInactivePreviewDummy =
                        showInactivePreviewCell && isCompactRow;
                      const showDayCellContent =
                        showOpenDayCell || showInactivePreviewCell;
                      const isPastWorkDayCell =
                        showDayCellContent && isPastAreaWorkDay;
                      const hasPastStaffingDisplay =
                        isPastWorkDayCell &&
                        areaHasStaffingRequirementOnDate(
                          staffingRules,
                          area.id,
                          date,
                          serviceHours
                        );
                      const showDaytimesGradient = isPastWorkDayCell
                        ? isOpen
                        : showOpenDayCell &&
                          isOpen &&
                          dayHasOpenArea[dayIndex];
                      const headerStaffing = tagAreaHeaderStaffingEntriesInCalendar(
                        staffingRules,
                        area.id,
                        date,
                        serviceHours,
                        dayShifts.map((shift) => ({
                          startTime: shift.startTime,
                          endTime: shift.endTime,
                        }))
                      );

                      return (
                        <div
                          key={date}
                          className={cn(
                            "relative z-10 flex min-h-0 flex-col overflow-hidden",
                            showDayCellContent ? "p-2" : undefined,
                            dayColumnDivider(dayIndex),
                            !isLastRow && ROW_DIVIDER_CLASS
                          )}
                          onContextMenu={(event) =>
                            handleAreaDayContextMenu(
                              event,
                              area.id,
                              date,
                              isAreaActive,
                              isDayActive
                            )
                          }
                          style={{
                            gridColumn: dayIndex + 2,
                            gridRow,
                            ...(isPastWorkDayCell
                              ? { backgroundColor: PAST_TAG_AREA_CELL_BG }
                              : !showDayCellContent
                                ? { backgroundColor: CLOSED_AREA_DAY_BG }
                                : undefined),
                          }}
                        >
                          {showDayCellContent ? (
                            <>
                              <TagAreaHeaderStrip
                                showDaytimesGradient={showDaytimesGradient}
                                entries={headerStaffing}
                                overlayBackgroundColor={
                                  isPastWorkDayCell
                                    ? PAST_TAG_AREA_OVERLAY_BG
                                    : undefined
                                }
                                staffingTone={
                                  !isAreaActive || !isDayActive
                                    ? "inactive"
                                    : hasPastStaffingDisplay
                                      ? "past"
                                      : "default"
                                }
                                style={{ height: TAG_AREA_HEADER_STRIP_HEIGHT }}
                              />
                              <div
                                className={cn(
                                  "absolute inset-x-0 bottom-0 z-20 flex items-center justify-center overflow-hidden border-t border-border px-1",
                                  isPastWorkDayCell ? undefined : "bg-background"
                                )}
                                style={{
                                  height: TAG_AREA_FOOTER_STRIP_HEIGHT,
                                  ...(isPastWorkDayCell
                                    ? { backgroundColor: PAST_TAG_AREA_OVERLAY_BG }
                                    : undefined),
                                }}
                              />
                              <div
                                className="flex h-full min-h-0 flex-col gap-1.5"
                                style={{
                                  paddingTop: TAG_AREA_HEADER_STRIP_HEIGHT,
                                  paddingBottom: TAG_AREA_FOOTER_STRIP_HEIGHT,
                                  ...(isPastWorkDayCell
                                    ? {
                                        backgroundColor: PAST_TAG_AREA_CELL_BG,
                                        ...pastTagAreaHourGridStyle,
                                      }
                                    : undefined),
                                }}
                              >
                                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto">
                                  {showInactivePreviewDummy ? (
                                    <InactiveAreaDummyShiftCard
                                      shiftTypes={shiftTypes}
                                    />
                                  ) : showOpenDayCell ? (
                                    dayShifts.map((shift) => (
                                      <DashboardShiftCardView
                                        key={shift.id}
                                        shift={shift}
                                      />
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
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[11rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={t("dashboard.assignShift")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
            onClick={openAddShiftDialog}
          >
            {t("dashboard.assignShift")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
            onClick={openBulkShiftDialog}
          >
            {t("dashboard.assignMultipleShifts")}
          </button>
        </div>
      ) : null}

      {addShiftDialog && locationId ? (
        <DashboardAddShiftModal
          key={`single:${addShiftDialog.areaId}:${addShiftDialog.date}`}
          dialog={addShiftDialog}
          locationId={locationId}
          areas={areas}
          shiftTypes={shiftTypes}
          areaShiftTemplates={areaShiftTemplates}
          serviceHours={serviceHours}
          onClose={() => setAddShiftDialog(null)}
          onSaved={handleShiftSaved}
        />
      ) : null}

      {bulkShiftDialog && locationId ? (
        <DashboardBulkShiftModal
          key={`bulk:${bulkShiftDialog.areaId}:${bulkShiftDialog.date}`}
          dialog={bulkShiftDialog}
          locationId={locationId}
          locationName={locationName}
          areas={areas}
          shiftTypes={shiftTypes}
          areaShiftTemplates={areaShiftTemplates}
          staffingRules={fullStaffingRules}
          serviceHours={serviceHours}
          qualifications={qualifications}
          areaAssignedShifts={shifts
            .filter(
              (shift) =>
                shift.locationAreaId === bulkShiftDialog.areaId &&
                shift.shift_date === bulkShiftDialog.date
            )
            .map((shift) => ({
              startTime: shift.startTime,
              endTime: shift.endTime,
            }))}
          areaExistingAssignments={shifts
            .filter(
              (shift) =>
                shift.locationAreaId === bulkShiftDialog.areaId &&
                shift.shift_date === bulkShiftDialog.date
            )
            .map((shift) => ({
              employeeId: shift.employeeId,
              startTime: shift.startTime,
              endTime: shift.endTime,
            }))}
          onClose={() => setBulkShiftDialog(null)}
          onSaved={handleShiftSaved}
        />
      ) : null}

      {undoVisible ? (
        <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg">
          <span className="text-sm text-foreground">{t("dashboard.bulkShiftSaved")}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void handleUndo()}>
            {t("dashboard.bulkShiftUndo")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
