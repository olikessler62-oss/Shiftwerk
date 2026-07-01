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
import { buildHolidayNamesByDate } from "@/lib/german-public-holidays";
import {
  CALENDAR_DAY_HEADER_ACTIVE_CLASS,
  CALENDAR_DAY_HEADER_CELL_CLASS,
  CALENDAR_DAY_HEADER_MUTED_CLASS,
  CALENDAR_DAY_HEADER_ROW_HEIGHT,
  CALENDAR_DAY_HEADER_ROW_HEIGHT_PX,
  CALENDAR_HOLIDAY_DAY_HEADER_LABEL_CLASS,
  CALENDAR_TODAY_DAY_HEADER_BADGE_CLASS,
} from "@/lib/calendar-day-header-styles";
import { formatDayHeader, weeklySummary } from "@/lib/planning-utils";
import { shiftAssignWeekShiftsFromAreaCalendarCards } from "@/lib/weekly-hours-check-shifts";
import {
  PLANNING_ACTIVE_DAY_CELL_BG,
  PLANNING_ACTIVE_DAY_OVERLAY_BG,
  PLANNING_PAST_STAFFING_HEADER_BG,
  PLANNING_STAFFING_HEADER_BG,
  PLANNING_CLOSED_DAY_CELL_BG,
  PLANNING_DAY_FOOTER_ROW_HEIGHT,
  PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
  PLANNING_PAST_DAY_CELL_BG,
  TAG_AREA_HEADER_STRIP_HEIGHT,
  dayHasServiceHoursFlagsForAreas,
  resolveAreaCalendarLayoutDayDates,
  shiftCountByDateForAreas,
} from "@/lib/planning-calendar-layout";
import { DashboardWeeklySummaryFooter } from "@/components/dashboard/dashboard-weekly-summary-footer";
import { AreaCalendarShiftCardsList } from "@/components/areacalendar/areacalendar-shift-cards-list";
import { CollapsedShiftPreview } from "@/components/areacalendar/collapsed-shift-preview";
import { AreaCalendarAreaRowOvernightOverlay } from "@/components/areacalendar/areacalendar-area-row-overnight-overlay";
import { ClosedAreaNoServiceHoursLabel } from "@/components/areacalendar/closed-area-no-service-hours-label";
import { NoServiceHoursShiftConfirmModal } from "@/components/areacalendar/no-service-hours-shift-confirm-modal";
import { AreaCalendarShiftDeleteConfirmModal } from "@/components/areacalendar/areacalendar-shift-delete-confirm-modal";
import { ShiftCancelConfirmModal } from "@/components/shifts/shift-cancel-confirm-modal";
import { removeShift } from "@/app/actions/shifts";
import { cancelShiftAsManager, confirmPastShiftAsManager, submitCommunicationConfirmationRequests } from "@/app/actions/shift-confirmations";
import { translateActionError } from "@/lib/translate-action-error";
import {
  AREA_CALENDAR_DAY_CONTEXT_MENU_WIDTH_PX,
  AREA_SHIFT_CONTEXT_MENU_WIDTH_PX,
  DASHBOARD_CELL_CONTEXT_MENU_WIDTH_PX,
  PLANNING_CONTEXT_MENU_SURFACE_CLASS,
  useClampedContextMenuPosition,
} from "@/lib/context-menu-position";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";
import {
  canOpenShiftCardContextMenu,
  planningShiftCardShowsPointerCursor,
  shiftCardContextMenuActionLabelKey,
  shiftCardContextMenuActions,
  type ShiftCardContextMenuAction,
} from "@/lib/shift-card-context-menu-actions";
import { createPlanningAreaNameById } from "@/lib/planning-shift-card-display";
import {
  resolveShiftCardInteractionContext,
  resolveShiftCardPrimaryClick,
} from "@/lib/shift-card-interaction-policy";
import {
  canDeleteShift,
  shiftDeleteBlockedMessage,
} from "@/lib/shift-deletion-policy";
import { SHIFT_CANCEL_PAST_ERROR } from "@schichtwerk/database";
import {
  canCancelShift,
  translatePastConfirmError,
  translateShiftCancelError,
} from "@/lib/shift-cancellation-policy";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { resolveSingleActiveAreaIds } from "@/lib/resolve-areacalendar-location";
import { resolveAreaCalendarLocationServiceDayTimeline } from "@/lib/areacalendar-service-day-timeline";
import {
  AREA_ROW_MIN_HEIGHT_PX,
  buildAreaRowGridTrack,
  areaRowRequiredHeightPx,
  calendarAvailableBodyHeightPx,
  cellShiftListNeedsScroll,
  computeAreaRowLayouts,
} from "@/lib/shift-card-row-layout";
import { isCalendarAreaRowHeightDate, isCalendarAreaRowPastHeightDate, isAreaRowMinimizedFromTodayThroughWeek, resolveAreaRowHeightLaneCount } from "@/lib/calendar-area-row-height-dates";
import {
  collectAreaCalendarOvernightSpansByArea,
  collectAreaCalendarOvernightSpansForArea,
  collectAreaCalendarIncomingOvernightTailRowsByIndex,
  countAreaCalendarCellVisualRows,
  areaCalendarOvernightAnchorShiftIds,
} from "@/lib/areacalendar-overnight-shift-display";
import { areaCalendarCellDataAttribute } from "@/lib/areacalendar-overnight-span-layout";
import {
  canOpenAssignShiftContextMenu,
  canOpenBulkShiftFromShiftCard,
  canPromptNoServiceHoursShiftAssign,
  canShowAreaDayAssignContextMenu,
  isAreaCalendarAssignDayActive,
} from "@/lib/areacalendar-area-day-assign";
import {
  pickFirstAreaCalendarShiftPerEmployeeDay,
} from "@/lib/simple-calendar-display-toggle";
import { useSimpleCalendarDisplay } from "@/lib/simple-calendar-display-context";
export type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures, useShiftConfirmationPendingAfterMinutes, useShowCompensationInPlanningUi } from "@/lib/org-features-provider";
import {
  useEffectiveShiftConfirmationEnabled,
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";
import { CalendarStaffingEditModal } from "@/components/planning/calendar-staffing-edit-modal";
import { buildCalendarStaffingEditorData } from "@/lib/calendar-staffing-editor-data";
import { mergeStaffingRulesWithOverridesForAreaDate } from "@/lib/staffing-rules-with-overrides";
import { toIntlLocale } from "@/i18n/intl-locale";
import type {
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaStaffingOverride,
} from "@schichtwerk/types";
import {
  areaHasEffectiveServiceHoursOnDate,
  hasStaffingRequirementInCalendar,
  isAnyAreaOpenInCalendar,
  isAreaOpenInCalendar,
  isPastAreaWorkDayCell,
  serviceWeekdayForDate,
  weekdayLabelFromIndex,
  weekdayPluralLabelFromIndex,
  type AreaServiceHourRef,
  type StaffingRule,
} from "@/lib/location-staffing-client";
import {
  areaShiftTemplatesForArea,
  areaCalendarAssignmentPresetsForArea,
} from "@/lib/areacalendar-assignment-presets";
import { computeBulkStaffingHeaderEntries } from "@/lib/bulk-staffing-header";
import { isTagAreaHeaderStaffingHeaderAlertBadge } from "@/lib/tag-area-header-staffing-display";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { CALENDAR_INTERACTION_SURFACE_CLASS, clearDocumentTextSelection } from "@/lib/calendar-interaction-ui";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import {
  CalendarAreaCheckbox,
  CalendarCornerCheckbox,
} from "@/components/areacalendar/calendar-corner-checkbox";
import {
  computeTagAreaDayFooterStatsForDate,
  formatTagAreaFooterLabels,
  type AreaCalendarShiftCompensationByKey,
  type TagAreaFooterStatsOptions,
  type TagAreaShiftRef,
} from "@/lib/tag-area-footer-stats";
import { buildBreaksByTemplateIdFromAreaTemplates } from "@/lib/shift-work-hours";
import { TagAreaHeaderStrip } from "@/components/areacalendar/tag-area-header-strip";
import { buildTagAreaServiceHoursHeaderTooltip } from "@/components/areacalendar/tag-area-header-service-hours-tooltip";
import { TagAreaFooterStrip } from "@/components/areacalendar/tag-area-footer-strip";
import {
  areaColumnGridTrack,
  resolveAreaColumnWidthPx,
} from "@/lib/area-column-width";
import {
  narrowDayColumnGridTrack,
  resolveNarrowDayColumnWidthsPx,
} from "@/lib/day-column-width";
import {
  AreaCalendarAddShiftModal,
  type AreaCalendarAddShiftDialogState,
} from "@/components/areacalendar/areacalendar-add-shift-modal";
import {
  AreaCalendarBulkShiftModal,
  type AreaCalendarBulkShiftDialogState,
} from "@/components/areacalendar/areacalendar-bulk-shift-modal";
import type { LocationAreaStaffing, Profile, Qualification } from "@schichtwerk/types";
import { SettingsMessageModal } from "@/components/settings/settings-message-modal";

type Props = {
  weekStart: string;
  dates: string[];
  locationId: string | null;
  locationName: string;
  showLocationName?: boolean;
  areas: LocationArea[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: StaffingRule[];
  shifts: AreaCalendarShiftCard[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  fullStaffingRules: LocationAreaStaffing[];
  staffingOverrides?: LocationAreaStaffingOverride[];
  selectedLocation: Location | null;
  shiftCompensation: AreaCalendarShiftCompensationByKey;
  profiles: Profile[];
  reassignShiftRequest?: AreaCalendarShiftCard | null;
  onReassignShiftHandled?: () => void;
  highlightedEmployeeId?: string | null;
  onLocalShiftRemoved?: (shiftIds: readonly string[]) => void;
  onLocalShiftRestore?: (shiftIds: readonly string[]) => void;
  onOpenCommunication?: (options?: CommunicationOpenOptions) => void;
  swapRequestShiftIds?: ReadonlySet<string>;
  /** Bereich aus URL (`area=`) — nur dieser Bereich ist initial aktiv. */
  initialActiveAreaId?: string | null;
  onActiveAreaIdsChange?: (activeAreaIds: Set<string>) => void;
  onActiveDayDatesChange?: (activeDayDates: Set<string>) => void;
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

/** Vergangene Tag-Bereich-Zellen (Arbeitstag) — Overlay leicht abgesetzt. */
const PAST_TAG_AREA_OVERLAY_BG = "#eff3f7";

/** Feste Header-Höhe (3 Zeilen inkl. Feiertag), damit Wochenwechsel nicht springt. */

/** Verzögerung vor Ein-/Ausklappen per Checkbox (ms). */
const CALENDAR_LAYOUT_ANIMATION_DELAY_MS = 120;

const CALENDAR_LAYOUT_ROW_TRANSITION_MS = 280;

/** Wartezeit nach Bereichs-Aufklappen, bevor Scroll geprüft wird (CSS-Transition + Puffer). */
const CALENDAR_LAYOUT_ROW_SETTLED_MS = CALENDAR_LAYOUT_ROW_TRANSITION_MS + 32;

const CALENDAR_GRID_LAYOUT_TRANSITION_CLASS =
  "transition-[grid-template-columns,grid-template-rows,min-width] duration-[280ms] ease-in-out";

const CALENDAR_CELL_CONTENT_TRANSITION_CLASS =
  "transition-opacity duration-[280ms] ease-in-out";

/** Einfache Planung ohne Bereiche — Overlay-Schlüssel für Kalenderzellen. */
const SIMPLE_PLANNING_AREA_ID = "";

/** Tag-Bereich-Footer-Streifen-Höhe. */
const TAG_AREA_FOOTER_STRIP_HEIGHT = "22px";

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
  shift: AreaCalendarShiftCard;
};

type StaffingHeaderContextMenuState = {
  x: number;
  y: number;
  areaId: string;
  date: string;
  initialServiceHourId?: string;
};

type StaffingEditDialogState = {
  mode: "temporary" | "permanent";
  areaId: string;
  anchorDate: string;
  initialServiceHourId?: string;
};

const ASSIGN_SHIFT_CONTEXT_MENU_HEIGHT_PX = 40;
const SHIFT_CONTEXT_MENU_ITEM_HEIGHT_PX = 36;
const CONTEXT_MENU_CLOSE_DISTANCE_PX = 20;

function shiftContextMenuHeightPx(
  shift: AreaCalendarShiftCard,
  shiftConfirmationEnabled: boolean
): number {
  const menuOptions = {
    shiftDate: shift.shift_date,
    isPastShiftDate,
    displayState: shift.displayState,
  };
  let items = 0;
  if (shiftConfirmationEnabled) {
    items += shiftCardContextMenuActions(
      shift.confirmationStatus,
      shift.requestedAt,
      menuOptions
    ).length;
  } else {
    items += 1;
  }
  return Math.max(items, 1) * SHIFT_CONTEXT_MENU_ITEM_HEIGHT_PX + 8;
}

/** Kontextmenü: Single-Schicht vorübergehend ausgeblendet (Logik bleibt erhalten). */
const SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM = true;

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
  menuWidth = AREA_CALENDAR_DAY_CONTEXT_MENU_WIDTH_PX,
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

function createInitialActiveAreaIds(
  areas: readonly LocationArea[],
  preferredAreaId?: string | null
): Set<string> {
  return resolveSingleActiveAreaIds(areas, preferredAreaId);
}

/** Kalender-Ein-/Ausklapp-Zustand nur bei Wochen- oder Standortwechsel zurücksetzen. */
function calendarLayoutScopeKey(
  dates: readonly string[],
  locationId: string | null
): string {
  return `${locationId ?? ""}|${dates.join(",")}`;
}

export function AreaCalendar({
  weekStart,
  dates,
  locationId,
  locationName,
  showLocationName = true,
  areas,
  serviceHours,
  staffingRules,
  shifts,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds: profileQualificationIdsRecord,
  fullStaffingRules,
  staffingOverrides = [],
  selectedLocation,
  shiftCompensation,
  profiles,
  reassignShiftRequest,
  onReassignShiftHandled,
  highlightedEmployeeId = null,
  onLocalShiftRemoved,
  onLocalShiftRestore,
  onOpenCommunication,
  swapRequestShiftIds,
  initialActiveAreaId = null,
  onActiveAreaIdsChange,
  onActiveDayDatesChange,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const features = useOrgFeatures();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const pendingAfterMinutes = useShiftConfirmationPendingAfterMinutes();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
  const simplePlanning = !features.areas;
  const intlLocale = toIntlLocale(locale);
  const { simpleCalendarFirstShiftOnly } = useSimpleCalendarDisplay();

  const calendarShifts = useMemo(
    () =>
      simpleCalendarFirstShiftOnly
        ? pickFirstAreaCalendarShiftPerEmployeeDay(shifts)
        : shifts,
    [shifts, simpleCalendarFirstShiftOnly]
  );

  const weekShiftsForAssignment = useMemo(
    () => shiftAssignWeekShiftsFromAreaCalendarCards(shifts),
    [shifts]
  );

  const profileQualificationIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [profileId, qualificationIds] of Object.entries(
      profileQualificationIdsRecord
    )) {
      map.set(profileId, new Set(qualificationIds));
    }
    return map;
  }, [profileQualificationIdsRecord]);

  const employeeNameById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.full_name])),
    [profiles]
  );

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

  const areaNameById = useMemo(
    () => createPlanningAreaNameById(areas),
    [areas]
  );

  const formatStaffingTimeLabel = useCallback(
    (weekdayLabel: string, startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingPeriodLabel", {
        weekday: weekdayLabel,
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const formatCalendarStaffingTimeLabel = useCallback(
    (startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingCalendarTooltipTimeLabel", {
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const staffingWeekdayLabel = useCallback(
    (weekdayIndex: number) => weekdayLabelFromIndex(weekdayIndex, t),
    [t]
  );

  const tagAreaHeaderServiceHoursTooltip = useCallback(
    (
      areaId: string,
      areaName: string,
      date: string,
      showNoServiceHoursInHeader: boolean
    ) =>
      buildTagAreaServiceHoursHeaderTooltip({
        t,
        intlLocale,
        locale: localeKey,
        areaId,
        areaName,
        date,
        serviceHours,
        shiftTemplates: areaShiftTemplatesForArea(areaId, areaShiftTemplates),
        showNoServiceHoursInHeader,
      }),
    [areaShiftTemplates, intlLocale, localeKey, serviceHours, t]
  );

  const areaIds = useMemo(() => areas.map((area) => area.id), [areas]);
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(parseISODate(todayISO))),
    [todayISO]
  );
  const isCurrentWeek = weekStart === currentWeekStart;

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, AreaCalendarShiftCard[]>();
    for (const shift of calendarShifts) {
      if (!simplePlanning && !shift.locationAreaId) continue;
      const list = map.get(shift.shift_date) ?? [];
      list.push(shift);
      map.set(shift.shift_date, list);
    }
    return map;
  }, [calendarShifts, simplePlanning]);

  const [activeAreaIds, setActiveAreaIds] = useState<Set<string>>(
    () => createInitialActiveAreaIds(areas, initialActiveAreaId)
  );

  const shiftCountByDate = useMemo(
    () => shiftCountByDateForAreas(shiftsByDate, activeAreaIds),
    [shiftsByDate, activeAreaIds]
  );

  const dayHasOpenArea = useMemo(
    () =>
      dates.map((date) => {
        if (simplePlanning) return !isPastCalendarDate(date);
        const activeAreaIdList = [...activeAreaIds];
        const hasShifts = (shiftsByDate.get(date) ?? []).some(
          (shift) =>
            shift.locationAreaId && activeAreaIds.has(shift.locationAreaId)
        );
        return isAnyAreaOpenInCalendar(
          serviceHours,
          activeAreaIdList,
          date,
          hasShifts
        );
      }),
    [dates, serviceHours, activeAreaIds, shiftsByDate, simplePlanning]
  );

  const dayHasServiceHours = useMemo(
    () => dayHasServiceHoursFlagsForAreas(dates, serviceHours, [...activeAreaIds]),
    [dates, serviceHours, activeAreaIds]
  );

  useEffect(() => {
    onActiveAreaIdsChange?.(activeAreaIds);
  }, [activeAreaIds, onActiveAreaIdsChange]);

  const [activeDayDates, setActiveDayDates] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    onActiveDayDatesChange?.(activeDayDates);
  }, [activeDayDates, onActiveDayDatesChange]);

  const [layoutActiveAreaIds, setLayoutActiveAreaIds] = useState<Set<string>>(
    () => createInitialActiveAreaIds(areas, initialActiveAreaId)
  );
  const [layoutActiveDayDates, setLayoutActiveDayDates] = useState<Set<string>>(
    () => new Set()
  );
  const layoutAreaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarLayoutScopeRef = useRef<string | null>(null);
  const weekDayExpansionRef = useRef<Map<string, Set<string>>>(new Map());
  const userExpandedNoServiceWeekdaysRef = useRef<Set<number>>(new Set());
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [layoutTransitionEnabled, setLayoutTransitionEnabled] = useState(false);
  const prevLayoutActiveAreaIdsRef = useRef<Set<string> | null>(null);
  const [scrollDeferredAreaIds, setScrollDeferredAreaIds] = useState<
    Set<string>
  >(() => new Set());
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
    useState<AreaCalendarShiftCard | null>(null);
  const [deleteShiftError, setDeleteShiftError] = useState<string | null>(null);
  const [deleteShiftPending, startDeleteShift] = useTransition();
  const [shiftCancelConfirm, setShiftCancelConfirm] =
    useState<AreaCalendarShiftCard | null>(null);
  const [cancelShiftError, setCancelShiftError] = useState<string | null>(null);
  const [cancelShiftPending, startCancelShift] = useTransition();
  const [confirmShiftError, setConfirmShiftError] = useState<string | null>(null);
  const [confirmShiftPending, startConfirmShift] = useTransition();
  const [addShiftDialog, setAddShiftDialog] =
    useState<AreaCalendarAddShiftDialogState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<AreaCalendarBulkShiftDialogState | null>(null);
  const [noServiceHoursConfirm, setNoServiceHoursConfirm] = useState<{
    areaId: string;
    date: string;
    action: "bulk" | "add";
  } | null>(null);
  const [staffingHeaderContextMenu, setStaffingHeaderContextMenu] =
    useState<StaffingHeaderContextMenuState | null>(null);
  const [staffingEditDialog, setStaffingEditDialog] =
    useState<StaffingEditDialogState | null>(null);
  useAppShellModalLockActive(
    Boolean(addShiftDialog) ||
      Boolean(bulkShiftDialog) ||
      Boolean(shiftDeleteConfirm) ||
      Boolean(shiftCancelConfirm) ||
      Boolean(noServiceHoursConfirm) ||
      Boolean(staffingEditDialog)
  );
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const shiftContextMenuRef = useRef<HTMLDivElement>(null);
  const staffingHeaderContextMenuRef = useRef<HTMLDivElement>(null);
  const skipContextMenuCloseRef = useRef(false);
  const skipShiftContextMenuCloseRef = useRef(false);
  const skipStaffingHeaderContextMenuCloseRef = useRef(false);
  const staffingHeaderContextMenuOpenedAtRef = useRef(0);

  const clampedAreaDayContextMenuPosition = useClampedContextMenuPosition(
    contextMenu != null,
    contextMenu?.x ?? 0,
    contextMenu?.y ?? 0,
    contextMenuRef,
    [contextMenu, simplePlanning, SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM]
  );

  const clampedShiftContextMenuPosition = useClampedContextMenuPosition(
    shiftContextMenu != null,
    shiftContextMenu?.x ?? 0,
    shiftContextMenu?.y ?? 0,
    shiftContextMenuRef,
    [shiftContextMenu, shiftConfirmationEnabled]
  );

  const clampedStaffingHeaderContextMenuPosition = useClampedContextMenuPosition(
    staffingHeaderContextMenu != null,
    staffingHeaderContextMenu?.x ?? 0,
    staffingHeaderContextMenu?.y ?? 0,
    staffingHeaderContextMenuRef,
    [staffingHeaderContextMenu]
  );

  const rulesForAreaDate = useCallback(
    (areaId: string, dateISO: string) =>
      mergeStaffingRulesWithOverridesForAreaDate(
        fullStaffingRules,
        staffingOverrides,
        areaId,
        dateISO
      ),
    [fullStaffingRules, staffingOverrides]
  );

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

  useEffect(() => {
    const prev = prevLayoutActiveAreaIdsRef.current ?? layoutActiveAreaIds;
    const newlyExpandedLayoutAreas = [...layoutActiveAreaIds].filter(
      (id) => !prev.has(id)
    );
    prevLayoutActiveAreaIdsRef.current = new Set(layoutActiveAreaIds);

    if (newlyExpandedLayoutAreas.length === 0) return;

    setScrollDeferredAreaIds((current) => {
      const next = new Set(current);
      for (const id of newlyExpandedLayoutAreas) next.add(id);
      return next;
    });

    const timer = window.setTimeout(() => {
      setScrollDeferredAreaIds((current) => {
        const next = new Set(current);
        for (const id of newlyExpandedLayoutAreas) next.delete(id);
        return next;
      });
    }, CALENDAR_LAYOUT_ROW_SETTLED_MS);

    return () => window.clearTimeout(timer);
  }, [layoutActiveAreaIds]);

  useLayoutEffect(() => {
    const scopeKey = calendarLayoutScopeKey(dates, locationId);
    if (calendarLayoutScopeRef.current === scopeKey) {
      return;
    }
    calendarLayoutScopeRef.current = scopeKey;

    const nextAreas = createInitialActiveAreaIds(areas, initialActiveAreaId);
    const nextDays = resolveAreaCalendarLayoutDayDates(
      dates,
      serviceHours,
      shiftsByDate,
      [...nextAreas],
      userExpandedNoServiceWeekdaysRef.current,
      {
        weekStart,
        currentWeekStart,
        todayISO,
        savedWeekExpansion: weekDayExpansionRef.current.get(weekStart),
      }
    );
    weekDayExpansionRef.current.set(weekStart, new Set(nextDays));
    setLayoutTransitionEnabled(false);
    prevLayoutActiveAreaIdsRef.current = null;
    setScrollDeferredAreaIds(new Set());
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
    serviceHours,
    shiftsByDate,
    initialActiveAreaId,
    syncLayoutAreasImmediate,
    syncLayoutDaysImmediate,
  ]);

  useEffect(() => {
    if (activeAreaIds.size === 0) return;

    const nextDays = resolveAreaCalendarLayoutDayDates(
      dates,
      serviceHours,
      shiftsByDate,
      [...activeAreaIds],
      userExpandedNoServiceWeekdaysRef.current,
      {
        weekStart,
        currentWeekStart,
        todayISO,
        savedWeekExpansion: weekDayExpansionRef.current.get(weekStart),
      }
    );
    weekDayExpansionRef.current.set(weekStart, new Set(nextDays));
    setActiveDayDates(nextDays);
    syncLayoutDaysImmediate(nextDays);
  }, [
    activeAreaIds,
    dates,
    serviceHours,
    shiftsByDate,
    weekStart,
    currentWeekStart,
    todayISO,
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

  useEffect(() => {
    if (!staffingHeaderContextMenu) return;

    function closeMenu() {
      setStaffingHeaderContextMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onMouseMove(event: MouseEvent) {
      if (
        performance.now() - staffingHeaderContextMenuOpenedAtRef.current < 200
      ) {
        return;
      }
      const menu = staffingHeaderContextMenuRef.current;
      if (!menu) return;
      if (
        distanceFromPointToMenu(event.clientX, event.clientY, menu) >
        CONTEXT_MENU_CLOSE_DISTANCE_PX
      ) {
        closeMenu();
      }
    }

    function onDocumentClick() {
      if (skipStaffingHeaderContextMenuCloseRef.current) {
        skipStaffingHeaderContextMenuCloseRef.current = false;
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
  }, [staffingHeaderContextMenu]);

  const bindShiftContextMenu = useCallback(
    (openContext: ShiftContextMenuOpenContext) =>
      (shift: AreaCalendarShiftCard, event: React.MouseEvent) => {
        const menuOptions = {
          shiftDate: shift.shift_date,
          cellDate: openContext.date,
          isPastShiftDate,
          displayState: shift.displayState,
        };
        if (
          !canOpenShiftCardContextMenu(
            shift.confirmationStatus,
            shift.requestedAt,
            {
              ...menuOptions,
              legacyDeleteFallback: !shiftConfirmationEnabled,
            }
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        setContextMenu(null);
        skipShiftContextMenuCloseRef.current = true;
        const menuHeight = shiftContextMenuHeightPx(
          shift,
          shiftConfirmationEnabled
        );
        const { x, y } = clampContextMenuPosition(
          event.clientX,
          event.clientY,
          AREA_SHIFT_CONTEXT_MENU_WIDTH_PX,
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
    setShiftDeleteConfirm(null);

    if (
      !canDeleteShift({
        shiftDate: shift.shift_date,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate,
        pendingAfterMinutes,
      })
    ) {
      setDeleteShiftError(
        shiftDeleteBlockedMessage(shift.confirmationStatus ?? "confirmed", t)
      );
      return;
    }

    setShiftDeleteConfirm(shift);
  }, [shiftContextMenu, t, pendingAfterMinutes]);

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

  const handleCancelShiftMenuClick = useCallback(() => {
    if (!shiftContextMenu) return;
    const { shift } = shiftContextMenu;
    setShiftContextMenu(null);
    setCancelShiftError(null);
    setShiftCancelConfirm(null);

    if (
      !canCancelShift({
        shiftDate: shift.shift_date,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate,
      })
    ) {
      if (isPastShiftDate(shift.shift_date)) {
        setCancelShiftError(
          translateShiftCancelError(SHIFT_CANCEL_PAST_ERROR, t)
        );
      } else {
        setCancelShiftError(
          translateShiftCancelError(
            `SHIFT_CANCEL_BLOCKED:${shift.confirmationStatus ?? "confirmed"}`,
            t
          )
        );
      }
      return;
    }

    setShiftCancelConfirm(shift);
  }, [shiftContextMenu, t]);

  const handleConfirmCancelShift = useCallback(() => {
    if (!shiftCancelConfirm) return;
    const shiftId = shiftCancelConfirm.id;
    setCancelShiftError(null);
    setShiftCancelConfirm(null);
    onLocalShiftRemoved?.([shiftId]);
    startCancelShift(async () => {
      try {
        const result = await cancelShiftAsManager(shiftId);
        if (!result.ok) {
          onLocalShiftRestore?.([shiftId]);
          setCancelShiftError(translateShiftCancelError(result.error, t));
        }
      } catch {
        onLocalShiftRestore?.([shiftId]);
        setCancelShiftError(t("shiftConfirmation.cancel.failed"));
      }
    });
  }, [shiftCancelConfirm, onLocalShiftRemoved, onLocalShiftRestore, t]);

  const dayUsesWideColumn = useMemo(
    () =>
      dates.map((date, dayIndex) => {
        if (!layoutActiveDayDates.has(date)) return false;
        const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0;
        if (!dayHasOpenArea[dayIndex]) {
          return !dayHasServiceHours[dayIndex];
        }
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
      dayHasServiceHours,
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

  const areaColumnHeaderLabel = t("nav.areaCalendar");

  const areaColumnWidthPx = useMemo(
    () =>
      resolveAreaColumnWidthPx(
        areas.map((area) => area.name),
        areaColumnHeaderLabel
      ),
    [areas, areaColumnHeaderLabel]
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
      setLayoutTransitionEnabled(true);
      setActiveAreaIds((prev) => {
        const next = active ? new Set([areaId]) : new Set(prev);
        if (!active) {
          next.delete(areaId);
        }
        scheduleLayoutAreas(next);
        return next;
      });
    },
    [scheduleLayoutAreas]
  );

  const toggleDayActive = useCallback(
    (date: string, active: boolean) => {
      const dayIndex = dates.indexOf(date);
      const hasService =
        dayIndex >= 0 ? dayHasServiceHours[dayIndex] ?? false : false;
      const hasShifts = (shiftCountByDate.get(date) ?? 0) > 0;
      if (!hasService && !hasShifts) {
        const weekday = serviceWeekdayForDate(date);
        if (active) {
          userExpandedNoServiceWeekdaysRef.current.add(weekday);
        } else {
          userExpandedNoServiceWeekdaysRef.current.delete(weekday);
        }
      }

      setLayoutTransitionEnabled(true);
      setActiveDayDates((prev) => {
        const next = new Set(prev);
        if (active) next.add(date);
        else next.delete(date);
        weekDayExpansionRef.current.set(weekStart, new Set(next));
        scheduleLayoutDays(next);
        return next;
      });
    },
    [
      dates,
      dayHasServiceHours,
      shiftCountByDate,
      weekStart,
      scheduleLayoutDays,
    ]
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
      clearDocumentTextSelection();
      setBulkShiftDialog({
        areaId,
        date,
        focusShiftId: options?.focusShiftId,
        withoutServiceHours:
          options?.withoutServiceHours ??
          !areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, date),
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
      shiftCountInArea: number,
      interaction: "click" | "contextmenu"
    ) => {
      const isAssignDayActive = isAreaCalendarAssignDayActive(
        date,
        isDayActive,
        areaId,
        shiftCountInArea,
        serviceHours
      );

      if (!isDayActive && isAssignDayActive) {
        toggleDayActive(date, true);
      }

      if (
        interaction === "contextmenu" &&
        canShowAreaDayAssignContextMenu(
          areaId,
          date,
          isAreaActive,
          isAssignDayActive,
          serviceHours,
          shiftCountInArea,
          simplePlanning
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        showAreaDayContextMenu(event.clientX, event.clientY, areaId, date);
        return;
      }

      if (
        canOpenAssignShiftContextMenu(
          areaId,
          date,
          isAreaActive,
          isAssignDayActive,
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
        interaction === "click" &&
        !simplePlanning &&
        canPromptNoServiceHoursShiftAssign(
          areaId,
          date,
          isAreaActive,
          isAssignDayActive,
          serviceHours,
          shiftCountInArea
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearDocumentTextSelection();
        setNoServiceHoursConfirm({ areaId, date, action: "bulk" });
      }
    },
    [serviceHours, showAreaDayContextMenu, simplePlanning, toggleDayActive]
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
        shiftCountInArea,
        "contextmenu"
      );
    },
    [handleAreaDayAssignInteraction]
  );

  const openStaffingEditDialog = useCallback(
    (mode: StaffingEditDialogState["mode"]) => {
      if (!staffingHeaderContextMenu) return;
      skipStaffingHeaderContextMenuCloseRef.current = true;
      setStaffingEditDialog({
        mode,
        areaId: staffingHeaderContextMenu.areaId,
        anchorDate: staffingHeaderContextMenu.date,
        initialServiceHourId: staffingHeaderContextMenu.initialServiceHourId,
      });
      setStaffingHeaderContextMenu(null);
    },
    [staffingHeaderContextMenu]
  );

  const handleStaffingEditSaved = useCallback(() => {
    setStaffingEditDialog(null);
    router.refresh();
  }, [router]);

  const handleAreaDayCellClick = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean,
      shiftCountInArea: number
    ) => {
      if ((event.target as HTMLElement).closest("[data-areacalendar-shift-card]")) {
        return;
      }
      handleAreaDayAssignInteraction(
        event,
        areaId,
        date,
        isAreaActive,
        isDayActive,
        shiftCountInArea,
        "click"
      );
    },
    [handleAreaDayAssignInteraction]
  );

  const handleShiftCardClick = useCallback(
    (
      shift: AreaCalendarShiftCard,
      areaId: string,
      date: string,
      isAreaActive: boolean,
      isDayActive: boolean,
      shiftCountInArea: number
    ) => {
      const interactionContext = resolveShiftCardInteractionContext(
        {
          id: shift.id,
          shift_date: shift.shift_date,
          confirmationStatus: shift.confirmationStatus,
          requestedAt: shift.requestedAt,
          displayState: shift.displayState,
        },
        date,
        isPastShiftDate,
        {
          shiftConfirmationEnabled,
          hasSwapRequest: swapRequestShiftIds?.has(shift.id),
          pendingAfterMinutes,
        }
      );

      if (
        !planningShiftCardShowsPointerCursor(
          {
            id: shift.id,
            shift_date: shift.shift_date,
            confirmationStatus: shift.confirmationStatus,
            requestedAt: shift.requestedAt,
            displayState: shift.displayState,
          },
          date,
          isPastShiftDate,
          {
            shiftConfirmationEnabled,
            hasSwapRequest: swapRequestShiftIds?.has(shift.id),
            pendingAfterMinutes,
          }
        )
      ) {
        return;
      }

      const primaryClick = resolveShiftCardPrimaryClick(
        {
          id: shift.id,
          shift_date: shift.shift_date,
          confirmationStatus: shift.confirmationStatus,
          requestedAt: shift.requestedAt,
          displayState: shift.displayState,
        },
        interactionContext
      );

      if (primaryClick.kind === "communicationHub") {
        onOpenCommunication?.({
          category: primaryClick.category,
          preselectedShiftIds: [shift.id],
        });
        return;
      }

      if (
        primaryClick.kind === "edit" ||
        primaryClick.kind === "reassign"
      ) {
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
      }
    },
    [
      serviceHours,
      openBulkShiftDialogForAreaDay,
      shiftConfirmationEnabled,
      swapRequestShiftIds,
      onOpenCommunication,
    ]
  );

  const handleReassignShiftMenuClick = useCallback(() => {
    if (!shiftContextMenu) return;
    const { shift, areaId, date } = shiftContextMenu;
    setShiftContextMenu(null);
    openBulkShiftDialogForAreaDay(areaId, date, { focusShiftId: shift.id });
  }, [shiftContextMenu, openBulkShiftDialogForAreaDay]);

  const handleRequestConfirmationMenuClick = useCallback(() => {
    if (!shiftContextMenu) return;
    const { shift } = shiftContextMenu;
    setShiftContextMenu(null);
    setConfirmationSendError(null);
    startSendConfirmation(async () => {
      if (blocksOutboundSend && !simulatedProposedOnAssign) {
        setConfirmationSendError(
          getShiftConfirmationSimulationSendBlockedResult().error
        );
        return;
      }
      const result = await submitCommunicationConfirmationRequests({
        shiftIds: [shift.id],
        weekStart,
        locationId: locationId ?? undefined,
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });
      if (!result.ok) {
        setConfirmationSendError(translateActionError(result.error, t));
        return;
      }
      if (result.sentCount === 0) {
        setConfirmationSendError(
          result.errors[0]
            ? translateActionError(result.errors[0], t)
            : t("shiftConfirmation.send.failed")
        );
        return;
      }
      router.refresh();
    });
  }, [
    shiftContextMenu,
    weekStart,
    locationId,
    router,
    blocksOutboundSend,
    simulatedProposedOnAssign,
    relaxAppRegistrationGate,
    t,
  ]);

  const handleSetConfirmedMenuClick = useCallback(() => {
    if (!shiftContextMenu) return;
    const { shift } = shiftContextMenu;
    setShiftContextMenu(null);
    setConfirmShiftError(null);
    startConfirmShift(async () => {
      const result = await confirmPastShiftAsManager(shift.id);
      if (!result.ok) {
        setConfirmShiftError(translatePastConfirmError(result.error, t));
        return;
      }
      router.refresh();
    });
  }, [shiftContextMenu, router, t]);

  const handleShiftContextMenuAction = useCallback(
    (action: ShiftCardContextMenuAction) => {
      switch (action) {
        case "delete":
          handleDeleteShiftMenuClick();
          break;
        case "cancel":
          handleCancelShiftMenuClick();
          break;
        case "reassign":
          handleReassignShiftMenuClick();
          break;
        case "requestConfirmation":
          handleRequestConfirmationMenuClick();
          break;
        case "setConfirmed":
          handleSetConfirmedMenuClick();
          break;
      }
    },
    [
      handleDeleteShiftMenuClick,
      handleCancelShiftMenuClick,
      handleReassignShiftMenuClick,
      handleRequestConfirmationMenuClick,
      handleSetConfirmedMenuClick,
    ]
  );

  const openAddShiftDialog = useCallback(() => {
    if (!contextMenu) return;
    const { areaId, date } = contextMenu;
    const shiftCountInArea = calendarShifts.filter(
      (shift) => shift.locationAreaId === areaId && shift.shift_date === date
    ).length;
    setContextMenu(null);
    if (
      !simplePlanning &&
      canPromptNoServiceHoursShiftAssign(
        areaId,
        date,
        true,
        true,
        serviceHours,
        shiftCountInArea
      )
    ) {
      setNoServiceHoursConfirm({ areaId, date, action: "add" });
      return;
    }
    setAddShiftDialog({
      areaId: simplePlanning ? null : areaId,
      date,
    });
  }, [contextMenu, simplePlanning, serviceHours, calendarShifts]);

  const openBulkShiftDialog = useCallback(() => {
    if (!contextMenu) return;
    const { areaId, date } = contextMenu;
    const shiftCountInArea = calendarShifts.filter(
      (shift) => shift.locationAreaId === areaId && shift.shift_date === date
    ).length;
    setContextMenu(null);
    if (
      !simplePlanning &&
      canPromptNoServiceHoursShiftAssign(
        areaId,
        date,
        true,
        true,
        serviceHours,
        shiftCountInArea
      )
    ) {
      setNoServiceHoursConfirm({ areaId, date, action: "bulk" });
      return;
    }
    openBulkShiftDialogForAreaDay(areaId, date);
  }, [
    contextMenu,
    simplePlanning,
    serviceHours,
    calendarShifts,
    openBulkShiftDialogForAreaDay,
  ]);

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
    const map = new Map<string, AreaCalendarShiftCard[]>();
    for (const shift of calendarShifts) {
      if (!shift.locationAreaId) continue;
      const key = `${shift.locationAreaId}:${shift.shift_date}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    return map;
  }, [calendarShifts]);

  const overnightSpansByArea = useMemo(
    () => collectAreaCalendarOvernightSpansByArea(areas, dates, calendarShifts),
    [areas, dates, calendarShifts]
  );

  const simplePlanningOvernightSpans = useMemo(
    () =>
      simplePlanning
        ? collectAreaCalendarOvernightSpansForArea(
            SIMPLE_PLANNING_AREA_ID,
            dates,
            calendarShifts
          )
        : [],
    [simplePlanning, dates, calendarShifts]
  );

  const tagAreaShiftRefsByAreaId = useMemo(() => {
    const map = new Map<string, TagAreaShiftRef[]>();
    for (const shift of calendarShifts) {
      if (!shift.locationAreaId) continue;
      const list = map.get(shift.locationAreaId) ?? [];
      list.push({
        employeeId: shift.employeeId,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        area_shift_template_id: shift.areaShiftTemplateId,
        location_area_id: shift.locationAreaId,
      });
      map.set(shift.locationAreaId, list);
    }
    return map;
  }, [calendarShifts]);

  const tagAreaFooterStatsOptions = useMemo<TagAreaFooterStatsOptions>(
    () => ({
      breaksByTemplateId: buildBreaksByTemplateIdFromAreaTemplates(areaShiftTemplates),
      areaShiftTemplates,
    }),
    [areaShiftTemplates]
  );

  const tagAreaShiftRefsAll = useMemo(
    () => [...tagAreaShiftRefsByAreaId.values()].flat(),
    [tagAreaShiftRefsByAreaId]
  );

  const footerLabelsByAreaDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof formatTagAreaFooterLabels>
    >();
    for (const area of areas) {
      const areaShifts = tagAreaShiftRefsByAreaId.get(area.id) ?? [];
      if (areaShifts.length === 0) continue;
      for (const date of dates) {
        const stats = computeTagAreaDayFooterStatsForDate(
          date,
          areaShifts,
          shiftCompensation,
          undefined,
          tagAreaFooterStatsOptions
        );
        if (
          stats.totalHours <= 0 &&
          (showCompensationInPlanningUi ? stats.totalCost <= 0 : true)
        ) {
          continue;
        }
        map.set(
          `${area.id}:${date}`,
          formatTagAreaFooterLabels(stats, t, localeKey, {
            showCompensation: showCompensationInPlanningUi,
          })
        );
      }
    }
    return map;
  }, [areas, dates, tagAreaShiftRefsByAreaId, shiftCompensation, tagAreaFooterStatsOptions, t, localeKey, showCompensationInPlanningUi]);

  const dailyFooterLabelsByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof formatTagAreaFooterLabels>
    >();
    for (const date of dates) {
      const dayShifts = simplePlanning
        ? tagAreaShiftRefsAll
        : areas.flatMap((area) => tagAreaShiftRefsByAreaId.get(area.id) ?? []);
      if (dayShifts.length === 0) continue;
      const stats = computeTagAreaDayFooterStatsForDate(
        date,
        dayShifts,
        shiftCompensation,
        undefined,
        tagAreaFooterStatsOptions
      );
      if (
        stats.totalHours <= 0 &&
        (showCompensationInPlanningUi ? stats.totalCost <= 0 : true)
      ) {
        continue;
      }
      map.set(
        date,
        formatTagAreaFooterLabels(stats, t, localeKey, {
          showCompensation: showCompensationInPlanningUi,
        })
      );
    }
    return map;
  }, [
    areas,
    dates,
    shiftCompensation,
    tagAreaFooterStatsOptions,
    simplePlanning,
    tagAreaShiftRefsAll,
    tagAreaShiftRefsByAreaId,
    t,
    localeKey,
    showCompensationInPlanningUi,
  ]);

  const calendarFooterShifts = useMemo(() => {
    if (simplePlanning) {
      return calendarShifts;
    }
    return areas.flatMap((area) =>
      dates.flatMap((date) => byAreaDate.get(`${area.id}:${date}`) ?? [])
    );
  }, [areas, byAreaDate, calendarShifts, dates, simplePlanning]);

  const weeklySummaryData = useMemo(
    () =>
      weeklySummary(
        calendarFooterShifts.map((shift) => ({
          employee_id: shift.employeeId,
          shift_date: shift.shift_date,
          startTime: shift.startTime,
          endTime: shift.endTime,
        })),
        profiles
      ),
    [calendarFooterShifts, profiles]
  );

  const calendarBodyRowCount = useMemo(() => {
    if (simplePlanning && locationId) return 1;
    if (areas.length === 0) return 1;
    return areas.length;
  }, [areas.length, locationId, simplePlanning]);

  const footerStatsGridRow = 2 + calendarBodyRowCount;
  const footerGridRow = footerStatsGridRow + 1;
  const calendarFooterRowTemplate = `${PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT} ${PLANNING_DAY_FOOTER_ROW_HEIGHT}`;

  const locationServiceTimelinesByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveAreaCalendarLocationServiceDayTimeline>>();
    for (const date of dates) {
      map.set(date, resolveAreaCalendarLocationServiceDayTimeline(serviceHours, date));
    }
    return map;
  }, [dates, serviceHours]);

  const maxLaneCountByAreaId = useMemo(() => {
    const map = new Map<string, number>();

    function maxLanesForAreaOnDates(
      areaId: string,
      includeDate: (date: string) => boolean
    ): number {
      let max = 0;
      const areaOvernightSpans = overnightSpansByArea.get(areaId) ?? [];
      for (const date of dates) {
        if (!includeDate(date)) continue;
        const dayShifts = byAreaDate.get(`${areaId}:${date}`) ?? [];
        const overnightAnchors = areaCalendarOvernightAnchorShiftIds(
          dayShifts,
          dates
        );
        const incomingTailRows = collectAreaCalendarIncomingOvernightTailRowsByIndex(
          areaId,
          date,
          areaOvernightSpans,
          (startDate) => byAreaDate.get(`${areaId}:${startDate}`) ?? []
        );
        max = Math.max(
          max,
          countAreaCalendarCellVisualRows(dayShifts, {
            overnightAnchorShiftIds: overnightAnchors,
            incomingOvernightTailRowsByIndex: incomingTailRows,
          })
        );
      }
      return max;
    }

    for (const area of areas) {
      const futureMax = maxLanesForAreaOnDates(area.id, (date) =>
        isCalendarAreaRowHeightDate(date, layoutActiveDayDates, todayISO)
      );
      const pastMax = maxLanesForAreaOnDates(area.id, (date) =>
        isCalendarAreaRowPastHeightDate(date, layoutActiveDayDates, todayISO)
      );
      map.set(
        area.id,
        resolveAreaRowHeightLaneCount(futureMax, pastMax)
      );
    }
    return map;
  }, [
    areas,
    dates,
    layoutActiveDayDates,
    byAreaDate,
    todayISO,
    overnightSpansByArea,
  ]);

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
        calendarAvailableBodyHeightPx(
          scrollRoot.clientHeight,
          CALENDAR_DAY_HEADER_ROW_HEIGHT_PX
        )
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
        calendarAvailableBodyHeightPx(
          scrollRoot.clientHeight,
          CALENDAR_DAY_HEADER_ROW_HEIGHT_PX
        )
      );
    };

    if (!layoutTransitionEnabled) {
      remeasure();
      return;
    }

    const timer = window.setTimeout(
      remeasure,
      CALENDAR_LAYOUT_ANIMATION_DELAY_MS + CALENDAR_LAYOUT_ROW_TRANSITION_MS
    );
    return () => window.clearTimeout(timer);
  }, [layoutActiveAreaIds, layoutTransitionEnabled]);

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
      const dayShifts = shiftsByDate.get(date) ?? [];
      const overnightAnchors = areaCalendarOvernightAnchorShiftIds(
        dayShifts,
        dates
      );
      const incomingTailRows = collectAreaCalendarIncomingOvernightTailRowsByIndex(
        SIMPLE_PLANNING_AREA_ID,
        date,
        simplePlanningOvernightSpans,
        (startDate) => shiftsByDate.get(startDate) ?? []
      );
      return Math.max(
        max,
        countAreaCalendarCellVisualRows(dayShifts, {
          overnightAnchorShiftIds: overnightAnchors,
          incomingOvernightTailRowsByIndex: incomingTailRows,
        })
      );
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
    simplePlanningOvernightSpans,
    todayISO,
  ]);

  const rowTemplate = useMemo(() => {
    if (simplePlanning && locationId) {
      const layout = simplePlanningRowLayout;
      if (!layout) {
        return `${CALENDAR_DAY_HEADER_ROW_HEIGHT} minmax(0, 1fr) ${calendarFooterRowTemplate}`;
      }
      return `${CALENDAR_DAY_HEADER_ROW_HEIGHT} ${buildAreaRowGridTrack(layout)} ${calendarFooterRowTemplate}`;
    }
    if (areas.length === 0) {
      return `${CALENDAR_DAY_HEADER_ROW_HEIGHT} minmax(0, 1fr) ${calendarFooterRowTemplate}`;
    }
    const bodyRows = areas
      .map((area) => {
        const layout = areaRowLayouts.get(area.id);
        if (!layout) return "minmax(0, 1fr)";
        return buildAreaRowGridTrack(layout);
      })
      .join(" ");
    return `${CALENDAR_DAY_HEADER_ROW_HEIGHT} ${bodyRows} ${calendarFooterRowTemplate}`;
  }, [
    areas,
    areaRowLayouts,
    calendarFooterRowTemplate,
    layoutActiveAreaIds,
    simplePlanning,
    locationId,
    simplePlanningRowLayout,
  ]);

  const dayShowsHourGrid = (dayIndex: number) => {
    const date = dates[dayIndex];
    if (!layoutActiveDayDates.has(date)) return false;
    if (!dayHasServiceHours[dayIndex]) return false;
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
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface shadow-sm",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        CALENDAR_FRAME_CLASS,
        CALENDAR_INTERACTION_SURFACE_CLASS,
        !isCalendarVisible && "invisible"
      )}
    >
      <div
        ref={calendarScrollRef}
        className={cn(
          "h-full min-h-0",
          fillColumnsEqually ? "overflow-x-hidden" : "overflow-x-auto",
          "overflow-y-auto",
          MODAL_SCROLLBAR_CLASS,
          "modal-scrollbar-inline"
        )}
      >
        <div
          ref={calendarGridRef}
          className={cn(
            "grid h-full min-h-0",
            layoutTransitionEnabled && CALENDAR_GRID_LAYOUT_TRANSITION_CLASS
          )}
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
              "sticky left-0 top-0 z-30 flex items-center px-4 text-left text-sm font-semibold tracking-tight text-foreground md:text-[0.9375rem]",
              AREA_COLUMN_BG_CLASS,
              CALENDAR_HEADER_ROW_BORDER_CLASS,
              CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS
            )}
            style={{
              gridColumn: 1,
              gridRow: 1,
              height: CALENDAR_DAY_HEADER_ROW_HEIGHT,
            }}
          >
            <span className="min-w-0 truncate">{areaColumnHeaderLabel}</span>
          </div>

          {dates.map((date, dayIndex) => {
            const { weekday, label } = formatDayHeader(date, intlLocale);
            const holiday = holidayNames[date];
            const isToday = date === todayISO;
            const isPastDay = isPastCalendarDate(date, todayISO);
            const mutedHeader = !dayHasServiceHours[dayIndex];
            return (
              <div
                key={`header-${date}`}
                className={cn(
                  CALENDAR_DAY_HEADER_CELL_CLASS,
                  CALENDAR_HEADER_ROW_BORDER_CLASS,
                  mutedHeader ? CALENDAR_DAY_HEADER_MUTED_CLASS : CALENDAR_DAY_HEADER_ACTIVE_CLASS,
                  dayHeaderColumnDivider(dayIndex)
                )}
                style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
              >
                {dayHasOpenArea[dayIndex] || !dayHasServiceHours[dayIndex] ? (
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
                      CALENDAR_TODAY_DAY_HEADER_BADGE_CLASS,
                      "flex shrink-0 flex-col items-center gap-px"
                    )}
                  >
                    <div className="whitespace-nowrap text-xs font-semibold leading-[14px]">
                      {weekday}
                    </div>
                    <div className="whitespace-nowrap text-sm font-bold leading-tight -mt-px">
                      {label}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="shrink-0 whitespace-nowrap text-xs font-semibold leading-[14px] text-muted">
                      {weekday}
                    </div>
                    <div
                      className={cn(
                        "shrink-0 whitespace-nowrap text-sm font-medium leading-tight -mt-px",
                        isPastDay && "text-muted"
                      )}
                    >
                      {label}
                    </div>
                  </>
                )}
                {holiday ? (
                  <div className={CALENDAR_HOLIDAY_DAY_HEADER_LABEL_CLASS}>{holiday}</div>
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
                  {showLocationName ? locationName : null}
                </p>
              </div>
              {dates.map((date, dayIndex) => {
                const dayShifts = shiftsByDate.get(date) ?? [];
                const overnightAnchors = areaCalendarOvernightAnchorShiftIds(
                  dayShifts,
                  dates
                );
                const incomingOvernightTailRowsByIndex =
                  collectAreaCalendarIncomingOvernightTailRowsByIndex(
                    SIMPLE_PLANNING_AREA_ID,
                    date,
                    simplePlanningOvernightSpans,
                    (startDate) => shiftsByDate.get(startDate) ?? []
                  );
                const dayVisualRowCount = countAreaCalendarCellVisualRows(
                  dayShifts,
                  {
                    overnightAnchorShiftIds: overnightAnchors,
                    incomingOvernightTailRowsByIndex,
                  }
                );
                const dayReadOnly = isPastCalendarDate(date);
                const isDayExpanded = layoutActiveDayDates.has(date);
                return (
                  <div
                    key={`simple-${date}`}
                    data-areacalendar-cell={areaCalendarCellDataAttribute(
                      SIMPLE_PLANNING_AREA_ID,
                      date
                    )}
                    className={cn(
                      "relative min-h-[4.5rem] p-1",
                      dayColumnDivider(dayIndex),
                      ROW_DIVIDER_CLASS
                    )}
                    style={{
                      gridColumn: dayIndex + 2,
                      gridRow: 2,
                      backgroundColor: dayReadOnly
                        ? PLANNING_PAST_DAY_CELL_BG
                        : PLANNING_ACTIVE_DAY_CELL_BG,
                    }}
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
                          "[data-areacalendar-shift-card]"
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
                      <AreaCalendarShiftCardsList
                        shifts={dayShifts}
                        overnightAnchorShiftIds={overnightAnchors}
                        incomingOvernightTailRowsByIndex={
                          incomingOvernightTailRowsByIndex
                        }
                        areaId=""
                        areaNameById={areaNameById}
                        dateISO={date}
                        serviceTimeline={locationServiceTimelinesByDate.get(date)!}
                        serviceHours={serviceHours}
                        staffingRules={fullStaffingRules}
                        assignmentPresets={areaCalendarAssignmentPresetsForArea(
                          areaShiftTemplates
                        )}
                        profileQualificationIds={profileQualificationIdsRecord}
                        qualificationNameById={qualificationNameById}
                        qualificationSortOrder={qualificationSortOrder}
                        needsVerticalScroll={
                          simplePlanningRowLayout
                            ? cellShiftListNeedsScroll(
                                dayVisualRowCount,
                                simplePlanningRowLayout
                              )
                            : false
                        }
                        measureOverflowFallback={isDayExpanded}
                        clipVerticalOverflow={false}
                        shiftConfirmationEnabled={shiftConfirmationEnabled}
                        highlightedEmployeeId={highlightedEmployeeId}
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
                        overnightAnchorShiftIds={overnightAnchors}
                        incomingOvernightTailRowsByIndex={
                          incomingOvernightTailRowsByIndex
                        }
                        areaNameById={areaNameById}
                        assignmentPresets={areaCalendarAssignmentPresetsForArea(
                          areaShiftTemplates
                        )}
                        serviceTimeline={locationServiceTimelinesByDate.get(date)!}
                        isPastDay={dayReadOnly}
                        cellDate={date}
                        dayReferenceShifts={dayShifts}
                        areaCollapsed={false}
                        dayCollapsed={!isDayExpanded}
                        onShiftContextMenu={bindShiftContextMenu({
                          areaId: "",
                          date,
                          isAreaActive: true,
                          isDayActive: activeDayDates.has(date),
                          shiftCountInArea: dayShifts.length,
                        })}
                      />
                    ) : null}
                  </div>
                );
              })}
              {simplePlanningOvernightSpans.length > 0 ? (
                <AreaCalendarAreaRowOvernightOverlay
                  areaId={SIMPLE_PLANNING_AREA_ID}
                  areaNameById={areaNameById}
                  spans={simplePlanningOvernightSpans}
                  dayColumnCount={dates.length}
                  gridRow={2}
                  layoutActiveDayDates={layoutActiveDayDates}
                  layoutActiveAreaIds={layoutActiveAreaIds}
                  forceAreaExpanded
                  todayISO={todayISO}
                  serviceHours={serviceHours}
                  staffingRules={fullStaffingRules}
                  assignmentPresets={areaCalendarAssignmentPresetsForArea(
                    areaShiftTemplates
                  )}
                  profileQualificationIds={profileQualificationIdsRecord}
                  qualificationNameById={qualificationNameById}
                  qualificationSortOrder={qualificationSortOrder}
                  highlightedEmployeeId={highlightedEmployeeId}
                />
              ) : null}
            </>
          ) : areas.length === 0 ? (
            <div
              className="flex items-center justify-center px-4 py-12 text-center text-muted"
              style={{ gridColumn: "1 / -1", gridRow: 2 }}
            >
              {t("areaCalendar.noAreas")}
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
                    gridRow: `2 / ${footerStatsGridRow}`,
                    ...(!dayShowsHourGrid(dayIndex)
                      ? { backgroundColor: PLANNING_CLOSED_DAY_CELL_BG }
                      : {
                          backgroundColor: isPastCalendarDate(date, todayISO)
                            ? PLANNING_PAST_DAY_CELL_BG
                            : PLANNING_ACTIVE_DAY_CELL_BG,
                        }),
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
                const areaOvernightSpans =
                  overnightSpansByArea.get(area.id) ?? [];

                return (
                  <Fragment key={area.id}>
                    <div
                      className={cn(
                        "sticky left-0 z-20 flex h-full min-h-0 items-start overflow-hidden pt-[3px] pl-[2px]",
                        isLayoutAreaExpanded ? "pr-2" : "pr-1",
                        AREA_COLUMN_BG_CLASS,
                        CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS,
                        !isLastRow && CALENDAR_AREA_COLUMN_ROW_BORDER_CLASS
                      )}
                      style={{ gridColumn: 1, gridRow }}
                    >
                      <div
                        className={cn(
                          "flex min-w-0",
                          isLayoutAreaExpanded
                            ? "items-start gap-[10px]"
                            : "items-center gap-1"
                        )}
                      >
                        <CalendarAreaCheckbox
                          aria-label={area.name}
                          checked={isAreaActive}
                          onChange={(event) =>
                            toggleAreaActive(area.id, event.target.checked)
                          }
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <p
                            className={cn(
                              "truncate whitespace-nowrap font-semibold",
                              isLayoutAreaExpanded
                                ? "text-sm leading-[14px]"
                                : "text-xs leading-none"
                            )}
                          >
                            {area.name}
                          </p>
                          {isLayoutAreaExpanded && area.archived_at ? (
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
                      const overnightAnchors = areaCalendarOvernightAnchorShiftIds(
                        dayShifts,
                        dates
                      );
                      const incomingOvernightTailRowsByIndex =
                        collectAreaCalendarIncomingOvernightTailRowsByIndex(
                          area.id,
                          date,
                          areaOvernightSpans,
                          (startDate) =>
                            byAreaDate.get(`${area.id}:${startDate}`) ?? []
                        );
                      const dayVisualRowCount = countAreaCalendarCellVisualRows(
                        dayShifts,
                        {
                          overnightAnchorShiftIds: overnightAnchors,
                          incomingOvernightTailRowsByIndex,
                        }
                      );
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
                        isAreaActive &&
                        isLayoutAreaExpanded &&
                        isDayActive &&
                        isOpen;
                      const showInactivePreviewCell =
                        isAreaActive &&
                        isLayoutAreaExpanded &&
                        !isDayActive &&
                        dayHasScheduleActivity[dayIndex] &&
                        isOpen;
                      const showDayCellContent =
                        showOpenDayCell || showInactivePreviewCell;
                      const isPastDayCell = isPastCalendarDate(date);
                      const showNoServiceHoursLabel =
                        !areaHasEffectiveServiceHoursOnDate(
                          serviceHours,
                          area.id,
                          date
                        ) && !showDayCellContent;
                      const showNoServiceHoursInHeader =
                        !areaHasEffectiveServiceHoursOnDate(
                          serviceHours,
                          area.id,
                          date
                        ) &&
                        dayShifts.length > 0 &&
                        showDayCellContent;
                      const isPastWorkDayCell =
                        showDayCellContent && isPastAreaWorkDay;
                      const showAreaStaffingHeaderStrip =
                        isAreaActive &&
                        isLayoutAreaExpanded &&
                        (isOpen || showNoServiceHoursInHeader) &&
                        !showNoServiceHoursLabel;
                      const headerStaffing = computeBulkStaffingHeaderEntries({
                        staffingRules: rulesForAreaDate(area.id, date),
                        areaId: area.id,
                        dateISO: date,
                        serviceHours,
                        assignments: dayShifts.map((shift) => ({
                          startTime: shift.startTime,
                          endTime: shift.endTime,
                          employeeId: shift.employeeId,
                          confirmationStatus: shift.confirmationStatus,
                        })),
                        assignmentPresets: areaCalendarAssignmentPresetsForArea(
                          areaShiftTemplatesForArea(area.id, areaShiftTemplates)
                        ),
                        qualifications,
                        profileQualificationIds,
                        employeeNameById,
                        formatTimeLabel: formatStaffingTimeLabel,
                        weekdayLabel: staffingWeekdayLabel,
                        formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
                      });
                      const cellHasHighlightedShift =
                        showOpenDayCell &&
                        highlightedEmployeeId !== null &&
                        dayShifts.some(
                          (shift) => shift.employeeId === highlightedEmployeeId
                        );
                      const cellStaffingHeaderAlertBadge =
                        isTagAreaHeaderStaffingHeaderAlertBadge(headerStaffing);

                      return (
                        <div
                          key={date}
                          data-areacalendar-cell={areaCalendarCellDataAttribute(
                            area.id,
                            date
                          )}
                          className={cn(
                            "relative z-10 flex min-h-0 flex-col",
                            (showNoServiceHoursLabel ||
                              (!dayHasServiceHours[dayIndex] && isAreaActive)) &&
                              "cursor-pointer",
                            showAreaStaffingHeaderStrip && !showDayCellContent
                              ? "overflow-visible"
                              : (cellHasHighlightedShift ||
                                  cellStaffingHeaderAlertBadge)
                                ? "overflow-visible"
                                : "overflow-hidden",
                            showDayCellContent ? "p-2" : showAreaStaffingHeaderStrip ||
                              showNoServiceHoursLabel
                              ? "min-h-[44px]"
                              : undefined,
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
                              ? { backgroundColor: PLANNING_PAST_DAY_CELL_BG }
                              : !showDayCellContent && !showNoServiceHoursLabel
                                ? { backgroundColor: PLANNING_CLOSED_DAY_CELL_BG }
                                : showDayCellContent
                                  ? { backgroundColor: PLANNING_ACTIVE_DAY_CELL_BG }
                                  : undefined),
                          }}
                        >
                          {showAreaStaffingHeaderStrip ? (
                            <TagAreaHeaderStrip
                              key={`${area.id}:${date}:${dayShifts.map((shift) => shift.id).join(",")}`}
                              className={cn(
                                (cellHasHighlightedShift ||
                                  cellStaffingHeaderAlertBadge) &&
                                  "z-40"
                              )}
                              dayCollapsed={!isDayActive}
                              entries={headerStaffing}
                              noServiceHoursLabel={
                                showNoServiceHoursInHeader
                                  ? t("areaCalendar.noServiceHours")
                                  : undefined
                              }
                              headerTooltip={tagAreaHeaderServiceHoursTooltip(
                                area.id,
                                area.name,
                                date,
                                showNoServiceHoursInHeader
                              )}
                              staffingHeaderMenuOpen={
                                staffingHeaderContextMenu != null
                              }
                              onStaffingHeaderMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (isPastShiftDate(date)) return;
                                if (headerStaffing.length === 0) return;
                                setContextMenu(null);
                                setShiftContextMenu(null);
                                staffingHeaderContextMenuOpenedAtRef.current =
                                  performance.now();
                                setStaffingHeaderContextMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                  areaId: area.id,
                                  date,
                                  initialServiceHourId:
                                    headerStaffing[0]?.serviceHourId,
                                });
                              }}
                              overlayBackgroundColor={
                                isPastWorkDayCell
                                  ? PLANNING_PAST_STAFFING_HEADER_BG
                                  : PLANNING_STAFFING_HEADER_BG
                              }
                              style={{
                                height: TAG_AREA_HEADER_STRIP_HEIGHT,
                                position: "absolute",
                                insetInline: 0,
                                top: 0,
                              }}
                            />
                          ) : null}
                          {showDayCellContent ? (
                            <>
                              <div
                                data-areacalendar-area-cell-footer
                                className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center overflow-hidden border-t border-border px-1"
                                style={{
                                  height: TAG_AREA_FOOTER_STRIP_HEIGHT,
                                  backgroundColor: isPastWorkDayCell
                                    ? PAST_TAG_AREA_OVERLAY_BG
                                    : PLANNING_ACTIVE_DAY_OVERLAY_BG,
                                }}
                              >
                                {dayShifts.length > 0 ? (() => {
                                  const footerLabels = footerLabelsByAreaDate.get(
                                    `${area.id}:${date}`
                                  );
                                  return footerLabels ? (
                                    <TagAreaFooterStrip
                                      label={footerLabels.line}
                                      shortLinePrefix={footerLabels.shortLinePrefix}
                                      shortLineCostAmount={footerLabels.shortLineCostAmount}
                                      hoursTooltipLine={footerLabels.hoursLine}
                                      costTooltipParts={footerLabels.costTooltipParts}
                                      dayCollapsed={!isDayActive}
                                    />
                                  ) : null;
                                })() : null}
                              </div>
                              <div
                                className={cn(
                                  "flex h-0 min-h-0 flex-1 flex-col gap-1.5",
                                  layoutTransitionEnabled &&
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
                                        backgroundColor: PLANNING_PAST_DAY_CELL_BG,
                                      }
                                    : {
                                        backgroundColor: PLANNING_ACTIVE_DAY_CELL_BG,
                                      }),
                                }}
                              >
                                {showOpenDayCell ? (
                                  <AreaCalendarShiftCardsList
                                    key={`${area.id}:${date}:${areaRowLayout?.heightPx ?? 0}`}
                                    shifts={dayShifts}
                                    overnightAnchorShiftIds={overnightAnchors}
                                    incomingOvernightTailRowsByIndex={
                                      incomingOvernightTailRowsByIndex
                                    }
                                    areaId={area.id}
                                    areaName={area.name}
                                    areaNameById={areaNameById}
                                    dateISO={date}
                                    serviceTimeline={
                                      locationServiceTimelinesByDate.get(date)!
                                    }
                                    serviceHours={serviceHours}
                                    staffingRules={fullStaffingRules}
                                    assignmentPresets={areaCalendarAssignmentPresetsForArea(
                                      areaShiftTemplatesForArea(area.id, areaShiftTemplates)
                                    )}
                                    profileQualificationIds={profileQualificationIdsRecord}
                                    qualificationNameById={qualificationNameById}
                                    qualificationSortOrder={qualificationSortOrder}
                                    needsVerticalScroll={
                                      areaRowLayout
                                        ? cellShiftListNeedsScroll(
                                            dayVisualRowCount,
                                            areaRowLayout
                                          )
                                        : false
                                    }
                                    deferVerticalScroll={scrollDeferredAreaIds.has(
                                      area.id
                                    )}
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
                                    highlightedEmployeeId={highlightedEmployeeId}
                                    onShiftContextMenu={bindShiftContextMenu({
                                      areaId: area.id,
                                      date,
                                      isAreaActive,
                                      isDayActive: isCheckboxDayActive,
                                      shiftCountInArea: dayShifts.length,
                                    })}
                                  />
                                ) : showInactivePreviewCell &&
                                    dayShifts.length > 0 ? (
                                  <CollapsedShiftPreview
                                    shifts={dayShifts}
                                    overnightAnchorShiftIds={overnightAnchors}
                                    incomingOvernightTailRowsByIndex={
                                      incomingOvernightTailRowsByIndex
                                    }
                                    areaName={area.name}
                                    areaNameById={areaNameById}
                                    fallbackAreaId={area.id}
                                    assignmentPresets={areaCalendarAssignmentPresetsForArea(
                                      areaShiftTemplatesForArea(area.id, areaShiftTemplates)
                                    )}
                                    serviceTimeline={
                                      locationServiceTimelinesByDate.get(date)!
                                    }
                                    isPastDay={isPastCalendarDate(date)}
                                    cellDate={date}
                                    dayReferenceShifts={
                                      shiftsByDate.get(date) ?? []
                                    }
                                    areaCollapsed={isCompactRow}
                                    dayCollapsed={!isDayActive}
                                    onShiftContextMenu={bindShiftContextMenu({
                                      areaId: area.id,
                                      date,
                                      isAreaActive,
                                      isDayActive: isCheckboxDayActive,
                                      shiftCountInArea: dayShifts.length,
                                    })}
                                  />
                                ) : null}
                              </div>
                            </>
                          ) : null}
                          {!isAreaActive
                            ? null
                            : !dayHasServiceHours[dayIndex]
                              ? (
                            <TagAreaHeaderStrip
                              dayCollapsed={!isDayActive}
                              entries={[]}
                              noServiceHoursLabel={t("areaCalendar.noServiceHours")}
                              headerTooltip={tagAreaHeaderServiceHoursTooltip(
                                area.id,
                                area.name,
                                date,
                                true
                              )}
                              style={{
                                height: TAG_AREA_HEADER_STRIP_HEIGHT,
                                position: "absolute",
                                insetInline: 0,
                                top: 0,
                              }}
                            />
                              )
                              : showNoServiceHoursLabel
                                ? (
                            <ClosedAreaNoServiceHoursLabel
                              label={t("areaCalendar.noServiceHours")}
                            />
                                  )
                                : null}
                        </div>
                      );
                    })}
                    {isAreaActive && areaOvernightSpans.length > 0 ? (
                      <AreaCalendarAreaRowOvernightOverlay
                        areaId={area.id}
                        areaName={area.name}
                        areaNameById={areaNameById}
                        spans={areaOvernightSpans}
                        dayColumnCount={dates.length}
                        gridRow={gridRow}
                        layoutActiveDayDates={layoutActiveDayDates}
                        layoutActiveAreaIds={layoutActiveAreaIds}
                        todayISO={todayISO}
                        serviceHours={serviceHours}
                        staffingRules={fullStaffingRules}
                        assignmentPresets={areaCalendarAssignmentPresetsForArea(
                          areaShiftTemplatesForArea(area.id, areaShiftTemplates)
                        )}
                        profileQualificationIds={profileQualificationIdsRecord}
                        qualificationNameById={qualificationNameById}
                        qualificationSortOrder={qualificationSortOrder}
                        highlightedEmployeeId={highlightedEmployeeId}
                        onShiftClick={(shift) => {
                          const startDate = shift.shift_date;
                          const startDayShifts =
                            byAreaDate.get(`${area.id}:${startDate}`) ?? [];
                          handleShiftCardClick(
                            shift,
                            area.id,
                            startDate,
                            isAreaActive,
                            activeDayDates.has(startDate),
                            startDayShifts.length
                          );
                        }}
                        onShiftContextMenu={(shift, event) =>
                          bindShiftContextMenu({
                            areaId: area.id,
                            date: shift.shift_date,
                            isAreaActive,
                            isDayActive: activeDayDates.has(shift.shift_date),
                            shiftCountInArea: (
                              byAreaDate.get(`${area.id}:${shift.shift_date}`) ??
                              []
                            ).length,
                          })(shift, event)
                        }
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </>
          )}

          <div
            className={cn(
              "sticky left-0 z-[41] border-t border-slate-400 bg-calendar-active-header",
              CALENDAR_HEADER_AREA_COLUMN_BORDER_CLASS
            )}
            style={{
              gridColumn: 1,
              gridRow: footerStatsGridRow,
              height: PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
              bottom: PLANNING_DAY_FOOTER_ROW_HEIGHT,
            }}
            aria-hidden
          />

          {dates.map((date, dayIndex) => {
            const mutedFooter = !dayHasServiceHours[dayIndex];
            const footerLabels = dailyFooterLabelsByDate.get(date);

            return (
              <div
                key={`footer-stats-${date}`}
                className={cn(
                  "sticky z-40 flex min-h-0 items-center justify-center overflow-hidden border-t border-slate-400",
                  mutedFooter ? CALENDAR_DAY_HEADER_MUTED_CLASS : CALENDAR_DAY_HEADER_ACTIVE_CLASS,
                  dayHeaderColumnDivider(dayIndex)
                )}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: footerStatsGridRow,
                  height: PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
                  bottom: PLANNING_DAY_FOOTER_ROW_HEIGHT,
                }}
              >
                {footerLabels ? (
                  <TagAreaFooterStrip
                    label={footerLabels.line}
                    shortLinePrefix={footerLabels.shortLinePrefix}
                    shortLineCostAmount={footerLabels.shortLineCostAmount}
                    hoursTooltipLine={footerLabels.hoursLine}
                    costTooltipParts={footerLabels.costTooltipParts}
                    dayCollapsed={!layoutActiveDayDates.has(date)}
                  />
                ) : null}
              </div>
            );
          })}

          <DashboardWeeklySummaryFooter
            summary={weeklySummaryData}
            locale={locale}
            gridRow={footerGridRow}
            t={t}
          />
        </div>
      </div>

      {contextMenu &&
      (SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM || !simplePlanning) ? (
        <div
          ref={contextMenuRef}
          className={PLANNING_CONTEXT_MENU_SURFACE_CLASS}
          style={{
            left: clampedAreaDayContextMenuPosition.x,
            top: clampedAreaDayContextMenuPosition.y,
            width: AREA_CALENDAR_DAY_CONTEXT_MENU_WIDTH_PX,
          }}
          role="menu"
          aria-label={t("areaCalendar.assignMultipleShifts")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM ? (
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
              onClick={openAddShiftDialog}
            >
              {t("areaCalendar.assignShift")}
            </button>
          ) : null}
          {!simplePlanning ? (
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
              onClick={openBulkShiftDialog}
            >
              {t("areaCalendar.assignMultipleShifts")}
            </button>
          ) : null}
        </div>
      ) : null}

      {shiftContextMenu ? (
        <div
          ref={shiftContextMenuRef}
          className={PLANNING_CONTEXT_MENU_SURFACE_CLASS}
          style={{
            left: clampedShiftContextMenuPosition.x,
            top: clampedShiftContextMenuPosition.y,
            width: AREA_SHIFT_CONTEXT_MENU_WIDTH_PX,
          }}
          role="menu"
          aria-label={t("areaCalendar.editShift")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {shiftConfirmationEnabled
            ? shiftCardContextMenuActions(
                shiftContextMenu.shift.confirmationStatus,
                shiftContextMenu.shift.requestedAt,
                {
                  shiftDate: shiftContextMenu.shift.shift_date,
                  cellDate: shiftContextMenu.date,
                  isPastShiftDate,
                }
              ).map((action) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    (action === "delete" &&
                      (deleteShiftPending ||
                        !canDeleteShift({
                          shiftDate: shiftContextMenu.shift.shift_date,
                          confirmationStatus:
                            shiftContextMenu.shift.confirmationStatus,
                          requestedAt: shiftContextMenu.shift.requestedAt,
                          isPastShiftDate,
                          pendingAfterMinutes,
                        }))) ||
                    (action === "cancel" && cancelShiftPending) ||
                    (action === "requestConfirmation" && sendConfirmationPending) ||
                    (action === "setConfirmed" && confirmShiftPending)
                  }
                  onClick={() => handleShiftContextMenuAction(action)}
                >
                  {t(shiftCardContextMenuActionLabelKey(action))}
                </button>
              ))
            : (
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleDeleteShiftMenuClick}
                disabled={
                  deleteShiftPending ||
                  !canDeleteShift({
                    shiftDate: shiftContextMenu.shift.shift_date,
                    confirmationStatus: shiftContextMenu.shift.confirmationStatus,
                    requestedAt: shiftContextMenu.shift.requestedAt,
                    isPastShiftDate,
                    pendingAfterMinutes,
                  })
                }
              >
                {t("areaCalendar.deleteShift")}
              </button>
            )}
        </div>
      ) : null}

      {staffingHeaderContextMenu ? (
        <div
          ref={staffingHeaderContextMenuRef}
          className={PLANNING_CONTEXT_MENU_SURFACE_CLASS}
          style={{
            left: clampedStaffingHeaderContextMenuPosition.x,
            top: clampedStaffingHeaderContextMenuPosition.y,
            width: DASHBOARD_CELL_CONTEXT_MENU_WIDTH_PX,
          }}
          role="menu"
          aria-label={t("calendarStaffing.contextMenuAria")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
            onClick={() => openStaffingEditDialog("temporary")}
          >
            {t("calendarStaffing.contextTemporary")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
            onClick={() => openStaffingEditDialog("permanent")}
          >
            {t("calendarStaffing.contextPermanent")}
          </button>
        </div>
      ) : null}

      {staffingEditDialog &&
      selectedLocation &&
      areas.some((entry) => entry.id === staffingEditDialog.areaId) ? (
        <CalendarStaffingEditModal
          mode={staffingEditDialog.mode}
          location={selectedLocation}
          area={areas.find((entry) => entry.id === staffingEditDialog.areaId)!}
          anchorDate={staffingEditDialog.anchorDate}
          weekDates={dates}
          shiftTemplates={areaShiftTemplatesForArea(
            staffingEditDialog.areaId,
            areaShiftTemplates
          )}
          editorData={buildCalendarStaffingEditorData(
            staffingEditDialog.areaId,
            serviceHours,
            fullStaffingRules,
            qualifications
          )}
          staffingOverrides={staffingOverrides}
          initialServiceHourId={staffingEditDialog.initialServiceHourId}
          onClose={() => setStaffingEditDialog(null)}
          onSaved={handleStaffingEditSaved}
        />
      ) : null}

      {shiftDeleteConfirm ? (
        <AreaCalendarShiftDeleteConfirmModal
          pending={deleteShiftPending}
          onCancel={() => {
            if (deleteShiftPending) return;
            setShiftDeleteConfirm(null);
            setDeleteShiftError(null);
          }}
          onConfirm={handleConfirmDeleteShift}
        />
      ) : null}

      {shiftCancelConfirm ? (
        <ShiftCancelConfirmModal
          placement="fixed"
          variant="manager"
          employeeName={shiftCancelConfirm.employeeName}
          pending={cancelShiftPending}
          onCancel={() => {
            if (cancelShiftPending) return;
            setShiftCancelConfirm(null);
            setCancelShiftError(null);
          }}
          onConfirm={handleConfirmCancelShift}
        />
      ) : null}

      {cancelShiftError ? (
        <SettingsMessageModal
          placement="fixed"
          message={cancelShiftError}
          onClose={() => setCancelShiftError(null)}
        />
      ) : null}

      {confirmShiftError ? (
        <SettingsMessageModal
          placement="fixed"
          message={confirmShiftError}
          onClose={() => setConfirmShiftError(null)}
        />
      ) : null}

      {deleteShiftError ? (
        <SettingsMessageModal
          placement="fixed"
          message={deleteShiftError}
          onClose={() => setDeleteShiftError(null)}
        />
      ) : null}

      {confirmationSendError ? (
        <SettingsMessageModal
          placement="fixed"
          message={confirmationSendError}
          onClose={() => setConfirmationSendError(null)}
        />
      ) : null}

      {noServiceHoursConfirm ? (
        <NoServiceHoursShiftConfirmModal
          areaName={
            areas.find((area) => area.id === noServiceHoursConfirm.areaId)
              ?.name ?? ""
          }
          onCancel={() => setNoServiceHoursConfirm(null)}
          onConfirm={() => {
            if (!noServiceHoursConfirm) return;
            const { areaId, date, action } = noServiceHoursConfirm;
            setNoServiceHoursConfirm(null);
            if (action === "add") {
              setAddShiftDialog({
                areaId: simplePlanning ? null : areaId,
                date,
                withoutServiceHours: true,
              });
              return;
            }
            openBulkShiftDialogForAreaDay(areaId, date, {
              withoutServiceHours: true,
            });
          }}
        />
      ) : null}

      {addShiftDialog && locationId ? (
        <AreaCalendarAddShiftModal
          key={`single:${addShiftDialog.areaId ?? "simple"}:${addShiftDialog.date}`}
          dialog={addShiftDialog}
          locationId={locationId}
          areas={areas}
          areaShiftTemplates={areaShiftTemplates}
          serviceHours={serviceHours}
          staffingRules={fullStaffingRules}
          qualifications={qualifications}
          profileQualificationIds={profileQualificationIdsRecord}
          areaExistingAssignments={
            addShiftDialog.areaId
              ? shifts
                  .filter(
                    (shift) =>
                      shift.locationAreaId === addShiftDialog.areaId &&
                      shift.shift_date === addShiftDialog.date
                  )
                  .map((shift) => ({
                    employeeId: shift.employeeId,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                  }))
              : shifts
                  .filter((shift) => shift.shift_date === addShiftDialog.date)
                  .map((shift) => ({
                    employeeId: shift.employeeId,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                  }))
          }
          weekDates={dates}
          weekShifts={weekShiftsForAssignment}
          onClose={() => setAddShiftDialog(null)}
          onSaved={handleShiftSaved}
        />
      ) : null}

      {bulkShiftDialog && locationId && !simplePlanning ? (
        <AreaCalendarBulkShiftModal
          key={`bulk:${bulkShiftDialog.areaId}:${bulkShiftDialog.date}:${bulkShiftDialog.focusShiftId ?? ""}:${bulkShiftDialog.withoutServiceHours ? "nosh" : "sh"}`}
          dialog={bulkShiftDialog}
          locationId={locationId}
          locationName={locationName}
          showLocationName={showLocationName}
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
              confirmationStatus: shift.confirmationStatus,
              requestedAt: shift.requestedAt,
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
          weekDates={dates}
          weekShifts={weekShiftsForAssignment}
          onClose={() => setBulkShiftDialog(null)}
          onSaved={handleShiftSaved}
        />
      ) : null}
    </div>
  );
}
