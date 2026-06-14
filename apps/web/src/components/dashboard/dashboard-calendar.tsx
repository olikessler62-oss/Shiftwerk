"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { isPastCalendarDate, parseISODate, startOfWeek, toISODate } from "@/lib/dates";
import { buildHolidayNamesByDate, isGermanPublicHoliday } from "@/lib/german-public-holidays";
import { formatDayHeader } from "@/lib/planning-utils";
import { DashboardShiftCardsList } from "@/components/dashboard/dashboard-shift-cards-list";
import { CollapsedShiftPreview } from "@/components/dashboard/collapsed-shift-preview";
import { ClosedAreaNoServiceHoursLabel } from "@/components/dashboard/closed-area-no-service-hours-label";
import { NoServiceHoursShiftConfirmModal } from "@/components/dashboard/no-service-hours-shift-confirm-modal";
import { DashboardShiftDeleteConfirmModal } from "@/components/dashboard/dashboard-shift-delete-confirm-modal";
import { removeShift } from "@/app/actions/shifts";
import { translateActionError } from "@/lib/translate-action-error";
import { isPastShiftDate } from "@/lib/planning-readonly";
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
  computeAreaRowLayouts,
} from "@/lib/shift-card-row-layout";
import { isCalendarAreaRowHeightDate, isAreaRowMinimizedFromTodayThroughWeek } from "@/lib/calendar-area-row-height-dates";
import {
  canOpenAssignShiftContextMenu,
  canOpenBulkShiftFromShiftCard,
  canPromptNoServiceHoursShiftAssign,
} from "@/lib/dashboard-area-day-assign";
export type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures, useOrganization } from "@/lib/org-features-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
} from "@schichtwerk/types";
import {
  hasStaffingRequirementInCalendar,
  hasServiceHoursOnDate,
  isAnyAreaOpenInCalendar,
  isAreaOpenInCalendar,
  isAreaOpenOnDate,
  isPastAreaWorkDayCell,
  serviceWeekdayForDate,
  weekdayLabelFromIndex,
  weekdayPluralLabelFromIndex,
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
import {
  computeTagAreaDayFooterStats,
  formatTagAreaFooterLine,
  type DashboardShiftCompensationByKey,
} from "@/lib/tag-area-footer-stats";
import { TagAreaHeaderStrip } from "@/components/dashboard/tag-area-header-strip";
import { TagAreaFooterStrip } from "@/components/dashboard/tag-area-footer-strip";
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
import { sendConfirmationRequestForShift } from "@/app/actions/shift-confirmations";
import { Alert } from "@/components/ui";

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
  shiftCompensation: DashboardShiftCompensationByKey;
  reassignShiftRequest?: DashboardShiftCard | null;
  onReassignShiftHandled?: () => void;
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

/** Bereichszeile bei inaktiver Bereichs-Checkbox — Höhe kommt aus areaRowLayouts. */

/** Tag-Bereich-Header: Tageszeit-Verlauf + Bedarf-Overlay. */
const TAG_AREA_HEADER_STRIP_HEIGHT = "20px";

/** Tag-Bereich-Footer-Streifen-Höhe. */
const TAG_AREA_FOOTER_STRIP_HEIGHT = "18px";

/** Geschlossener Bereich × Tag (kein Arbeitstag laut Arbeitszeit / Feiertag). */
const CLOSED_AREA_DAY_BG = "#e6edf2";

/** Header ohne Servicezeiten an diesem Tag. */
const MUTED_DAY_HEADER_CLASS = "bg-calendar-muted-header";

/** Header mit mindestens einem Servicezeit-Fenster. */
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

type ShiftContextMenuOpenContext = {
  areaId: string;
  date: string;
  isAreaActive: boolean;
  isDayActive: boolean;
  shiftCountInArea: number;
};

type ShiftContextMenuState = ShiftContextMenuOpenContext & {
  x: number;
  y: number;
  shift: DashboardShiftCard;
};

const ASSIGN_SHIFT_CONTEXT_MENU_WIDTH_PX = 176;
const ASSIGN_SHIFT_CONTEXT_MENU_HEIGHT_PX = 40;
const SHIFT_CONTEXT_MENU_ITEM_HEIGHT_PX = 36;
const SHIFT_CONTEXT_MENU_WIDTH_PX = 220;
const CONTEXT_MENU_CLOSE_DISTANCE_PX = 20;

function shiftContextMenuHeightPx(
  shift: DashboardShiftCard,
  shiftConfirmationEnabled: boolean
): number {
  let items = 2;
  if (shiftConfirmationEnabled && shift.confirmationStatus === "proposed") {
    items += 1;
  }
  return items * SHIFT_CONTEXT_MENU_ITEM_HEIGHT_PX + 8;
}

/** Kontextmenü: Single-Schicht vorübergehend ausgeblendet (Logik bleibt erhalten). */
const SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM = false;

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
  shiftCompensation,
  reassignShiftRequest,
  onReassignShiftHandled,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const features = useOrgFeatures();
  const organization = useOrganization();
  const shiftConfirmationEnabled = organization.shift_confirmation_enabled;
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

  const dayHasServiceHours = useMemo(
    () =>
      dates.map((date) =>
        hasServiceHoursOnDate(serviceHours, date, areaIds)
      ),
    [dates, serviceHours, areaIds]
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
  const [shiftContextMenu, setShiftContextMenu] =
    useState<ShiftContextMenuState | null>(null);
  const [confirmationSendError, setConfirmationSendError] = useState<string | null>(
    null
  );
  const [sendConfirmationPending, startSendConfirmation] = useTransition();
  const [shiftDeleteConfirm, setShiftDeleteConfirm] =
    useState<DashboardShiftCard | null>(null);
  const [deleteShiftError, setDeleteShiftError] = useState<string | null>(null);
  const [deleteShiftPending, startDeleteShift] = useTransition();
  const [addShiftDialog, setAddShiftDialog] =
    useState<DashboardAddShiftDialogState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<DashboardBulkShiftDialogState | null>(null);
  const [noServiceHoursConfirm, setNoServiceHoursConfirm] = useState<{
    areaId: string;
    date: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const shiftContextMenuRef = useRef<HTMLDivElement>(null);
  const skipContextMenuCloseRef = useRef(false);
  const skipShiftContextMenuCloseRef = useRef(false);

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

    function onDocumentClick() {
      if (skipContextMenuCloseRef.current) {
        skipContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("contextmenu", closeMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("contextmenu", closeMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!shiftContextMenu) return;

    function closeMenu() {
      setShiftContextMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onMouseMove(event: MouseEvent) {
      const menu = shiftContextMenuRef.current;
      if (!menu) return;
      if (
        distanceFromPointToMenu(event.clientX, event.clientY, menu) >
        CONTEXT_MENU_CLOSE_DISTANCE_PX
      ) {
        closeMenu();
      }
    }

    function onDocumentClick() {
      if (skipShiftContextMenuCloseRef.current) {
        skipShiftContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("contextmenu", closeMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("contextmenu", closeMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [shiftContextMenu]);

  const bindShiftContextMenu = useCallback(
    (openContext: ShiftContextMenuOpenContext) =>
      (shift: DashboardShiftCard, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu(null);
        skipShiftContextMenuCloseRef.current = true;
        const menuHeight = shiftContextMenuHeightPx(shift, shiftConfirmationEnabled);
        const { x, y } = clampContextMenuPosition(
          event.clientX,
          event.clientY,
          SHIFT_CONTEXT_MENU_WIDTH_PX,
          menuHeight
        );
        setShiftContextMenu({ x, y, shift, ...openContext });
      },
    [shiftConfirmationEnabled]
  );

  const handleDeleteShiftMenuClick = useCallback(() => {
    if (!shiftContextMenu) return;
    const { shift } = shiftContextMenu;
    setShiftContextMenu(null);
    setDeleteShiftError(null);
    setShiftDeleteConfirm(shift);
  }, [shiftContextMenu]);

  const handleConfirmDeleteShift = useCallback(() => {
    if (!shiftDeleteConfirm) return;
    const shiftId = shiftDeleteConfirm.id;
    setDeleteShiftError(null);
    startDeleteShift(async () => {
      const result = await removeShift(shiftId);
      if (!result.ok) {
        setDeleteShiftError(translateActionError(result.error, t));
        return;
      }
      setShiftDeleteConfirm(null);
      router.refresh();
    });
  }, [shiftDeleteConfirm, router, t]);

  const handleSendShiftConfirmation = useCallback(() => {
    if (!shiftContextMenu) return;
    const { shift } = shiftContextMenu;
    setShiftContextMenu(null);
    setConfirmationSendError(null);
    startSendConfirmation(async () => {
      const result = await sendConfirmationRequestForShift({
        shiftId: shift.id,
        weekStart,
        locationId: locationId ?? undefined,
      });
      if (!result.ok) {
        setConfirmationSendError(result.error);
        return;
      }
      router.refresh();
    });
  }, [shiftContextMenu, weekStart, locationId, router]);

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

  const showAreaDayContextMenu = useCallback(
    (clientX: number, clientY: number, areaId: string, date: string) => {
      skipContextMenuCloseRef.current = true;
      setShiftContextMenu(null);
      const { x, y } = clampContextMenuPosition(clientX, clientY);
      setContextMenu({ x, y, areaId, date });
    },
    []
  );

  const openBulkShiftDialogForAreaDay = useCallback(
    (
      areaId: string,
      date: string,
      options?: { focusShiftId?: string; withoutServiceHours?: boolean }
    ) => {
      setBulkShiftDialog({
        areaId,
        date,
        focusShiftId: options?.focusShiftId,
        withoutServiceHours:
          options?.withoutServiceHours ??
          !isAreaOpenOnDate(serviceHours, areaId, date),
      });
      setContextMenu(null);
      setNoServiceHoursConfirm(null);
    },
    [serviceHours]
  );

  useEffect(() => {
    if (!reassignShiftRequest) return;
    openBulkShiftDialogForAreaDay(
      reassignShiftRequest.locationAreaId ?? "",
      reassignShiftRequest.shift_date,
      { focusShiftId: reassignShiftRequest.id }
    );
    onReassignShiftHandled?.();
  }, [
    reassignShiftRequest,
    openBulkShiftDialogForAreaDay,
    onReassignShiftHandled,
  ]);

  const handleAreaDayAssignInteraction = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean,
      shiftCountInArea: number
    ) => {
      if (
        canOpenAssignShiftContextMenu(
          areaId,
          date,
          isAreaActive,
          isDayActive,
          serviceHours,
          shiftCountInArea
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        showAreaDayContextMenu(event.clientX, event.clientY, areaId, date);
        return;
      }

      if (
        !simplePlanning &&
        canPromptNoServiceHoursShiftAssign(
          areaId,
          date,
          isAreaActive,
          isDayActive,
          serviceHours,
          shiftCountInArea
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        setNoServiceHoursConfirm({ areaId, date });
      }
    },
    [serviceHours, showAreaDayContextMenu, simplePlanning]
  );

  const handleAreaDayContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean,
      shiftCountInArea: number
    ) => {
      handleAreaDayAssignInteraction(
        event,
        areaId,
        date,
        isAreaActive,
        isDayActive,
        shiftCountInArea
      );
    },
    [handleAreaDayAssignInteraction]
  );

  const handleAreaDayCellClick = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean,
      shiftCountInArea: number
    ) => {
      if ((event.target as HTMLElement).closest("[data-dashboard-shift-card]")) {
        return;
      }
      handleAreaDayAssignInteraction(
        event,
        areaId,
        date,
        isAreaActive,
        isDayActive,
        shiftCountInArea
      );
    },
    [handleAreaDayAssignInteraction]
  );

  const handleShiftCardClick = useCallback(
    (
      shift: DashboardShiftCard,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean,
      shiftCountInArea: number
    ) => {
      if (
        !canOpenBulkShiftFromShiftCard(
          areaId,
          date,
          isAreaActive,
          isDayActive,
          serviceHours,
          shiftCountInArea
        )
      ) {
        return;
      }
      openBulkShiftDialogForAreaDay(areaId, date, { focusShiftId: shift.id });
    },
    [serviceHours, openBulkShiftDialogForAreaDay]
  );

  const handleEditShiftMenuClick = useCallback(() => {
    if (!shiftContextMenu) return;
    const {
      shift,
      areaId,
      date,
      isAreaActive,
      isDayActive,
      shiftCountInArea,
    } = shiftContextMenu;
    setShiftContextMenu(null);
    handleShiftCardClick(
      shift,
      areaId,
      date,
      isAreaActive,
      isDayActive,
      shiftCountInArea
    );
  }, [shiftContextMenu, handleShiftCardClick]);

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
    openBulkShiftDialogForAreaDay(contextMenu.areaId, contextMenu.date);
  }, [contextMenu, openBulkShiftDialogForAreaDay]);

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

  const footerLabelByAreaDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areas) {
      for (const date of dates) {
        const dayShifts = byAreaDate.get(`${area.id}:${date}`) ?? [];
        if (dayShifts.length === 0) continue;
        const stats = computeTagAreaDayFooterStats(dayShifts, shiftCompensation);
        map.set(
          `${area.id}:${date}`,
          formatTagAreaFooterLine(stats, t, localeKey)
        );
      }
    }
    return map;
  }, [areas, dates, byAreaDate, shiftCompensation, t, localeKey]);

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
        if (
          !isCalendarAreaRowHeightDate(date, layoutActiveDayDates, todayISO)
        ) {
          continue;
        }
        const dayShifts = byAreaDate.get(`${area.id}:${date}`) ?? [];
        max = Math.max(max, dayShifts.length);
      }
      map.set(area.id, max);
    }
    return map;
  }, [areas, dates, layoutActiveDayDates, byAreaDate, todayISO]);

  const layoutMinHeightAreaIds = useMemo(() => {
    const set = new Set<string>();
    for (const area of areas) {
      if (!layoutActiveAreaIds.has(area.id)) continue;
      if (
        !isAreaRowMinimizedFromTodayThroughWeek(
          serviceHours,
          area.id,
          dates,
          todayISO,
          (areaId, dateISO) =>
            (byAreaDate.get(`${areaId}:${dateISO}`) ?? []).length
        )
      ) {
        continue;
      }
      set.add(area.id);
    }
    return set;
  }, [areas, dates, layoutActiveAreaIds, byAreaDate, serviceHours, todayISO]);

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
        calendarBodyHeightPx,
        layoutMinHeightAreaIds
      ),
    [
      areas,
      layoutActiveAreaIds,
      maxLaneCountByAreaId,
      calendarBodyHeightPx,
      layoutMinHeightAreaIds,
    ]
  );

  const simplePlanningRowLayout = useMemo(() => {
    const maxLanes = dates.reduce((max, date) => {
      if (
        !isCalendarAreaRowHeightDate(date, layoutActiveDayDates, todayISO)
      ) {
        return max;
      }
      return Math.max(max, (shiftsByDate.get(date) ?? []).length);
    }, 0);
    return computeAreaRowLayouts(
      [{ id: "__simple__" }],
      new Set(["__simple__"]),
      new Map([["__simple__", maxLanes]]),
      calendarBodyHeightPx
    ).get("__simple__");
  }, [
    calendarBodyHeightPx,
    dates,
    layoutActiveDayDates,
    shiftsByDate,
    todayISO,
  ]);

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
          className={cn("grid h-full min-h-0", CALENDAR_GRID_LAYOUT_TRANSITION_CLASS)}
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
            const mutedHeader = !dayHasServiceHours[dayIndex];
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
                const isDayExpanded = layoutActiveDayDates.has(date);
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
                    onClick={(event) => {
                      if (dayReadOnly) return;
                      if (
                        (event.target as HTMLElement).closest(
                          "[data-dashboard-shift-card]"
                        )
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      skipContextMenuCloseRef.current = true;
                      const { x, y } = clampContextMenuPosition(
                        event.clientX,
                        event.clientY
                      );
                      setContextMenu({ x, y, areaId: "", date });
                    }}
                  >
                    {isDayExpanded ? (
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
                        measureOverflowFallback={isDayExpanded}
                        clipVerticalOverflow={false}
                        shiftConfirmationEnabled={shiftConfirmationEnabled}
                        onShiftContextMenu={bindShiftContextMenu({
                          areaId: "",
                          date,
                          isAreaActive: true,
                          isDayActive: activeDayDates.has(date),
                          shiftCountInArea: dayShifts.length,
                        })}
                      />
                    ) : dayShifts.length > 0 ? (
                      <CollapsedShiftPreview
                        shifts={dayShifts}
                        serviceTimeline={locationServiceTimelinesByDate.get(date)!}
                        isPastDay={dayReadOnly}
                        pastDayReferenceShifts={dayReadOnly ? dayShifts : undefined}
                        areaCollapsed={false}
                      />
                    ) : null}
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
                const isCompactRow =
                  !isLayoutAreaExpanded || layoutMinHeightAreaIds.has(area.id);
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
                        dayHasScheduleActivity[dayIndex] &&
                        isOpen;
                      const showDayCellContent =
                        showOpenDayCell || showInactivePreviewCell;
                      const isPastDayCell = isPastCalendarDate(date);
                      const showNoServiceHoursLabel =
                        !isAreaOpenOnDate(serviceHours, area.id, date) &&
                        !showDayCellContent;
                      const showNoServiceHoursInHeader =
                        !isAreaOpenOnDate(serviceHours, area.id, date) &&
                        dayShifts.length > 0 &&
                        showDayCellContent;
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
                              isCheckboxDayActive,
                              dayShifts.length
                            )
                          }
                          onClick={(event) =>
                            handleAreaDayCellClick(
                              event,
                              area.id,
                              date,
                              isAreaActive,
                              isCheckboxDayActive,
                              dayShifts.length
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
                                noServiceHoursLabel={
                                  showNoServiceHoursInHeader
                                    ? t("dashboard.noServiceHours")
                                    : undefined
                                }
                                noServiceHoursTooltip={
                                  showNoServiceHoursInHeader
                                    ? t("dashboard.noServiceHoursHeaderTooltip", {
                                        weekday: weekdayPluralLabelFromIndex(
                                          serviceWeekdayForDate(date),
                                          t
                                        ),
                                      })
                                    : undefined
                                }
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
                              >
                                {dayShifts.length > 0 ? (
                                  <TagAreaFooterStrip
                                    label={
                                      footerLabelByAreaDate.get(
                                        `${area.id}:${date}`
                                      ) ?? ""
                                    }
                                  />
                                ) : null}
                              </div>
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
                                {showOpenDayCell ? (
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
                                        ? cellShiftListNeedsScroll(
                                            dayShifts.length,
                                            areaRowLayout
                                          )
                                        : false
                                    }
                                    measureOverflowFallback
                                    clipVerticalOverflow={false}
                                    onShiftClick={(shift) =>
                                      handleShiftCardClick(
                                        shift,
                                        area.id,
                                        date,
                                        isAreaActive,
                                        isCheckboxDayActive,
                                        dayShifts.length
                                      )
                                    }
                                    shiftConfirmationEnabled={shiftConfirmationEnabled}
                                    onShiftContextMenu={bindShiftContextMenu({
                                      areaId: area.id,
                                      date,
                                      isAreaActive,
                                      isDayActive: isCheckboxDayActive,
                                      shiftCountInArea: dayShifts.length,
                                    })}
                                  />
                                ) : showInactivePreviewCell && dayShifts.length > 0 ? (
                                  <CollapsedShiftPreview
                                    shifts={dayShifts}
                                    serviceTimeline={
                                      locationServiceTimelinesByDate.get(date)!
                                    }
                                    isPastDay={isPastCalendarDate(date)}
                                    pastDayReferenceShifts={
                                      isPastCalendarDate(date)
                                        ? shiftsByDate.get(date) ?? []
                                        : undefined
                                    }
                                    areaCollapsed={isCompactRow}
                                  />
                                ) : null}
                              </div>
                            </>
                          ) : null}
                          {showNoServiceHoursLabel ? (
                            <ClosedAreaNoServiceHoursLabel
                              label={t("dashboard.noServiceHours")}
                            />
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

      {contextMenu &&
      (SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM || !simplePlanning) ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[11rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={t("dashboard.assignMultipleShifts")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM ? (
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
              onClick={openAddShiftDialog}
            >
              {t("dashboard.assignShift")}
            </button>
          ) : null}
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

      {shiftContextMenu ? (
        <div
          ref={shiftContextMenuRef}
          className="fixed z-[100] min-w-[11rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
          style={{ left: shiftContextMenu.x, top: shiftContextMenu.y }}
          role="menu"
          aria-label={t("dashboard.editShift")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleEditShiftMenuClick}
            disabled={
              !canOpenBulkShiftFromShiftCard(
                shiftContextMenu.areaId,
                shiftContextMenu.date,
                shiftContextMenu.isAreaActive,
                shiftContextMenu.isDayActive,
                serviceHours,
                shiftContextMenu.shiftCountInArea
              )
            }
          >
            {t("dashboard.editShift")}
          </button>
          {shiftConfirmationEnabled &&
          shiftContextMenu.shift.confirmationStatus === "proposed" ? (
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSendShiftConfirmation}
              disabled={sendConfirmationPending}
            >
              {t("shiftConfirmation.actions.requestConfirmation")}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleDeleteShiftMenuClick}
            disabled={
              deleteShiftPending ||
              isPastShiftDate(shiftContextMenu.shift.shift_date)
            }
          >
            {t("dashboard.deleteShift")}
          </button>
        </div>
      ) : null}

      {shiftDeleteConfirm ? (
        <DashboardShiftDeleteConfirmModal
          pending={deleteShiftPending}
          onCancel={() => {
            if (deleteShiftPending) return;
            setShiftDeleteConfirm(null);
          }}
          onConfirm={handleConfirmDeleteShift}
        />
      ) : null}

      {deleteShiftError ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[110] w-full max-w-md -translate-x-1/2 px-4">
          <Alert variant="error" className="pointer-events-auto shadow-lg">
            {deleteShiftError}
          </Alert>
        </div>
      ) : null}

      {confirmationSendError ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[110] w-full max-w-md -translate-x-1/2 px-4">
          <Alert variant="error" className="pointer-events-auto shadow-lg">
            {confirmationSendError}
          </Alert>
        </div>
      ) : null}

      {noServiceHoursConfirm ? (
        <NoServiceHoursShiftConfirmModal
          areaName={
            areas.find((area) => area.id === noServiceHoursConfirm.areaId)
              ?.name ?? ""
          }
          onCancel={() => setNoServiceHoursConfirm(null)}
          onConfirm={() =>
            openBulkShiftDialogForAreaDay(
              noServiceHoursConfirm.areaId,
              noServiceHoursConfirm.date,
              { withoutServiceHours: true }
            )
          }
        />
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
          key={`bulk:${bulkShiftDialog.areaId}:${bulkShiftDialog.date}:${bulkShiftDialog.focusShiftId ?? ""}:${bulkShiftDialog.withoutServiceHours ? "nosh" : "sh"}`}
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
