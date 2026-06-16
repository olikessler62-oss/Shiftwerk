"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { assignShiftWithTimes, removeShift } from "@/app/actions/shifts";
import { sendConfirmationRequestForShift } from "@/app/actions/shift-confirmations";
import { isPastCalendarDate, toISODate, startOfWeek, parseISODate } from "@/lib/dates";
import { PlanningCalendarGrid } from "@/components/planning/planning-calendar-grid";
import { usePlanningAppSidebarContent } from "@/components/planning/planning-app-sidebar-slot";
import { PlanningShiftTemplateSidebarList } from "@/components/planning/planning-shift-template-sidebar-list";
import { PlanningAvailabilityLegendSidebar } from "@/components/planning/planning-availability-legend-sidebar";
import {
  PlanningAssignShiftModal,
  type PlanningShiftActionResult,
} from "@/components/planning/planning-assign-shift-modal";
import { DashboardBulkShiftModal } from "@/components/dashboard/dashboard-bulk-shift-modal";
import type { DashboardBulkShiftDialogState } from "@/components/dashboard/dashboard-add-shift-modal";
import { DashboardSendConfirmationModal } from "@/components/dashboard/dashboard-send-confirmation-modal";
import { DashboardShiftDeleteConfirmModal } from "@/components/dashboard/dashboard-shift-delete-confirm-modal";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { OpenConfirmationsPanel } from "@/components/dashboard/open-confirmations-panel";
import {
  planningShiftToDashboardCard,
  type PlanningShift,
} from "@/lib/planning-shift-card";
import { resolveNarrowDayColumnWidthsPx } from "@/lib/day-column-width";
import {
  createPlanningActiveDayDates,
  PLANNING_CALENDAR_LAYOUT_ANIMATION_DELAY_MS,
  PLANNING_DAY_HEADER_ROW_HEIGHT,
  PLANNING_DAY_FOOTER_ROW_HEIGHT,
  PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
  PLANNING_EMPLOYEE_ROW_HEIGHT,
  planningCalendarMinWidth,
  planningGridTemplateColumns,
  resolvePlanningLayoutDayDates,
} from "@/lib/planning-calendar-layout";
import { resolveLocationServiceDayTimeline } from "@/lib/shift-card-cell-layout";
import {
  isAnyAreaOpenInCalendar,
  hasServiceHoursOnDate,
  isAreaOpenOnDate,
  findServiceHourIdForShift,
  weekdayLabelFromIndex,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";
import {
  computeBulkStaffingHeaderEntries,
  staffingAssignmentsForPlanningAreaDay,
} from "@/lib/bulk-staffing-header";
import { presetQualificationForServiceHour } from "@/lib/bulk-shift-qualification";
import { resolvePlanningAssignPrefillFromOpenDemand } from "@/lib/planning-assign-prefill";
import { isPlanningWeekAtEarliest } from "@schichtwerk/database";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { buildHolidayNamesByDate } from "@/lib/german-public-holidays";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures } from "@/lib/org-features-provider";
import {
  useEffectiveShiftConfirmationEnabled,
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import { useAppShellModalLockActive, useAppShellWaitCursorActive, useIsAppShellLocked } from "@/lib/app-shell-modal-lock";
import { translateActionError } from "@/lib/translate-action-error";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import {
  getDashboardWeekHeaderParts,
  weeklySummary,
} from "@/lib/planning-utils";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import {
  areaShiftTemplatesForArea,
  dashboardAssignmentPresetsForArea,
  resolvePresetIdFromTimes,
  areaShiftTemplateIdForAssign,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  areDashboardShiftTimesComplete,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import {
  employeeHasRecurringAvailabilityOnWeekday,
  employeeMatchesShiftAvailability,
  isEmployeeAbsentOnDate,
} from "@schichtwerk/database";
import {
  buildPlanningShiftsByCellDisplay,
} from "@/lib/planning-overnight-shift-display";
import { pickFirstPlanningShiftPerEmployeeDay } from "@/lib/simple-calendar-display-toggle";
import { useSimpleCalendarDisplay } from "@/lib/simple-calendar-display-context";
import { usePlanningStaffColumnWidthPx } from "@/lib/use-planning-staff-column-width";
import {
  APP_PAGE_TOOLBAR_HEADER_CLASS,
  APP_SHELL_CONTENT_OFFSET_CLASS,
} from "@/lib/app-shell-layout";
import {
  computeTagAreaDayFooterStats,
  formatTagAreaFooterLabels,
  type DashboardShiftCompensationByKey,
} from "@/lib/tag-area-footer-stats";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  CompensationSurchargeType,
  Location,
  LocationArea,
  LocationAreaStaffing,
  Profile,
  ProfileRecurringAvailability,
  Qualification,
  Role,
  ManagerNotification,
} from "@schichtwerk/types";
import { LocationSelect } from "@/components/dashboard/location-select";
import { DashboardNotificationCenter } from "@/components/dashboard/dashboard-notification-center";
import { LanguageSelect } from "@/components/i18n/language-select";
import {
  Alert,
  Button,
  ControlDisplay,
  IconButton,
  ListIcon,
  Select,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";

export type { PlanningShift } from "@/lib/planning-shift-card";

type Props = {
  weekStart: string;
  dates: string[];
  employees: Profile[];
  shifts: PlanningShift[];
  locationShifts: PlanningShift[];
  recurringAvailability: ProfileRecurringAvailability[];
  absences: AbsenceRequest[];
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  selectedAreaId: string | null;
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  shiftCompensation?: DashboardShiftCompensationByKey;
  readOnlyWeek?: boolean;
  managerNotifications?: ManagerNotification[];
  settingsModals?: {
    profiles: Profile[];
    roles: Role[];
    compensationSurchargeTypes: CompensationSurchargeType[];
  };
};

type Picker = { employeeId: string; date: string; shiftId?: string };

type CellContextMenuState = {
  x: number;
  y: number;
  employeeId: string;
  date: string;
  shiftId?: string;
};

type DayAssignBlockReason = "absent" | "no_availability";

type ConfirmationsPanelTab = "pending" | "rejected" | "proposed";

const PLANNING_CELL_CONTEXT_MENU_WIDTH_PX = 240;
const PLANNING_CELL_CONTEXT_MENU_ITEM_HEIGHT_PX = 36;
const CONTEXT_MENU_CLOSE_DISTANCE_PX = 20;

function planningCellContextMenuHeightPx(
  simplePlanning: boolean,
  shiftConfirmationEnabled: boolean
): number {
  const items =
    (simplePlanning ? 2 : 3) + (shiftConfirmationEnabled ? 1 : 0);
  return items * PLANNING_CELL_CONTEXT_MENU_ITEM_HEIGHT_PX + 8;
}

function clampPlanningContextMenuPosition(
  clientX: number,
  clientY: number,
  simplePlanning: boolean,
  shiftConfirmationEnabled: boolean
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }
  const padding = 8;
  const menuWidth = PLANNING_CELL_CONTEXT_MENU_WIDTH_PX;
  const menuHeight = planningCellContextMenuHeightPx(
    simplePlanning,
    shiftConfirmationEnabled
  );
  const maxX = Math.max(padding, window.innerWidth - menuWidth - padding);
  const maxY = Math.max(padding, window.innerHeight - menuHeight - padding);
  return {
    x: Math.min(Math.max(padding, clientX), maxX),
    y: Math.min(Math.max(padding, clientY), maxY),
  };
}

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

/** Gleiche Höhe wie IconButton size="md" (h-9). */
const HEADER_CONTROL_H = "h-9 min-h-9";

function getDayAssignBlockReason(
  employeeId: string,
  date: string,
  recurringAvailability: ProfileRecurringAvailability[],
  absences: AbsenceRequest[]
): DayAssignBlockReason | null {
  if (isEmployeeAbsentOnDate(employeeId, absences, date)) return "absent";
  const weekday = profileAvailabilityWeekdayFromDashboardDate(date);
  if (
    !employeeHasRecurringAvailabilityOnWeekday(
      employeeId,
      recurringAvailability,
      weekday
    )
  ) {
    return "no_availability";
  }
  return null;
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

export function ShiftPlanner({
  weekStart,
  dates,
  employees,
  shifts,
  locationShifts,
  recurringAvailability,
  absences,
  locations,
  selectedLocationId,
  areas,
  selectedAreaId,
  areaShiftTemplates,
  serviceHours,
  staffingRules,
  qualifications,
  profileQualificationIds: profileQualificationIdsRecord,
  shiftCompensation = {},
  readOnlyWeek = false,
  managerNotifications = [],
  settingsModals,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { locale } = useLocale();
  const features = useOrgFeatures();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign } = useSimulatedProposedOnAssignRequest();
  const atEarliestWeek = isPlanningWeekAtEarliest(weekStart);
  const simplePlanning = !features.areas;
  const intlLocale = toIntlLocale(locale);
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<Picker | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [qualificationId, setQualificationId] = useState("");
  const [qualificationManuallySelected, setQualificationManuallySelected] =
    useState(false);
  const [cellContextMenu, setCellContextMenu] =
    useState<CellContextMenuState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<DashboardBulkShiftDialogState | null>(null);
  const [shiftDeleteConfirmId, setShiftDeleteConfirmId] = useState<string | null>(
    null
  );
  const [deleteShiftError, setDeleteShiftError] = useState<string | null>(null);
  const [deleteShiftPending, startDeleteShift] = useTransition();
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false);
  const [sendConfirmationBusy, setSendConfirmationBusy] = useState(false);
  const [confirmationsPanelOpen, setConfirmationsPanelOpen] = useState(false);
  const [confirmationsPanelTab, setConfirmationsPanelTab] =
    useState<ConfirmationsPanelTab>("pending");
  const { simpleCalendarFirstShiftOnly } = useSimpleCalendarDisplay();
  const [confirmationSendError, setConfirmationSendError] = useState<string | null>(
    null
  );
  const [sendConfirmationPending, startSendConfirmation] = useTransition();
  const cellContextMenuRef = useRef<HTMLDivElement>(null);
  const skipCellContextMenuCloseRef = useRef(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [note, setNote] = useState("");
  const skipPresetFromTimesSyncRef = useRef(false);

  const shellLocked = useIsAppShellLocked();
  const controlsDisabled = pending || shellLocked;

  useAppShellModalLockActive(
    Boolean(picker) ||
      Boolean(bulkShiftDialog) ||
      Boolean(shiftDeleteConfirmId) ||
      sendConfirmationOpen ||
      confirmationsPanelOpen
  );
  useAppShellWaitCursorActive(sendConfirmationBusy);

  function openSendConfirmation() {
    setSendConfirmationBusy(true);
    setSendConfirmationOpen(true);
  }

  function closeSendConfirmation() {
    setSendConfirmationOpen(false);
    setSendConfirmationBusy(false);
  }

  function openConfirmationsPanel(tab: ConfirmationsPanelTab = "pending") {
    setConfirmationsPanelTab(tab);
    setConfirmationsPanelOpen(true);
  }

  const templatesForArea = useMemo(
    () =>
      selectedAreaId
        ? areaShiftTemplatesForArea(selectedAreaId, areaShiftTemplates)
        : [],
    [areaShiftTemplates, selectedAreaId]
  );

  const assignmentPresets = useMemo(
    () => dashboardAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );

  const planningAppSidebarContent = useMemo(
    () => (
      <div className="space-y-4">
        {!simplePlanning ? (
          <PlanningShiftTemplateSidebarList
            presets={assignmentPresets}
            emptyLabel={t("dashboard.noShiftTemplatesForArea")}
            locale={locale}
          />
        ) : null}
        <PlanningAvailabilityLegendSidebar
          title={t("planning.legendAvailability")}
          availableLabel={t("planning.legendAvailable")}
          noAvailabilityLabel={t("planning.legendNoAvailability")}
          absentLabel={t("planning.legendAbsent")}
        />
      </div>
    ),
    [simplePlanning, assignmentPresets, locale, t]
  );

  usePlanningAppSidebarContent(planningAppSidebarContent);

  const serviceHourAreaIds = useMemo(
    () => (selectedAreaId ? [selectedAreaId] : areas.map((area) => area.id)),
    [selectedAreaId, areas]
  );

  const holidayNames = useMemo(
    () => buildHolidayNamesByDate(dates, locale === "en" ? "en" : "de"),
    [dates, locale]
  );

  const dayHasServiceHours = useMemo(
    () =>
      dates.map((date) =>
        hasServiceHoursOnDate(serviceHours, date, serviceHourAreaIds)
      ),
    [dates, serviceHours, serviceHourAreaIds]
  );

  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(new Date())),
    [todayISO]
  );
  const isCurrentWeek = weekStart === currentWeekStart;

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const shift of shifts) {
      map.set(shift.shift_date, (map.get(shift.shift_date) ?? 0) + 1);
    }
    return map;
  }, [shifts]);

  const dayReferenceShiftTimesByDate = useMemo(() => {
    const map = new Map<
      string,
      readonly { startTime: string; endTime: string }[]
    >();
    for (const date of dates) {
      map.set(
        date,
        shifts
          .filter((shift) => shift.shift_date === date)
          .map((shift) => ({
            startTime: shift.startTime,
            endTime: shift.endTime,
          }))
      );
    }
    return map;
  }, [dates, shifts]);

  const serviceTimelinesByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof resolveLocationServiceDayTimeline>
    >();
    for (const date of dates) {
      map.set(date, resolveLocationServiceDayTimeline(serviceHours, date));
    }
    return map;
  }, [dates, serviceHours]);

  const dayHasOpenArea = useMemo(
    () =>
      dates.map((date) => {
        const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
        if (simplePlanning) {
          return !isPastCalendarDate(date, todayISO);
        }
        return isAnyAreaOpenInCalendar(
          serviceHours,
          serviceHourAreaIds,
          date,
          hasShifts
        );
      }),
    [
      dates,
      serviceHours,
      serviceHourAreaIds,
      shiftsByDate,
      simplePlanning,
      todayISO,
    ]
  );

  const [activeDayDates, setActiveDayDates] = useState<Set<string>>(() =>
    createPlanningActiveDayDates(
      dates,
      serviceHourAreaIds,
      serviceHours,
      shiftsByDate,
      { simplePlanning, todayISO }
    )
  );
  const [layoutActiveDayDates, setLayoutActiveDayDates] = useState<Set<string>>(
    () =>
      createPlanningActiveDayDates(
        dates,
        serviceHourAreaIds,
        serviceHours,
        shiftsByDate,
        { simplePlanning, todayISO }
      )
  );
  const layoutDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planningLayoutScopeRef = useRef<string | null>(null);
  const currentWeekDayExpansionRef = useRef<Set<string>>(new Set());
  const hasInitializedCurrentWeekDayLayoutRef = useRef(false);
  const [isPlanningCalendarVisible, setIsPlanningCalendarVisible] =
    useState(false);
  const [layoutTransitionEnabled, setLayoutTransitionEnabled] = useState(false);

  const clearLayoutDayTimer = useCallback(() => {
    if (layoutDayTimerRef.current !== null) {
      clearTimeout(layoutDayTimerRef.current);
      layoutDayTimerRef.current = null;
    }
  }, []);

  const syncLayoutDaysImmediate = useCallback(
    (next: Set<string>) => {
      clearLayoutDayTimer();
      setLayoutActiveDayDates(new Set(next));
    },
    [clearLayoutDayTimer]
  );

  const scheduleLayoutDays = useCallback(
    (next: Set<string>) => {
      clearLayoutDayTimer();
      layoutDayTimerRef.current = setTimeout(() => {
        setLayoutActiveDayDates(new Set(next));
        layoutDayTimerRef.current = null;
      }, PLANNING_CALENDAR_LAYOUT_ANIMATION_DELAY_MS);
    },
    [clearLayoutDayTimer]
  );

  useEffect(
    () => () => {
      clearLayoutDayTimer();
    },
    [clearLayoutDayTimer]
  );

  useLayoutEffect(() => {
    const scopeKey = `${weekStart}:${selectedLocationId ?? ""}:${selectedAreaId ?? ""}`;
    if (planningLayoutScopeRef.current === scopeKey) {
      return;
    }
    planningLayoutScopeRef.current = scopeKey;

    const isFirstCurrentWeekView =
      weekStart === currentWeekStart &&
      !hasInitializedCurrentWeekDayLayoutRef.current;
    const nextDays = resolvePlanningLayoutDayDates(
      dates,
      serviceHourAreaIds,
      serviceHours,
      shiftsByDate,
      {
        weekStart,
        currentWeekStart,
        todayISO,
        savedCurrentWeekExpansion: isFirstCurrentWeekView
          ? null
          : currentWeekDayExpansionRef.current,
        isFirstCurrentWeekView,
        simplePlanning,
      }
    );
    if (weekStart === currentWeekStart) {
      if (isFirstCurrentWeekView) {
        hasInitializedCurrentWeekDayLayoutRef.current = true;
      }
      currentWeekDayExpansionRef.current = new Set(nextDays);
    }
    setActiveDayDates(nextDays);
    setLayoutTransitionEnabled(false);
    syncLayoutDaysImmediate(nextDays);
    setIsPlanningCalendarVisible(true);
  }, [
    dates,
    weekStart,
    currentWeekStart,
    todayISO,
    selectedLocationId,
    selectedAreaId,
    serviceHourAreaIds,
    serviceHours,
    shiftsByDate,
    simplePlanning,
    syncLayoutDaysImmediate,
  ]);

  const toggleDayActive = useCallback(
    (date: string, active: boolean) => {
      setLayoutTransitionEnabled(true);
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

  const dayUsesWideColumn = useMemo(
    () =>
      dates.map((date, dayIndex) => {
        if (!layoutActiveDayDates.has(date)) return false;
        if (!dayHasOpenArea[dayIndex]) return false;
        const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
        return hasShifts || dayHasServiceHours[dayIndex];
      }),
    [
      dates,
      dayHasOpenArea,
      dayHasServiceHours,
      shiftsByDate,
      layoutActiveDayDates,
    ]
  );

  const fillColumnsEqually = useMemo(
    () => !dayUsesWideColumn.some(Boolean),
    [dayUsesWideColumn]
  );

  const narrowDayColumnWidthsPx = useMemo(
    () => resolveNarrowDayColumnWidthsPx(dates, holidayNames, intlLocale),
    [dates, holidayNames, intlLocale]
  );

  const staffColumnWidthPx = usePlanningStaffColumnWidthPx({
    employees,
    shifts,
    locale,
    staffColumnHeaderLabel: t("planning.staffColumn"),
    employeeHoursLabel: t("common.basic"),
  });

  const columnTemplate = useMemo(
    () =>
      planningGridTemplateColumns(
        staffColumnWidthPx,
        dayUsesWideColumn,
        narrowDayColumnWidthsPx,
        fillColumnsEqually
      ),
    [staffColumnWidthPx, dayUsesWideColumn, narrowDayColumnWidthsPx, fillColumnsEqually]
  );

  const minPlanningCalendarWidth = useMemo(() => {
    if (fillColumnsEqually) return undefined;
    return planningCalendarMinWidth(
      staffColumnWidthPx,
      dayUsesWideColumn,
      narrowDayColumnWidthsPx
    );
  }, [staffColumnWidthPx, dayUsesWideColumn, narrowDayColumnWidthsPx, fillColumnsEqually]);

  const profileQualificationIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [profileId, ids] of Object.entries(profileQualificationIdsRecord)) {
      map.set(profileId, new Set(ids));
    }
    return map;
  }, [profileQualificationIdsRecord]);

  const showStaffingHeaderRow = !simplePlanning && Boolean(selectedAreaId);

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

  const planningHeaderRowTemplate = useMemo(() => {
    return showStaffingHeaderRow
      ? `${PLANNING_DAY_HEADER_ROW_HEIGHT} ${PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT}`
      : PLANNING_DAY_HEADER_ROW_HEIGHT;
  }, [showStaffingHeaderRow]);

  const planningBodyRowTemplate = useMemo(() => {
    return employees.length > 0
      ? `repeat(${employees.length}, minmax(${PLANNING_EMPLOYEE_ROW_HEIGHT}, 1fr))`
      : "";
  }, [employees.length]);

  const timesComplete = areDashboardShiftTimesComplete(startTime, endTime);

  const calendarDisplayShifts = useMemo(
    () =>
      simpleCalendarFirstShiftOnly
        ? pickFirstPlanningShiftPerEmployeeDay(shifts)
        : shifts,
    [shifts, simpleCalendarFirstShiftOnly]
  );

  const visibleEmployeeIds = useMemo(
    () => new Set(employees.map((employee) => employee.id)),
    [employees]
  );

  const dailyStaffingByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof computeBulkStaffingHeaderEntries>
    >();
    if (!showStaffingHeaderRow || !selectedAreaId) return map;

    for (const date of dates) {
      map.set(
        date,
        computeBulkStaffingHeaderEntries({
          staffingRules,
          areaId: selectedAreaId,
          dateISO: date,
          serviceHours,
          assignments: staffingAssignmentsForPlanningAreaDay(
            calendarDisplayShifts,
            date,
            selectedAreaId,
            visibleEmployeeIds
          ),
          assignmentPresets,
          qualifications,
          profileQualificationIds,
          formatTimeLabel: formatStaffingTimeLabel,
          weekdayLabel: staffingWeekdayLabel,
          formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
        })
      );
    }
    return map;
  }, [
    showStaffingHeaderRow,
    selectedAreaId,
    dates,
    calendarDisplayShifts,
    visibleEmployeeIds,
    staffingRules,
    serviceHours,
    assignmentPresets,
    qualifications,
    profileQualificationIds,
    formatStaffingTimeLabel,
    staffingWeekdayLabel,
    formatCalendarStaffingTimeLabel,
  ]);

  const dailyFooterLabelsByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof formatTagAreaFooterLabels>
    >();
    for (const date of dates) {
      const dayShifts = calendarDisplayShifts.filter(
        (shift) => shift.shift_date === date
      );
      if (dayShifts.length === 0) continue;
      const stats = computeTagAreaDayFooterStats(
        dayShifts.map((shift) => ({
          employeeId: shift.employee_id,
          shift_date: shift.shift_date,
          startTime: shift.startTime,
          endTime: shift.endTime,
        })),
        shiftCompensation
      );
      map.set(
        date,
        formatTagAreaFooterLabels(stats, t, locale === "en" ? "en" : "de")
      );
    }
    return map;
  }, [dates, calendarDisplayShifts, shiftCompensation, t, locale]);

  const shiftsByCellDisplay = useMemo(
    () => buildPlanningShiftsByCellDisplay(dates, calendarDisplayShifts),
    [dates, calendarDisplayShifts]
  );

  const calendarShiftsByCell = useMemo(() => {
    const map = new Map<string, PlanningShift[]>();
    for (const shift of calendarDisplayShifts) {
      const key = `${shift.employee_id}:${shift.shift_date}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
      );
    }
    return map;
  }, [calendarDisplayShifts]);

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, PlanningShift[]>();
    for (const shift of shifts) {
      const key = `${shift.employee_id}:${shift.shift_date}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
      );
    }
    return map;
  }, [shifts]);

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const dashboardShiftsForConfirmation = useMemo(
    () =>
      locationShifts.flatMap((shift) => {
        const employee = employeesById.get(shift.employee_id);
        return employee ? [planningShiftToDashboardCard(shift, employee)] : [];
      }),
    [locationShifts, employeesById]
  );

  const proposedSendCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? dashboardShiftsForConfirmation.filter(
            (shift) => shift.confirmationStatus === "proposed"
          ).length
        : 0,
    [shiftConfirmationEnabled, dashboardShiftsForConfirmation]
  );

  const openConfirmationsCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? dashboardShiftsForConfirmation.filter(
            (shift) =>
              shift.confirmationStatus === "requested" ||
              shift.confirmationStatus === "pending" ||
              shift.confirmationStatus === "rejected"
          ).length
        : 0,
    [shiftConfirmationEnabled, dashboardShiftsForConfirmation]
  );

  const shiftsById = useMemo(() => {
    const map = new Map<string, PlanningShift>();
    for (const shift of locationShifts) {
      map.set(shift.id, shift);
    }
    return map;
  }, [locationShifts]);

  const summary = useMemo(
    () => weeklySummary(calendarDisplayShifts, employees),
    [calendarDisplayShifts, employees]
  );

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === selectedAreaId)?.name ?? "",
    [areas, selectedAreaId]
  );

  const selectedLocationName = useMemo(
    () => locations.find((location) => location.id === selectedLocationId)?.name ?? "",
    [locations, selectedLocationId]
  );

  const pushPlanungQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const q = params.toString();
      startTransition(() => {
        router.push(q ? `/planung?${q}` : "/planung");
      });
    },
    [router, searchParams]
  );

  const weekHeader = useMemo(
    () => getDashboardWeekHeaderParts(weekStart, intlLocale),
    [weekStart, intlLocale]
  );

  const weekLabelTitle = `${weekHeader.rangeLabel} ${weekHeader.year} KW ${weekHeader.calendarWeek}`;

  const navigateWeek = useCallback(
    (delta: number) => {
      if (delta < 0 && atEarliestWeek) return;
      const d = parseISODate(weekStart);
      d.setDate(d.getDate() + delta * 7);
      pushPlanungQuery({ week: toISODate(d) });
    },
    [atEarliestWeek, pushPlanungQuery, weekStart]
  );

  const goToToday = useCallback(() => {
    pushPlanungQuery({ week: toISODate(startOfWeek(new Date())) });
  }, [pushPlanungQuery]);

  const navigateToWeekFromNotification = useCallback(
    (nextWeekStart: string) => {
      if (nextWeekStart === weekStart) return;
      pushPlanungQuery({ week: nextWeekStart });
    },
    [pushPlanungQuery, weekStart]
  );

  function isDayReadOnly(date: string) {
    return readOnlyWeek || isPastShiftDate(date);
  }

  function applyPreset(preset: DashboardAssignmentPreset) {
    setSelectedPresetId(preset.id);
    setStartTime(timeFieldValue(preset.start_time));
    setEndTime(timeFieldValue(preset.end_time));
  }

  function openPicker(employeeId: string, date: string, shiftId?: string) {
    const cellShifts = shiftsByCell.get(`${employeeId}:${date}`) ?? [];
    const existing = shiftId
      ? cellShifts.find((shift) => shift.id === shiftId)
      : undefined;
    if (isDayReadOnly(date) && !existing && cellShifts.length === 0) return;
    if (
      !existing &&
      cellShifts.length === 0 &&
      getDayAssignBlockReason(employeeId, date, recurringAvailability, absences)
    ) {
      return;
    }
    setPicker({
      employeeId: existing?.employee_id ?? employeeId,
      date,
      shiftId,
    });
    setSelectedEmployeeId(existing?.employee_id ?? employeeId);
    setQualificationManuallySelected(false);
    if (existing) {
      setStartTime(existing.startTime);
      setEndTime(existing.endTime);
      const matchedPresetId =
        resolvePresetIdFromTimes(
          existing.startTime,
          existing.endTime,
          assignmentPresets
        ) ?? "";
      setSelectedPresetId(matchedPresetId);
      if (selectedAreaId) {
        const serviceHourId = findServiceHourIdForShift(
          serviceHours,
          selectedAreaId,
          date,
          existing.startTime,
          existing.endTime
        );
        setQualificationId(
          presetQualificationForServiceHour(
            staffingRules,
            selectedAreaId,
            serviceHourId
          )
        );
      } else {
        setQualificationId("");
      }
    } else {
      const demandPrefill =
        !simplePlanning && selectedAreaId && showStaffingHeaderRow
          ? resolvePlanningAssignPrefillFromOpenDemand({
              employeeId,
              dateISO: date,
              areaId: selectedAreaId,
              staffingEntries: dailyStaffingByDate.get(date) ?? [],
              serviceHours,
              assignmentPresets,
      staffingRules,
      profileQualificationIds,
              recurringAvailability,
              absences,
              employees,
            })
          : null;

      if (demandPrefill) {
        setSelectedPresetId(demandPrefill.presetId);
        setStartTime(demandPrefill.startTime);
        setEndTime(demandPrefill.endTime);
        setQualificationId(demandPrefill.qualificationId);
      } else if (assignmentPresets[0]) {
        applyPreset(assignmentPresets[0]);
        if (selectedAreaId) {
          const preset = assignmentPresets[0];
          const serviceHourId = findServiceHourIdForShift(
            serviceHours,
            selectedAreaId,
            date,
            timeFieldValue(preset.start_time),
            timeFieldValue(preset.end_time)
          );
          setQualificationId(
            presetQualificationForServiceHour(
              staffingRules,
              selectedAreaId,
              serviceHourId
            )
          );
        } else {
          setQualificationId("");
        }
      } else {
        setSelectedPresetId("");
        setStartTime("00:00");
        setEndTime("00:00");
        setQualificationId("");
      }
    }
  }

  useEffect(() => {
    if (skipPresetFromTimesSyncRef.current) {
      skipPresetFromTimesSyncRef.current = false;
      return;
    }
    if (!timesComplete) {
      if (selectedPresetId) setSelectedPresetId("");
      return;
    }
    const matchedPresetId = resolvePresetIdFromTimes(
      startTime,
      endTime,
      assignmentPresets
    );
    if (matchedPresetId !== selectedPresetId) {
      setSelectedPresetId(matchedPresetId ?? "");
    }
  }, [startTime, endTime, assignmentPresets, selectedPresetId, timesComplete]);

  function handlePresetChange(presetId: string) {
    const preset = assignmentPresets.find((entry) => entry.id === presetId);
    if (preset) {
      skipPresetFromTimesSyncRef.current = true;
      applyPreset(preset);
    } else {
      setSelectedPresetId(presetId);
    }
  }

  async function handleAssign(options?: {
    withoutServiceHours?: boolean;
  }): Promise<PlanningShiftActionResult> {
    if (!picker || isDayReadOnly(picker.date) || !selectedEmployeeId) {
      return { ok: false, error: t("dashboard.bulkShiftValidationTimesRequired") };
    }
    if (!selectedLocationId) {
      return { ok: false, error: t("dashboard.noLocations") };
    }
    if (!simplePlanning && !selectedAreaId) {
      return { ok: false, error: t("planning.noAreas") };
    }
    if (!timesComplete) {
      return { ok: false, error: t("dashboard.bulkShiftValidationTimesRequired") };
    }

    if (!options?.withoutServiceHours && !simplePlanning) {
      const serviceHoursCheck = validateDashboardShiftServiceHours(
        serviceHours,
        selectedAreaId!,
        picker.date,
        startTime,
        endTime
      );
      if (!serviceHoursCheck.ok) {
        return {
          ok: false,
          error: translateActionError(serviceHoursCheck.error, t),
        };
      }
    }

    const weekday = profileAvailabilityWeekdayFromDashboardDate(picker.date);
    if (isEmployeeAbsentOnDate(selectedEmployeeId, absences, picker.date)) {
      return { ok: false, error: t("shiftAssign.employeeAbsent") };
    }
    if (
      !employeeMatchesShiftAvailability(
        selectedEmployeeId,
        recurringAvailability,
        weekday,
        startTime,
        endTime
      )
    ) {
      return { ok: false, error: t("shiftAssign.shiftOutsideAvailability") };
    }

    const editingShift = picker.shiftId
      ? shifts.find((shift) => shift.id === picker.shiftId)
      : undefined;
    const reassigningToDifferentEmployee =
      editingShift != null && selectedEmployeeId !== picker.employeeId;

    if (reassigningToDifferentEmployee) {
      const removeResult = await removeShift(editingShift.id);
      if (!removeResult.ok) {
        return {
          ok: false,
          error: translateActionError(removeResult.error, t),
        };
      }
    }

    const result = await assignShiftWithTimes({
      employeeId: selectedEmployeeId,
      shiftDate: picker.date,
      startTime,
      endTime,
      areaShiftTemplateId: simplePlanning
        ? null
        : areaShiftTemplateIdForAssign(selectedPresetId),
      locationId: selectedLocationId,
      locationAreaId: simplePlanning ? null : selectedAreaId,
      withoutServiceHours: options?.withoutServiceHours,
      existingShiftId:
        reassigningToDifferentEmployee ? undefined : editingShift?.id,
      simulatedProposedOnAssign,
    });

    if (!result.ok) {
      return { ok: false, error: translateActionError(result.error, t) };
    }

    router.refresh();

    if (result.warnings?.length) {
      return { ok: true, warnings: result.warnings };
    }

    setPicker(null);
    setSelectedEmployeeId("");
    setQualificationId("");
    setNote("");
    return { ok: true };
  }

  async function handleRemove(shiftId: string): Promise<PlanningShiftActionResult> {
    if (picker && isDayReadOnly(picker.date)) {
      return { ok: false, error: t("planning.readOnlyDay") };
    }

    const result = await removeShift(shiftId);
    if (!result.ok) {
      return { ok: false, error: translateActionError(result.error, t) };
    }

    setPicker(null);
    setSelectedEmployeeId("");
    setQualificationId("");
    router.refresh();
    return { ok: true };
  }

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
      setCellContextMenu(null);
    },
    [serviceHours]
  );

  const handleCellContextMenu = useCallback(
    (employeeId: string, date: string, clientX: number, clientY: number) => {
      const { x, y } = clampPlanningContextMenuPosition(
        clientX,
        clientY,
        simplePlanning,
        shiftConfirmationEnabled
      );
      setCellContextMenu({ x, y, employeeId, date });
    },
    [simplePlanning, shiftConfirmationEnabled]
  );

  const handleShiftContextMenu = useCallback(
    (
      employeeId: string,
      date: string,
      shiftId: string,
      clientX: number,
      clientY: number
    ) => {
      const { x, y } = clampPlanningContextMenuPosition(
        clientX,
        clientY,
        simplePlanning,
        shiftConfirmationEnabled
      );
      skipCellContextMenuCloseRef.current = true;
      setCellContextMenu({ x, y, employeeId, date, shiftId });
    },
    [simplePlanning, shiftConfirmationEnabled]
  );

  const canOpenSingleAssignFromContext = useCallback(
    (employeeId: string, date: string) => {
      const cellSegments = shiftsByCellDisplay.get(`${employeeId}:${date}`) ?? [];
      if (isDayReadOnly(date) && cellSegments.length === 0) return false;
      if (
        cellSegments.length === 0 &&
        getDayAssignBlockReason(employeeId, date, recurringAvailability, absences)
      ) {
        return false;
      }
      return true;
    },
    [shiftsByCellDisplay, recurringAvailability, absences, readOnlyWeek]
  );

  useEffect(() => {
    if (!cellContextMenu) return;

    function handlePointerDown(event: MouseEvent) {
      if (skipCellContextMenuCloseRef.current) {
        skipCellContextMenuCloseRef.current = false;
        return;
      }
      const menu = cellContextMenuRef.current;
      if (!menu) return;
      if (menu.contains(event.target as Node)) return;
      const distance = distanceFromPointToMenu(
        event.clientX,
        event.clientY,
        menu
      );
      if (distance > CONTEXT_MENU_CLOSE_DISTANCE_PX) {
        setCellContextMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [cellContextMenu]);

  const handleContextAssignSingle = useCallback(() => {
    if (!cellContextMenu) return;
    skipCellContextMenuCloseRef.current = true;
    const { employeeId, date } = cellContextMenu;
    setCellContextMenu(null);
    openPicker(employeeId, date);
  }, [cellContextMenu, openPicker]);

  const handleContextAssignBulk = useCallback(() => {
    if (!cellContextMenu || !selectedAreaId) return;
    skipCellContextMenuCloseRef.current = true;
    const { employeeId, date } = cellContextMenu;
    const cellSegments = shiftsByCellDisplay.get(`${employeeId}:${date}`) ?? [];
    const uniqueShiftIds = [
      ...new Set(cellSegments.map((segment) => segment.shift.id)),
    ];
    setCellContextMenu(null);
    openBulkShiftDialogForAreaDay(selectedAreaId, date, {
      focusShiftId: uniqueShiftIds.length === 1 ? uniqueShiftIds[0] : undefined,
    });
  }, [cellContextMenu, selectedAreaId, shiftsByCellDisplay, openBulkShiftDialogForAreaDay]);

  const handleContextRemoveShift = useCallback(() => {
    if (!cellContextMenu) return;
    const cellSegments =
      shiftsByCellDisplay.get(
        `${cellContextMenu.employeeId}:${cellContextMenu.date}`
      ) ?? [];
    const uniqueShiftIds = [
      ...new Set(cellSegments.map((segment) => segment.shift.id)),
    ];
    const shiftId =
      cellContextMenu.shiftId ??
      (uniqueShiftIds.length === 1 ? uniqueShiftIds[0] : undefined);
    if (!shiftId || isDayReadOnly(cellContextMenu.date)) return;
    skipCellContextMenuCloseRef.current = true;
    setCellContextMenu(null);
    setDeleteShiftError(null);
    setShiftDeleteConfirmId(shiftId);
  }, [cellContextMenu, shiftsByCellDisplay, readOnlyWeek]);

  const handleContextSendConfirmation = useCallback(() => {
    if (!cellContextMenu || !selectedLocationId) return;
    const cellSegments =
      shiftsByCellDisplay.get(
        `${cellContextMenu.employeeId}:${cellContextMenu.date}`
      ) ?? [];
    const uniqueShiftIds = [
      ...new Set(cellSegments.map((segment) => segment.shift.id)),
    ];
    const shiftId =
      cellContextMenu.shiftId ??
      (uniqueShiftIds.length === 1 ? uniqueShiftIds[0] : undefined);
    if (!shiftId) return;
    const shift = shiftsById.get(shiftId);
    if (shift?.confirmationStatus !== "proposed") return;
    skipCellContextMenuCloseRef.current = true;
    setCellContextMenu(null);
    setConfirmationSendError(null);
    startSendConfirmation(async () => {
      if (blocksOutboundSend && !simulatedProposedOnAssign) {
        setConfirmationSendError(
          getShiftConfirmationSimulationSendBlockedResult().error
        );
        return;
      }
      const result = await sendConfirmationRequestForShift({
        shiftId,
        weekStart,
        locationId: selectedLocationId,
        simulatedProposedOnAssign,
      });
      if (!result.ok) {
        setConfirmationSendError(translateActionError(result.error, t));
        return;
      }
      router.refresh();
    });
  }, [
    cellContextMenu,
    shiftsByCellDisplay,
    shiftsById,
    selectedLocationId,
    weekStart,
    router,
    t,
    blocksOutboundSend,
    simulatedProposedOnAssign,
  ]);

  const handleReassignFromPanel = useCallback(
    (shift: DashboardShiftCard) => {
      setConfirmationsPanelOpen(false);
      if (!shift.locationAreaId) return;
      openBulkShiftDialogForAreaDay(shift.locationAreaId, shift.shift_date, {
        focusShiftId: shift.id,
      });
    },
    [openBulkShiftDialogForAreaDay]
  );

  const handleConfirmDeleteShift = useCallback(() => {
    if (!shiftDeleteConfirmId) return;
    setDeleteShiftError(null);
    startDeleteShift(async () => {
      const result = await removeShift(shiftDeleteConfirmId);
      if (!result.ok) {
        setDeleteShiftError(translateActionError(result.error, t));
        return;
      }
      setShiftDeleteConfirmId(null);
      setPicker(null);
      router.refresh();
    });
  }, [shiftDeleteConfirmId, router, t]);

  const handleBulkShiftSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const contextMenuRemoveShiftId = cellContextMenu
    ? (cellContextMenu.shiftId ??
      (() => {
        const cellSegments =
          shiftsByCellDisplay.get(
            `${cellContextMenu.employeeId}:${cellContextMenu.date}`
          ) ?? [];
        const uniqueShiftIds = [
          ...new Set(cellSegments.map((segment) => segment.shift.id)),
        ];
        return uniqueShiftIds.length === 1 ? uniqueShiftIds[0] : undefined;
      })())
    : undefined;

  const contextMenuSendConfirmationShiftId =
    cellContextMenu && shiftConfirmationEnabled
      ? (() => {
          const shiftId = contextMenuRemoveShiftId;
          if (!shiftId) return undefined;
          return shiftsById.get(shiftId)?.confirmationStatus === "proposed"
            ? shiftId
            : undefined;
        })()
      : undefined;

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-muted">
          {t("planning.noEmployeesPrefix")}{" "}
          <a href="/dashboard?profiles=1" className="font-medium text-primary">
            {t("planning.noEmployeesProfilesLink")}
          </a>{" "}
          {t("planning.noEmployeesSuffix")}
        </p>
      </div>
    );
  }

  const getDayAssignBlockReasonForCell = useCallback(
    (employeeId: string, date: string) =>
      getDayAssignBlockReason(
        employeeId,
        date,
        recurringAvailability,
        absences
      ),
    [recurringAvailability, absences]
  );

  const canAssign =
    Boolean(selectedLocationId) &&
    (simplePlanning ||
      (Boolean(selectedAreaId) && assignmentPresets.length > 0));

  return (
    <div className="-m-4 flex min-h-[calc(100vh-4.5rem)] flex-col bg-subtle md:-m-6">
      <header
        className={cn(
          APP_PAGE_TOOLBAR_HEADER_CLASS,
          shellLocked && "pointer-events-none opacity-50"
        )}
        aria-hidden={shellLocked || undefined}
        {...(shellLocked ? { inert: true } : {})}
      >
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
          <h1 className="shrink-0 text-2xl font-semibold tracking-tight md:text-xl">
            Schichtplan erstellen
          </h1>

          <div className="flex min-w-0 flex-wrap items-center gap-3 select-none md:gap-4 md:ml-2">
            <div
              role="group"
              aria-label={`${t("common.prevWeek")} / ${t("common.nextWeek")}`}
              className="flex shrink-0 items-center gap-1.5 sm:gap-2"
            >
              <IconButton
                size="md"
                onClick={() => navigateWeek(-1)}
                disabled={controlsDisabled || atEarliestWeek}
                aria-label={t("common.prevWeek")}
                className={cn(HEADER_CONTROL_H, "shrink-0 text-muted")}
              >
                <ChevronIcon direction="left" />
              </IconButton>

              <Button
                type="button"
                variant="outline"
                size="header"
                onClick={goToToday}
                disabled={controlsDisabled}
                className={cn(HEADER_CONTROL_H, "shrink-0 font-semibold")}
              >
                {t("common.today")}
              </Button>

              <IconButton
                size="md"
                onClick={() => navigateWeek(1)}
                disabled={controlsDisabled}
                aria-label={t("common.nextWeek")}
                className={cn(HEADER_CONTROL_H, "shrink-0 text-muted")}
              >
                <ChevronIcon direction="right" />
              </IconButton>
            </div>

            <p
              className="min-w-0 select-none text-sm leading-none"
              title={weekLabelTitle}
            >
              <span className="font-semibold">{weekHeader.monthYearLabel}</span>
              <span className="ml-1.5 text-xs font-normal text-muted">
                KW {weekHeader.calendarWeek}
              </span>
            </p>

            {features.areas ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 md:ml-2">
                <span className="hidden shrink-0 text-sm text-foreground sm:inline">
                  {t("dashboard.location")}
                </span>
                <LocationSelect
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  basePath="/planung"
                  className="!mt-0 min-w-0 flex-1 font-semibold sm:w-[11rem] sm:flex-none sm:shrink-0"
                />
                <span className="shrink-0 text-sm text-foreground">
                  {t("planning.area")}
                </span>
                <div className="w-[11rem] shrink-0">
                  {areas.length === 0 ? (
                    <ControlDisplay className="w-full py-2 text-muted">
                      {t("planning.noAreas")}
                    </ControlDisplay>
                  ) : (
                    <Select
                      value={selectedAreaId ?? areas[0].id}
                      disabled={controlsDisabled || areas.length === 0}
                      aria-label={t("planning.selectArea")}
                      className="w-full font-semibold"
                      onChange={(event) =>
                        pushPlanungQuery({ area: event.target.value })
                      }
                    >
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                          {area.archived_at ? ` (${t("common.archived")})` : ""}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
          {shiftConfirmationEnabled && proposedSendCount > 0 ? (
            <Button
              type="button"
              size="header"
              onClick={openSendConfirmation}
              disabled={controlsDisabled || sendConfirmationPending}
              className={cn(HEADER_CONTROL_H, "font-semibold")}
            >
              {t("shiftConfirmation.actions.requestConfirmation")}
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-xs tabular-nums">
                {proposedSendCount}
              </span>
            </Button>
          ) : null}
          {shiftConfirmationEnabled ? (
            <IconButton
              type="button"
              size="md"
              aria-label={t("shiftConfirmation.panel.title")}
              title={t("shiftConfirmation.panel.title")}
              className="relative"
              onClick={() => openConfirmationsPanel()}
            >
              <ListIcon />
              {openConfirmationsCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {openConfirmationsCount > 9 ? "9+" : openConfirmationsCount}
                </span>
              ) : null}
            </IconButton>
          ) : null}
          {shiftConfirmationEnabled ? (
            <DashboardNotificationCenter
              enabled={shiftConfirmationEnabled}
              initialNotifications={managerNotifications}
              onOpenConfirmationsPanel={openConfirmationsPanel}
              onNavigateToWeek={navigateToWeekFromNotification}
            />
          ) : null}
          <LanguageSelect className="shrink-0" />
        </div>
      </header>

      {readOnlyWeek && (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {t("planning.readOnlyWeek")}
        </Alert>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <main
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3 md:px-4 md:pb-4",
            APP_SHELL_CONTENT_OFFSET_CLASS
          )}
        >
          <PlanningCalendarGrid
            dates={dates}
            employees={employees}
            shifts={shifts}
            calendarDisplayShifts={calendarDisplayShifts}
            shiftsByCell={calendarShiftsByCell}
            shiftsByCellDisplay={shiftsByCellDisplay}
            holidayNames={holidayNames}
            dayHasServiceHours={dayHasServiceHours}
            dayHasOpenArea={dayHasOpenArea}
            activeDayDates={activeDayDates}
            layoutActiveDayDates={layoutActiveDayDates}
            layoutTransitionEnabled={layoutTransitionEnabled}
            dayReferenceShiftTimesByDate={dayReferenceShiftTimesByDate}
            serviceTimelinesByDate={serviceTimelinesByDate}
            columnTemplate={columnTemplate}
            headerRowTemplate={planningHeaderRowTemplate}
            bodyRowTemplate={planningBodyRowTemplate}
            minCalendarWidth={minPlanningCalendarWidth}
            fillColumnsEqually={fillColumnsEqually}
            narrowDayColumnWidthsPx={narrowDayColumnWidthsPx}
            dayUsesWideColumn={dayUsesWideColumn}
            isCalendarVisible={isPlanningCalendarVisible}
            todayISO={todayISO}
            intlLocale={intlLocale}
            locale={locale}
            pending={pending}
            canAssign={canAssign}
            assignmentPresets={assignmentPresets}
            picker={picker}
            showStaffingHeaderRow={showStaffingHeaderRow}
            dailyStaffingByDate={dailyStaffingByDate}
            dailyFooterLabelsByDate={dailyFooterLabelsByDate}
            weeklySummary={summary}
            t={t}
            isDayReadOnly={isDayReadOnly}
            getDayAssignBlockReason={getDayAssignBlockReasonForCell}
            onToggleDayActive={toggleDayActive}
            onOpenPicker={openPicker}
            onCellContextMenu={handleCellContextMenu}
            onShiftContextMenu={handleShiftContextMenu}
            selectedAreaId={selectedAreaId}
            serviceHours={serviceHours}
            staffingRules={staffingRules}
            qualifications={qualifications}
            profileQualificationIds={profileQualificationIdsRecord}
          />
        </main>

        {cellContextMenu ? (
          <div
            ref={cellContextMenuRef}
            className="fixed z-[100] min-w-[15rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
            style={{ left: cellContextMenu.x, top: cellContextMenu.y }}
            role="menu"
            aria-label={t("planning.contextAssignSingle")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !canOpenSingleAssignFromContext(
                  cellContextMenu.employeeId,
                  cellContextMenu.date
                )
              }
              onClick={handleContextAssignSingle}
            >
              {t("planning.contextAssignSingle")}
            </button>
            {!simplePlanning ? (
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedAreaId}
                onClick={handleContextAssignBulk}
              >
                {t("planning.contextAssignBulk")}
              </button>
            ) : null}
            {shiftConfirmationEnabled && contextMenuSendConfirmationShiftId ? (
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                disabled={sendConfirmationPending}
                onClick={handleContextSendConfirmation}
              >
                {t("shiftConfirmation.actions.requestConfirmation")}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !contextMenuRemoveShiftId ||
                isDayReadOnly(cellContextMenu.date)
              }
              onClick={handleContextRemoveShift}
            >
              {t("planning.contextRemoveShift")}
            </button>
          </div>
        ) : null}

        {picker ? (
          <PlanningAssignShiftModal
            date={picker.date}
            areaName={selectedAreaName}
            areaId={selectedAreaId}
            intlLocale={intlLocale}
            t={t}
            simplePlanning={simplePlanning}
            assignmentPresets={assignmentPresets}
            selectedPresetId={selectedPresetId}
            onPresetChange={handlePresetChange}
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            selectedEmployeeId={selectedEmployeeId}
            onEmployeeChange={setSelectedEmployeeId}
            qualificationId={qualificationId}
            onQualificationChange={setQualificationId}
            qualificationManuallySelected={qualificationManuallySelected}
            onQualificationManuallySelectedChange={setQualificationManuallySelected}
            staffingRules={staffingRules}
            serviceHours={serviceHours}
            qualifications={qualifications}
            profileQualificationIds={profileQualificationIds}
            note={note}
            onNoteChange={setNote}
            dayReadOnly={isDayReadOnly(picker.date)}
            timesComplete={timesComplete}
            canAssign={canAssign}
            hasExistingShift={Boolean(picker.shiftId)}
            presetEmployeeId={
              picker.shiftId ? undefined : picker.employeeId
            }
            presetEmployee={(() => {
              if (picker.shiftId) return undefined;
              const profile = employees.find(
                (entry) => entry.id === picker.employeeId
              );
              if (!profile) return undefined;
              return {
                id: profile.id,
                full_name: profile.full_name,
                color: profile.color ?? null,
              };
            })()}
            onAssign={handleAssign}
            onRemove={async () => {
              if (!picker.shiftId) {
                return { ok: false, error: t("planning.readOnlyDay") };
              }
              return handleRemove(picker.shiftId);
            }}
            onClose={() => {
              setPicker(null);
              setSelectedEmployeeId("");
              setQualificationId("");
              setNote("");
            }}
          />
        ) : null}

      {bulkShiftDialog && selectedLocationId && selectedAreaId && !simplePlanning ? (
        <DashboardBulkShiftModal
          key={`planning-bulk:${bulkShiftDialog.areaId}:${bulkShiftDialog.date}:${bulkShiftDialog.focusShiftId ?? ""}:${bulkShiftDialog.withoutServiceHours ? "nosh" : "sh"}`}
          dialog={bulkShiftDialog}
          locationId={selectedLocationId}
          locationName={selectedLocationName}
          areas={areas}
          areaShiftTemplates={areaShiftTemplates}
          staffingRules={staffingRules}
          serviceHours={serviceHours}
          qualifications={qualifications}
          existingAreaShifts={locationShifts
            .filter(
              (shift) =>
                shift.location_area_id === bulkShiftDialog.areaId &&
                shift.shift_date === bulkShiftDialog.date
            )
            .map((shift) => ({
              id: shift.id,
              employeeId: shift.employee_id,
              startTime: shift.startTime,
              endTime: shift.endTime,
              areaShiftTemplateId: shift.area_shift_template_id,
            }))}
          areaExistingAssignments={locationShifts
            .filter(
              (shift) =>
                shift.location_area_id === bulkShiftDialog.areaId &&
                shift.shift_date === bulkShiftDialog.date
            )
            .map((shift) => ({
              employeeId: shift.employee_id,
              startTime: shift.startTime,
              endTime: shift.endTime,
            }))}
          locationDayAssignments={locationShifts
            .filter((shift) => shift.shift_date === bulkShiftDialog.date)
            .map((shift) => ({
              employeeId: shift.employee_id,
              startTime: shift.startTime,
              endTime: shift.endTime,
              locationAreaId: shift.location_area_id,
            }))}
          onClose={() => setBulkShiftDialog(null)}
          onSaved={handleBulkShiftSaved}
        />
      ) : null}

      {shiftDeleteConfirmId ? (
        <DashboardShiftDeleteConfirmModal
          pending={deleteShiftPending}
          onCancel={() => {
            if (deleteShiftPending) return;
            setShiftDeleteConfirmId(null);
            setDeleteShiftError(null);
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

      {sendConfirmationOpen && shiftConfirmationEnabled ? (
        <DashboardSendConfirmationModal
          weekStart={weekStart}
          locationId={selectedLocationId}
          onClose={closeSendConfirmation}
          onBusyChange={setSendConfirmationBusy}
        />
      ) : null}

      {confirmationsPanelOpen && shiftConfirmationEnabled ? (
        <OpenConfirmationsPanel
          key={confirmationsPanelTab}
          shifts={dashboardShiftsForConfirmation}
          initialTab={confirmationsPanelTab}
          onClose={() => setConfirmationsPanelOpen(false)}
          onReassign={handleReassignFromPanel}
          onSendConfirmation={() => {
            setConfirmationsPanelOpen(false);
            openSendConfirmation();
          }}
        />
      ) : null}

      {SETTINGS_MODALS_ON_CURRENT_PAGE && settingsModals ? (
        <SettingsModalsLayer
          data={{
            locations,
            selectedLocationId,
            areas,
            serviceHours,
            fullStaffingRules: staffingRules,
            areaShiftTemplates,
            qualifications,
            compensationSurchargeTypes:
              settingsModals.compensationSurchargeTypes,
            roles: settingsModals.roles,
            profiles: settingsModals.profiles,
          }}
        />
      ) : null}
      </div>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="currentColor"
      aria-hidden
      className={direction === "right" ? "scale-x-[-1]" : undefined}
    >
      <path d="M7 0L1 6l6 6V0z" />
    </svg>
  );
}

/** @deprecated Use ShiftPlanner */
export const WeekCalendar = ShiftPlanner;