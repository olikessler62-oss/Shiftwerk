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
import { useRouter } from "next/navigation";
import { isPastCalendarDate, parseISODate, startOfWeek, toISODate } from "@/lib/dates";
import { buildHolidayNamesByDate, isGermanPublicHoliday } from "@/lib/german-public-holidays";
import { formatDayHeader } from "@/lib/planning-utils";
import { DashboardShiftCardsList } from "@/components/dashboard/dashboard-shift-cards-list";
import { resolveLocationServiceDayTimeline } from "@/lib/shift-card-cell-layout";
import {
  createPastServiceTimelineHourGridStyle,
  createServiceTimelineHourGridStyle,
} from "@/lib/shift-card-service-timeline";
import {
  AREA_ROW_MIN_HEIGHT_PX,
  buildAreaRowGridTrack,
  CALENDAR_HEADER_HEIGHT_PX,
  areaRowRequiredHeightPx,
  cellShiftListNeedsScroll,
  cellShiftListShouldEnableScroll,
  computeAreaRowLayouts,
  findDominantAreaId,
} from "@/lib/shift-card-row-layout";
export type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures } from "@/lib/org-features-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
} from "@schichtwerk/types";
import {
  hasStaffingRequirementInCalendar,
  isAnyAreaOpenInCalendar,
  isAreaOpenInCalendar,
  isAreaOpenOnDate,
  isPastAreaWorkDayCell,
  weekdayIndexFromDate,
  weekdayLabelFromIndex,
  type AreaServiceHourRef,
  type StaffingRule,
} from "@/lib/location-staffing-client";
import {
  areaShiftTemplatesForArea,
  dashboardAssignmentPresetsForArea,
} from "@/lib/dashboard-assignment-presets";
import { computeBulkStaffingHeaderEntries } from "@/lib/bulk-staffing-header";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
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
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";

type Props = {
  weekStart: string;
  dates: string[];
  locationId: string | null;
  locationName: string;
  areas: LocationArea[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: StaffingRule[];
  shifts: DashboardShiftCard[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  fullStaffingRules: LocationAreaStaffing[];
};

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

/** Vergangene Tag-Bereich-Zellen (Arbeitstag). */
const PAST_TAG_AREA_CELL_BG = "#f3f6f9";
const PAST_TAG_AREA_OVERLAY_BG = "#eff3f7";
const PAST_TAG_AREA_HOUR_LINE_COLOR = "#eef2f6";

/** Feste Header-Höhe (3 Zeilen inkl. Feiertag), damit Wochenwechsel nicht springt. */
const CALENDAR_HEADER_ROW_HEIGHT = "3.5rem";

/** Verzögerung vor Ein-/Ausklappen per Checkbox (ms). */
const CALENDAR_LAYOUT_ANIMATION_DELAY_MS = 120;

const CALENDAR_GRID_LAYOUT_TRANSITION_CLASS =
  "transition-[grid-template-columns,grid-template-rows,min-width] duration-[280ms] ease-in-out";

const CALENDAR_CELL_CONTENT_TRANSITION_CLASS =
  "transition-opacity duration-[280ms] ease-in-out";

/** Bereichszeile bei inaktiver Bereichs-Checkbox. */
const EMPTY_AREA_ROW_HEIGHT = `minmax(${AREA_ROW_MIN_HEIGHT_PX}px, ${AREA_ROW_MIN_HEIGHT_PX}px)`;

/** Tag-Bereich-Header: Tageszeit-Verlauf + Bedarf-Overlay. */
const TAG_AREA_HEADER_STRIP_HEIGHT = "20px";

/** Tag-Bereich-Footer-Streifen-Höhe. */
const TAG_AREA_FOOTER_STRIP_HEIGHT = "18px";

/** Geschlossener Bereich × Tag (kein Arbeitstag laut Arbeitszeit / Feiertag). */
const CLOSED_AREA_DAY_BG = "#e6edf2";

/** Header: nur Feiertage und Wochenende (Sa/So). */
const MUTED_DAY_HEADER_CLASS = "bg-calendar-muted-header";

/** Werktag-Header (Mo–Fr, kein Feiertag) — etwas heller als Feiertag/Wochenende. */
const ACTIVE_DAY_HEADER_CLASS = "bg-calendar-active-header";

/** Heute: Tag + Datum in blauer Badge (wie Kalender-Referenz). */
const TODAY_DAY_HEADER_BADGE_CLASS =
  "rounded-sm bg-blue-600 px-1.5 py-0.5 text-white shadow-sm";

const HOLIDAY_DAY_HEADER_LABEL_CLASS =
  "w-full shrink-0 px-0.5 text-center text-[0.625rem] font-medium leading-snug text-blue-600";

/** Erste Spalte (Header-Ecke + Bereichsnamen). */
const AREA_COLUMN_BG_CLASS = "bg-calendar-active-header";

/** Rahmen Header-Zeile (Tag-Infos), linke Bereichsspalte und Kalender-Außenrahmen — mittelgrau. */
const CALENDAR_MEDIUM_BORDER = "border-slate-400";
const CALENDAR_HEADER_ROW_BORDER_CLASS = `border-b ${CALENDAR_MEDIUM_BORDER}`;
const CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS = `border-r ${CALENDAR_MEDIUM_BORDER}`;
const CALENDAR_AREA_COLUMN_ROW_BORDER_CLASS = `border-b ${CALENDAR_MEDIUM_BORDER}`;

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
  areaId,
  areaShiftTemplates,
}: {
  areaId: string;
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
}) {
  const templatesForArea = areaShiftTemplatesForArea(areaId, areaShiftTemplates);
  const lineColors =
    templatesForArea.length > 0
      ? templatesForArea.map((template) => template.color)
      : ["#0d9488", "#f59e0b", "#6366f1"];

  return (
    <div
      className="flex shrink-0 items-center overflow-hidden rounded border border-border/80 bg-surface px-2 py-1.5 shadow-sm"
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

/** Geschlossener Bereich × Tag (kein Arbeitstag laut Arbeitszeit / Feiertag). */
const COLUMN_DIVIDER_CLASS = "border-r border-slate-300";

/** Rahmen des Kalender-Divs — abschließende Kante rechts (statt Sonntags-Spaltenlinie). */
const CALENDAR_FRAME_CLASS = `border ${CALENDAR_MEDIUM_BORDER}`;

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

function resolveCalendarLayoutDayDates(
  dates: readonly string[],
  areaIds: readonly string[],
  serviceHours: AreaServiceHourRef[],
  shifts: DashboardShiftCard[],
  options: {
    weekStart: string;
    currentWeekStart: string;
    todayISO: string;
    savedCurrentWeekExpansion: Set<string> | null;
    isFirstCurrentWeekView: boolean;
  }
): Set<string> {
  const openDays = createActiveDayDates(dates, areaIds, serviceHours, shifts);
  const isCurrentWeek = options.weekStart === options.currentWeekStart;

  if (!isCurrentWeek) {
    return openDays;
  }

  if (options.isFirstCurrentWeekView) {
    const expanded = new Set<string>();
    for (const date of openDays) {
      if (!isPastCalendarDate(date, options.todayISO)) {
        expanded.add(date);
      }
    }
    return expanded;
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

/** Kalender-Ein-/Ausklapp-Zustand nur bei Wochen- oder Standortwechsel zurücksetzen. */
function calendarLayoutScopeKey(
  dates: readonly string[],
  locationId: string | null
): string {
  return `${locationId ?? ""}|${dates.join(",")}`;
}

export function DashboardCalendar({
  weekStart,
  dates,
  locationId,
  locationName,
  areas,
  serviceHours,
  staffingRules,
  shifts,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds: profileQualificationIdsRecord,
  fullStaffingRules,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const features = useOrgFeatures();
  const simplePlanning = !features.areas;
  const intlLocale = toIntlLocale(locale);

  const profileQualificationIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [profileId, qualificationIds] of Object.entries(
      profileQualificationIdsRecord
    )) {
      map.set(profileId, new Set(qualificationIds));
    }
    return map;
  }, [profileQualificationIdsRecord]);

  const qualificationNameById = useMemo(
    () => new Map(qualifications.map((qualification) => [qualification.id, qualification.name])),
    [qualifications]
  );

  const qualificationSortOrder = useMemo(
    () =>
      new Map(
        qualifications.map((qualification) => [
          qualification.id,
          qualification.sort_order,
        ])
      ),
    [qualifications]
  );

  const formatStaffingTimeLabel = useCallback(
    (weekdayLabel: string, startTime: string, endTime: string) =>
      t("dashboard.bulkShiftStaffingPeriodLabel", {
        weekday: weekdayLabel,
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const formatCalendarStaffingTimeLabel = useCallback(
    (startTime: string, endTime: string) =>
      t("dashboard.bulkShiftStaffingCalendarTooltipTimeLabel", {
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const staffingWeekdayLabel = useCallback(
    (weekdayIndex: number) => weekdayLabelFromIndex(weekdayIndex, t),
    [t]
  );

  const areaIds = useMemo(() => areas.map((area) => area.id), [areas]);
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(parseISODate(todayISO))),
    [todayISO]
  );
  const isCurrentWeek = weekStart === currentWeekStart;

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, DashboardShiftCard[]>();
    for (const shift of shifts) {
      if (!simplePlanning && !shift.locationAreaId) continue;
      const list = map.get(shift.shift_date) ?? [];
      list.push(shift);
      map.set(shift.shift_date, list);
    }
    return map;
  }, [shifts, simplePlanning]);

  const dayHasOpenArea = useMemo(
    () =>
      dates.map((date) => {
        if (simplePlanning) return !isPastCalendarDate(date);
        const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
        return isAnyAreaOpenInCalendar(
          serviceHours,
          areaIds,
          date,
          hasShifts
        );
      }),
    [dates, serviceHours, areaIds, shiftsByDate, simplePlanning]
  );

  const [activeAreaIds, setActiveAreaIds] = useState<Set<string>>(() =>
    createActiveAreaIds(areas)
  );
  const [activeDayDates, setActiveDayDates] = useState<Set<string>>(() =>
    createActiveDayDates(dates, areaIds, serviceHours, shifts)
  );
  const [layoutActiveAreaIds, setLayoutActiveAreaIds] = useState<Set<string>>(
    () => createActiveAreaIds(areas)
  );
  const [layoutActiveDayDates, setLayoutActiveDayDates] = useState<Set<string>>(
    () => createActiveDayDates(dates, areaIds, serviceHours, shifts)
  );
  const layoutAreaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarLayoutScopeRef = useRef<string | null>(null);
  const currentWeekDayExpansionRef = useRef<Set<string>>(new Set());
  const hasInitializedCurrentWeekDayLayoutRef = useRef(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<AreaDayContextMenuState | null>(
    null
  );
  const [addShiftDialog, setAddShiftDialog] =
    useState<DashboardAddShiftDialogState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<DashboardBulkShiftDialogState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const clearLayoutAreaTimer = useCallback(() => {
    if (layoutAreaTimerRef.current !== null) {
      clearTimeout(layoutAreaTimerRef.current);
      layoutAreaTimerRef.current = null;
    }
  }, []);

  const clearLayoutDayTimer = useCallback(() => {
    if (layoutDayTimerRef.current !== null) {
      clearTimeout(layoutDayTimerRef.current);
      layoutDayTimerRef.current = null;
    }
  }, []);

  const syncLayoutAreasImmediate = useCallback(
    (next: Set<string>) => {
      clearLayoutAreaTimer();
      setLayoutActiveAreaIds(new Set(next));
    },
    [clearLayoutAreaTimer]
  );

  const syncLayoutDaysImmediate = useCallback(
    (next: Set<string>) => {
      clearLayoutDayTimer();
      setLayoutActiveDayDates(new Set(next));
    },
    [clearLayoutDayTimer]
  );

  const scheduleLayoutAreas = useCallback(
    (next: Set<string>) => {
      clearLayoutAreaTimer();
      layoutAreaTimerRef.current = setTimeout(() => {
        setLayoutActiveAreaIds(new Set(next));
        layoutAreaTimerRef.current = null;
      }, CALENDAR_LAYOUT_ANIMATION_DELAY_MS);
    },
    [clearLayoutAreaTimer]
  );

  const scheduleLayoutDays = useCallback(
    (next: Set<string>) => {
      clearLayoutDayTimer();
      layoutDayTimerRef.current = setTimeout(() => {
        setLayoutActiveDayDates(new Set(next));
        layoutDayTimerRef.current = null;
      }, CALENDAR_LAYOUT_ANIMATION_DELAY_MS);
    },
    [clearLayoutDayTimer]
  );

  useEffect(
    () => () => {
      clearLayoutAreaTimer();
      clearLayoutDayTimer();
    },
    [clearLayoutAreaTimer, clearLayoutDayTimer]
  );

  useLayoutEffect(() => {
    const scopeKey = calendarLayoutScopeKey(dates, locationId);
    if (calendarLayoutScopeRef.current === scopeKey) {
      return;
    }
    calendarLayoutScopeRef.current = scopeKey;

    const nextAreas = createActiveAreaIds(areas);
    const isFirstCurrentWeekView =
      weekStart === currentWeekStart &&
      !hasInitializedCurrentWeekDayLayoutRef.current;
    const nextDays = resolveCalendarLayoutDayDates(
      dates,
      areaIds,
      serviceHours,
      shifts,
      {
        weekStart,
        currentWeekStart,
        todayISO,
        savedCurrentWeekExpansion: isFirstCurrentWeekView
          ? null
          : currentWeekDayExpansionRef.current,
        isFirstCurrentWeekView,
      }
    );
    if (weekStart === currentWeekStart) {
      if (isFirstCurrentWeekView) {
        hasInitializedCurrentWeekDayLayoutRef.current = true;
      }
      currentWeekDayExpansionRef.current = new Set(nextDays);
    }
    setActiveAreaIds(nextAreas);
    setActiveDayDates(nextDays);
    syncLayoutAreasImmediate(nextAreas);
    syncLayoutDaysImmediate(nextDays);
    setIsCalendarVisible(true);
  }, [
    dates,
    weekStart,
    currentWeekStart,
    todayISO,
    locationId,
    areas,
    areaIds,
    serviceHours,
    shifts,
    syncLayoutAreasImmediate,
    syncLayoutDaysImmediate,
  ]);

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
        if (!layoutActiveDayDates.has(date)) return false;
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
      layoutActiveDayDates,
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
    () => resolveNarrowDayColumnWidthsPx(dates, holidayNames, intlLocale),
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

  const toggleAreaActive = useCallback(
    (areaId: string, active: boolean) => {
      setActiveAreaIds((prev) => {
        const next = new Set(prev);
        if (active) next.add(areaId);
        else next.delete(areaId);
        scheduleLayoutAreas(next);
        return next;
      });
    },
    [scheduleLayoutAreas]
  );

  const toggleDayActive = useCallback(
    (date: string, active: boolean) => {
      setActiveDayDates((prev) => {
        const next = new Set(prev);
        if (active) next.add(date);
        else next.delete(date);
        if (isCurrentWeek) {
          currentWeekDayExpansionRef.current = new Set(next);
        }
        scheduleLayoutDays(next);
        return next;
      });
    },
    [isCurrentWeek, scheduleLayoutDays]
  );

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
      areaId: simplePlanning ? null : contextMenu.areaId,
      date: contextMenu.date,
    });
    setContextMenu(null);
  }, [contextMenu, simplePlanning]);

  const openBulkShiftDialog = useCallback(() => {
    if (!contextMenu) return;
    setBulkShiftDialog({
      areaId: contextMenu.areaId,
      date: contextMenu.date,
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleShiftSaved = useCallback(() => {
    router.refresh();
  }, [router]);

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

  const locationServiceTimelinesByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveLocationServiceDayTimeline>>();
    for (const date of dates) {
      map.set(date, resolveLocationServiceDayTimeline(serviceHours, date));
    }
    return map;
  }, [dates, serviceHours]);

  const hourGridStyleByDate = useMemo(() => {
    const map = new Map<string, React.CSSProperties>();
    for (const date of dates) {
      map.set(
        date,
        createServiceTimelineHourGridStyle(
          locationServiceTimelinesByDate.get(date)!,
          HOUR_GRID_LINE_OPACITY
        )
      );
    }
    return map;
  }, [dates, locationServiceTimelinesByDate]);

  const pastHourGridStyleByDate = useMemo(() => {
    const map = new Map<string, React.CSSProperties>();
    for (const date of dates) {
      map.set(
        date,
        createPastServiceTimelineHourGridStyle(
          locationServiceTimelinesByDate.get(date)!,
          PAST_TAG_AREA_HOUR_LINE_COLOR
        )
      );
    }
    return map;
  }, [dates, locationServiceTimelinesByDate]);

  const maxLaneCountByAreaId = useMemo(() => {
    const map = new Map<string, number>();
    for (const area of areas) {
      let max = 0;
      for (const date of dates) {
        if (!layoutActiveDayDates.has(date)) continue;
        const dayShifts = byAreaDate.get(`${area.id}:${date}`) ?? [];
        max = Math.max(max, dayShifts.length);
      }
      map.set(area.id, max);
    }
    return map;
  }, [areas, dates, layoutActiveDayDates, byAreaDate]);

  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const [calendarBodyHeightPx, setCalendarBodyHeightPx] = useState(0);

  useLayoutEffect(() => {
    const scrollRoot = calendarScrollRef.current;
    if (!scrollRoot) return;

    function updateHeight() {
      if (!scrollRoot) return;
      setCalendarBodyHeightPx(
        Math.max(0, scrollRoot.clientHeight - CALENDAR_HEADER_HEIGHT_PX)
      );
    }

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(scrollRoot);
    return () => observer.disconnect();
  }, [areas.length, dates.length, simplePlanning, locationId, layoutActiveAreaIds]);

  useEffect(() => {
    const scrollRoot = calendarScrollRef.current;
    if (!scrollRoot) return;

    const remeasure = () => {
      setCalendarBodyHeightPx(
        Math.max(0, scrollRoot.clientHeight - CALENDAR_HEADER_HEIGHT_PX)
      );
    };

    const timer = window.setTimeout(
      remeasure,
      CALENDAR_LAYOUT_ANIMATION_DELAY_MS + 280
    );
    return () => window.clearTimeout(timer);
  }, [layoutActiveAreaIds]);

  const areaRowLayouts = useMemo(
    () =>
      computeAreaRowLayouts(
        areas,
        layoutActiveAreaIds,
        maxLaneCountByAreaId,
        calendarBodyHeightPx
      ),
    [areas, layoutActiveAreaIds, maxLaneCountByAreaId, calendarBodyHeightPx]
  );

  const dominantAreaId = useMemo(() => {
    const activeAreas = areas.filter((area) => layoutActiveAreaIds.has(area.id));
    const requiredByArea = new Map<string, number>();
    for (const area of areas) {
      if (!layoutActiveAreaIds.has(area.id)) {
        requiredByArea.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
        continue;
      }
      requiredByArea.set(
        area.id,
        areaRowRequiredHeightPx(maxLaneCountByAreaId.get(area.id) ?? 0)
      );
    }
    return findDominantAreaId(activeAreas, requiredByArea);
  }, [areas, layoutActiveAreaIds, maxLaneCountByAreaId]);

  const simplePlanningRowLayout = useMemo(() => {
    const maxLanes = dates.reduce((max, date) => {
      if (!layoutActiveDayDates.has(date)) return max;
      return Math.max(max, (shiftsByDate.get(date) ?? []).length);
    }, 0);
    return computeAreaRowLayouts(
      [{ id: "__simple__" }],
      new Set(["__simple__"]),
      new Map([["__simple__", maxLanes]]),
      calendarBodyHeightPx
    ).get("__simple__");
  }, [calendarBodyHeightPx, dates, layoutActiveDayDates, shiftsByDate]);

  const rowTemplate = useMemo(() => {
    if (simplePlanning && locationId) {
      const layout = simplePlanningRowLayout;
      if (!layout) {
        return `${CALENDAR_HEADER_ROW_HEIGHT} minmax(0, 1fr)`;
      }
      return `${CALENDAR_HEADER_ROW_HEIGHT} ${buildAreaRowGridTrack(layout)}`;
    }
    if (areas.length === 0) {
      return `${CALENDAR_HEADER_ROW_HEIGHT} minmax(0, 1fr)`;
    }
    const bodyRows = areas
      .map((area) => {
        if (!layoutActiveAreaIds.has(area.id)) {
          return EMPTY_AREA_ROW_HEIGHT;
        }
        const layout = areaRowLayouts.get(area.id);
        if (!layout) return "minmax(0, 1fr)";
        return buildAreaRowGridTrack(layout);
      })
      .join(" ");
    return `${CALENDAR_HEADER_ROW_HEIGHT} ${bodyRows}`;
  }, [
    areas,
    areaRowLayouts,
    layoutActiveAreaIds,
    simplePlanning,
    locationId,
    simplePlanningRowLayout,
  ]);

  const dayShowsHourGrid = (dayIndex: number) => {
    const date = dates[dayIndex];
    if (!layoutActiveDayDates.has(date)) return false;
    return fillColumnsEqually
      ? dayHasOpenArea[dayIndex]
      : dayUsesWideColumn[dayIndex];
  };

  const dayColumnDivider = (dayIndex: number) =>
    dayIndex < dates.length - 1 ? COLUMN_DIVIDER_CLASS : undefined;

  const dayHeaderColumnDivider = (dayIndex: number) =>
    dayIndex < dates.length - 1
      ? CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS
      : undefined;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface shadow-sm",
        MODAL_SCROLLBAR_CLASS,
        CALENDAR_FRAME_CLASS,
        !isCalendarVisible && "invisible"
      )}
    >
      <div
        ref={calendarScrollRef}
        className={cn(
          "h-full min-h-0",
          fillColumnsEqually ? "overflow-x-hidden" : "overflow-x-auto",
          "overflow-y-auto"
        )}
      >
        <div
          ref={calendarGridRef}
          className={cn("grid min-h-full", CALENDAR_GRID_LAYOUT_TRANSITION_CLASS)}
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
              CALENDAR_HEADER_ROW_BORDER_CLASS,
              CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS
            )}
            style={{ gridColumn: 1, gridRow: 1 }}
            aria-hidden
          />

          {dates.map((date, dayIndex) => {
            const { weekday, label } = formatDayHeader(date, intlLocale);
            const holiday = holidayNames[date];
            const isHoliday = isGermanPublicHoliday(date);
            const isToday = date === todayISO;
            const mutedHeader = dayHeaderUsesMutedBackground(date, isHoliday);
            return (
              <div
                key={`header-${date}`}
                className={cn(
                  "relative flex min-h-0 flex-col items-center justify-center gap-0.5 overflow-hidden py-1 text-center",
                  CALENDAR_HEADER_ROW_BORDER_CLASS,
                  mutedHeader ? MUTED_DAY_HEADER_CLASS : ACTIVE_DAY_HEADER_CLASS,
                  dayHeaderColumnDivider(dayIndex)
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
                {isToday ? (
                  <div
                    className={cn(
                      TODAY_DAY_HEADER_BADGE_CLASS,
                      "flex shrink-0 flex-col items-center gap-px"
                    )}
                  >
                    <div className="whitespace-nowrap text-xs font-semibold leading-none">
                      {weekday}
                    </div>
                    <div className="whitespace-nowrap text-sm font-medium leading-none">
                      {label}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="shrink-0 whitespace-nowrap text-xs font-semibold leading-none text-muted">
                      {weekday}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-sm font-medium leading-none">
                      {label}
                    </div>
                  </>
                )}
                {holiday ? (
                  <div className={HOLIDAY_DAY_HEADER_LABEL_CLASS}>{holiday}</div>
                ) : null}
              </div>
            );
          })}

          {simplePlanning && locationId ? (
            <>
              <div
                className={cn(
                  "sticky left-0 z-20 h-full min-h-0 pt-[5px] pl-[2px] pr-2",
                  AREA_COLUMN_BG_CLASS,
                  CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS
                )}
                style={{ gridColumn: 1, gridRow: 2 }}
              >
                <p className="truncate whitespace-nowrap text-sm font-semibold leading-[14px]">
                  {locationName}
                </p>
              </div>
              {dates.map((date, dayIndex) => {
                const dayShifts = shiftsByDate.get(date) ?? [];
                const dayReadOnly = isPastCalendarDate(date);
                return (
                  <div
                    key={`simple-${date}`}
                    className={cn(
                      "relative min-h-[4.5rem] p-1",
                      dayColumnDivider(dayIndex),
                      ROW_DIVIDER_CLASS
                    )}
                    style={{ gridColumn: dayIndex + 2, gridRow: 2 }}
                    onContextMenu={(event) => {
                      if (dayReadOnly) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const { x, y } = clampContextMenuPosition(
                        event.clientX,
                        event.clientY
                      );
                      setContextMenu({ x, y, areaId: "", date });
                    }}
                  >
                    <DashboardShiftCardsList
                      shifts={dayShifts}
                      areaId=""
                      dateISO={date}
                      serviceTimeline={locationServiceTimelinesByDate.get(date)!}
                      serviceHours={serviceHours}
                      staffingRules={fullStaffingRules}
                      assignmentPresets={dashboardAssignmentPresetsForArea(
                        areaShiftTemplates
                      )}
                      profileQualificationIds={profileQualificationIdsRecord}
                      qualificationNameById={qualificationNameById}
                      qualificationSortOrder={qualificationSortOrder}
                      needsVerticalScroll={
                        simplePlanningRowLayout
                          ? cellShiftListNeedsScroll(
                              dayShifts.length,
                              simplePlanningRowLayout
                            )
                          : false
                      }
                    />
                  </div>
                );
              })}
            </>
          ) : areas.length === 0 ? (
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
                      ? hourGridStyleByDate.get(date)
                      : undefined),
                  }}
                />
              ))}

              {areas.map((area, rowIndex) => {
                const isLastRow = rowIndex === areas.length - 1;
                const gridRow = rowIndex + 2;
                const isAreaActive = activeAreaIds.has(area.id);
                const isLayoutAreaExpanded = layoutActiveAreaIds.has(area.id);
                const isCompactRow = !isLayoutAreaExpanded;
                const areaRowLayout = areaRowLayouts.get(area.id);

                return (
                  <Fragment key={area.id}>
                    <div
                      className={cn(
                        "sticky left-0 z-20 h-full min-h-0 pt-[5px] pl-[2px] pr-2",
                        AREA_COLUMN_BG_CLASS,
                        CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS,
                        !isLastRow && CALENDAR_AREA_COLUMN_ROW_BORDER_CLASS
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
                      const isDayActive = layoutActiveDayDates.has(date);
                      const isCheckboxDayActive = activeDayDates.has(date);
                      const showOpenDayCell =
                        isLayoutAreaExpanded && isDayActive && isOpen;
                      const showInactivePreviewCell =
                        (!isLayoutAreaExpanded || !isDayActive) &&
                        dayHasScheduleActivity[dayIndex];
                      const showInactivePreviewDummy =
                        showInactivePreviewCell && isCompactRow;
                      const showDayCellContent =
                        showOpenDayCell || showInactivePreviewCell;
                      const isPastWorkDayCell =
                        showDayCellContent && isPastAreaWorkDay;
                      const showDaytimesGradient =
                        isDayActive &&
                        !isPastCalendarDate(date) &&
                        showOpenDayCell &&
                        isOpen &&
                        dayHasOpenArea[dayIndex];
                      const headerStaffing = computeBulkStaffingHeaderEntries({
                        staffingRules: fullStaffingRules,
                        areaId: area.id,
                        dateISO: date,
                        serviceHours,
                        assignments: dayShifts.map((shift) => ({
                          startTime: shift.startTime,
                          endTime: shift.endTime,
                          employeeId: shift.employeeId,
                        })),
                        assignmentPresets: dashboardAssignmentPresetsForArea(
                          areaShiftTemplatesForArea(area.id, areaShiftTemplates)
                        ),
                        qualifications,
                        profileQualificationIds,
                        formatTimeLabel: formatStaffingTimeLabel,
                        weekdayLabel: staffingWeekdayLabel,
                        formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
                      });

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
                              isCheckboxDayActive
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
                                key={`${area.id}:${date}:${dayShifts.map((shift) => shift.id).join(",")}`}
                                showDaytimesGradient={showDaytimesGradient}
                                entries={headerStaffing}
                                overlayBackgroundColor={
                                  isPastWorkDayCell
                                    ? PAST_TAG_AREA_OVERLAY_BG
                                    : undefined
                                }
                                staffingLabelsDimmed={isPastCalendarDate(date)}
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
                                className={cn(
                                  "flex h-0 min-h-0 flex-1 flex-col gap-1.5",
                                  CALENDAR_CELL_CONTENT_TRANSITION_CLASS,
                                  showDayCellContent
                                    ? "opacity-100"
                                    : "pointer-events-none opacity-0"
                                )}
                                style={{
                                  paddingTop: TAG_AREA_HEADER_STRIP_HEIGHT,
                                  paddingBottom: TAG_AREA_FOOTER_STRIP_HEIGHT,
                                  ...(isPastWorkDayCell
                                    ? {
                                        backgroundColor: PAST_TAG_AREA_CELL_BG,
                                        ...pastHourGridStyleByDate.get(date),
                                      }
                                    : undefined),
                                }}
                              >
                                {showInactivePreviewDummy ? (
                                  <div
                                    className={cn(
                                      "flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto",
                                      MODAL_SCROLLBAR_CLASS
                                    )}
                                  >
                                    <InactiveAreaDummyShiftCard
                                      areaId={area.id}
                                      areaShiftTemplates={areaShiftTemplates}
                                    />
                                  </div>
                                ) : showOpenDayCell ? (
                                  <DashboardShiftCardsList
                                    key={`${area.id}:${date}:${areaRowLayout?.heightPx ?? 0}`}
                                    shifts={dayShifts}
                                    areaId={area.id}
                                    dateISO={date}
                                    serviceTimeline={
                                      locationServiceTimelinesByDate.get(date)!
                                    }
                                    serviceHours={serviceHours}
                                    staffingRules={fullStaffingRules}
                                    assignmentPresets={dashboardAssignmentPresetsForArea(
                                      areaShiftTemplatesForArea(area.id, areaShiftTemplates)
                                    )}
                                    profileQualificationIds={profileQualificationIdsRecord}
                                    qualificationNameById={qualificationNameById}
                                    qualificationSortOrder={qualificationSortOrder}
                                    needsVerticalScroll={
                                      areaRowLayout
                                        ? cellShiftListShouldEnableScroll(
                                            dayShifts.length,
                                            areaRowLayout,
                                            {
                                              dominantAreaId,
                                              areaId: area.id,
                                            }
                                          )
                                        : false
                                    }
                                    measureOverflowFallback={
                                      dominantAreaId === area.id
                                    }
                                  />
                                ) : null}
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
          {!simplePlanning ? (
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
              onClick={openBulkShiftDialog}
            >
              {t("dashboard.assignMultipleShifts")}
            </button>
          ) : null}
        </div>
      ) : null}

      {addShiftDialog && locationId ? (
        <DashboardAddShiftModal
          key={`single:${addShiftDialog.areaId ?? "simple"}:${addShiftDialog.date}`}
          dialog={addShiftDialog}
          locationId={locationId}
          areas={areas}
          areaShiftTemplates={areaShiftTemplates}
          serviceHours={serviceHours}
          onClose={() => setAddShiftDialog(null)}
          onSaved={handleShiftSaved}
        />
      ) : null}

      {bulkShiftDialog && locationId && !simplePlanning ? (
        <DashboardBulkShiftModal
          key={`bulk:${bulkShiftDialog.areaId}:${bulkShiftDialog.date}`}
          dialog={bulkShiftDialog}
          locationId={locationId}
          locationName={locationName}
          areas={areas}
          areaShiftTemplates={areaShiftTemplates}
          staffingRules={fullStaffingRules}
          serviceHours={serviceHours}
          qualifications={qualifications}
          existingAreaShifts={shifts
            .filter(
              (shift) =>
                shift.locationAreaId === bulkShiftDialog.areaId &&
                shift.shift_date === bulkShiftDialog.date
            )
            .map((shift) => ({
              id: shift.id,
              employeeId: shift.employeeId,
              startTime: shift.startTime,
              endTime: shift.endTime,
              areaShiftTemplateId: shift.areaShiftTemplateId,
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
          locationDayAssignments={shifts
            .filter((shift) => shift.shift_date === bulkShiftDialog.date)
            .map((shift) => ({
              employeeId: shift.employeeId,
              startTime: shift.startTime,
              endTime: shift.endTime,
              locationAreaId: shift.locationAreaId,
            }))}
          onClose={() => setBulkShiftDialog(null)}
          onSaved={handleShiftSaved}
        />
      ) : null}
    </div>
  );
}
