"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import { cancelShiftAsManager, confirmPastShiftAsManager, submitCommunicationConfirmationRequests } from "@/app/actions/shift-confirmations";
import { isPastCalendarDate, parseISODate, startOfWeek, toISODate } from "@/lib/dates";
import { usePlanningEmployeeListContextMenu } from "@/lib/use-planning-employee-list-context-menu";
import { useDelayedEmployeeHighlight } from "@/lib/use-delayed-employee-highlight";
import { DashboardCalendarGrid } from "@/components/dashboard/dashboard-calendar-grid";
import { useDashboardCalendarLayer } from "@/components/dashboard/dashboard-calendar-context";
import { CalendarStaffingEditModal } from "@/components/planning/calendar-staffing-edit-modal";
import { buildCalendarStaffingEditorData } from "@/lib/calendar-staffing-editor-data";
import { PlanningEmployeeListContextMenu } from "@/components/planning/planning-employee-list-context-menu";
import { useRegisterPlanningToolbarPageBridge } from "@/lib/planning-toolbar-page-bridge";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";
import {
  DashboardAssignShiftModal,
  type DashboardShiftActionResult,
} from "@/components/dashboard/dashboard-assign-shift-modal";
import { AreaCalendarBulkShiftModal } from "@/components/areacalendar/areacalendar-bulk-shift-modal";
import {
  AreaCalendarAddShiftModal,
  type AreaCalendarAddShiftDialogState,
  type AreaCalendarBulkShiftDialogState,
} from "@/components/areacalendar/areacalendar-add-shift-modal";
import { NoServiceHoursShiftConfirmModal } from "@/components/areacalendar/no-service-hours-shift-confirm-modal";
import {
  CommunicationHubModal,
  communicationBadgeCount,
} from "@/components/areacalendar/communication-hub-modal";
import { AreaCalendarShiftDeleteConfirmModal } from "@/components/areacalendar/areacalendar-shift-delete-confirm-modal";
import { ShiftCancelConfirmModal } from "@/components/shifts/shift-cancel-confirm-modal";
import {
  planningShiftToAreaCalendarCard,
  type PlanningShift,
} from "@/lib/planning-shift-card";
import { resolveNarrowDayColumnWidthsPx } from "@/lib/day-column-width";
import {
  PLANNING_CALENDAR_LAYOUT_ANIMATION_DELAY_MS,
  PLANNING_DAY_FOOTER_ROW_HEIGHT,
  PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
  PLANNING_EMPLOYEE_ROW_HEIGHT,
  planningCalendarMinWidth,
  planningGridTemplateColumns,
  resolveEmployeeCalendarLayoutDayDates,
} from "@/lib/planning-calendar-layout";
import { CALENDAR_DAY_HEADER_ROW_HEIGHT } from "@/lib/calendar-day-header-styles";
import { resolveLocationServiceDayTimeline } from "@/lib/shift-card-cell-layout";
import {
  isAnyAreaOpenInCalendar,
  hasEffectiveServiceHoursOnDate,
  hasStaffingHeaderServiceHoursOnDate,
  areaHasEffectiveServiceHoursOnDate,
  findServiceHourIdForShift,
  serviceWeekdayForDate,
  weekdayLabelFromIndex,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";
import {
  computeBulkStaffingHeaderEntries,
  resolveStaffingHeaderAreaId,
  staffingAssignmentsForAreaDay,
} from "@/lib/bulk-staffing-header";
import { staffingRulesWithOverridesForAreaDate } from "@/lib/staffing-rules-with-overrides";
import { presetQualificationForServiceHour } from "@/lib/bulk-shift-qualification";
import { resolveOpenDemandShiftPrefill } from "@/lib/bulk-shift-staffing";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { clearDocumentTextSelection } from "@/lib/calendar-interaction-ui";
import { buildHolidayNamesByDate } from "@/lib/german-public-holidays";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures, useOrganization, useShiftConfirmationPendingAfterMinutes, useShowCompensationInPlanningUi } from "@/lib/org-features-provider";
import { organizationTodayISO } from "@schichtwerk/database";
import {
  weeklyHoursByEmployeeIdFromEmployees,
  weeklyHoursCheckShiftFromPlanningShift,
  shiftAssignWeekShiftsFromPlanningShifts,
  planningShiftsForCalendarWeek,
} from "@/lib/weekly-hours-check-shifts";
import {
  buildAreaIdToLocationIdMap,
  buildEmployeeWeeklyHoursDisplay,
  buildEmployeeWeeklyHoursCardLabelsByEmployeeId,
  buildEmployeeWeeklyHoursDisplayByEmployeeId,
  buildLocationNameByIdMap,
} from "@/lib/employee-weekly-hours-display";
import { buildBreaksByTemplateIdFromAreaTemplates } from "@/lib/shift-work-hours";
import {
  useEffectiveShiftConfirmationEnabled,
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import { useAppShellModalLockActive, useAppShellWaitCursorActive, useIsAppShellLocked } from "@/lib/app-shell-modal-lock";
import { useClearMainNavPendingWhenReady } from "@/lib/app-shell-main-nav-pending";
import { translateActionError } from "@/lib/translate-action-error";
import { validateShiftAssignWeeklyHoursClient } from "@/lib/shift-weekly-hours-validation-client";
import { DEFAULT_ORGANIZATION_TIME_ZONE } from "@/lib/dates";
import { locationDayAssignmentsFromShiftRefsForDate } from "@/lib/shift-overlap";
import {
  canOpenShiftCardContextMenu,
  isConfirmedShiftCard,
  planningShiftCardShowsPointerCursor,
  shiftCardAllowsRemoveFromAssignDialog,
  shiftCardContextMenuActionLabelKey,
  shiftCardContextMenuActions,
  type ShiftCardContextMenuAction,
} from "@/lib/shift-card-context-menu-actions";
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
  shouldDisplayShiftOnPlanningCalendar,
  translatePastConfirmError,
  translateShiftCancelError,
} from "@/lib/shift-cancellation-policy";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import { weeklySummary } from "@/lib/planning-utils";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import { buildSettingsModalUrl } from "@/lib/settings-modal-navigation";
import {
  areaShiftTemplatesForArea,
  areaCalendarAssignmentPresetsForArea,
  resolvePresetIdFromTimes,
  areaShiftTemplateIdForAssign,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import { validateAreaCalendarShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  areAreaCalendarShiftTimesComplete,
  profileAvailabilityWeekdayFromAreaCalendarDate,
} from "@/lib/available-employees-for-shift";
import {
  getPlanningDayAssignBlockReason,
} from "@/lib/planning-day-assign-block-reason";
import { canOpenAssignShiftContextMenu, canPromptNoServiceHoursShiftAssignForDay, canPromptNoServiceHoursShiftAssign, canShowAreaDayAssignContextMenu, canShowEmployeeDayCellAssignContextMenu, isAreaCalendarAssignDayActive } from "@/lib/areacalendar-area-day-assign";
import {
  employeeMatchesShiftAvailability,
  isEmployeeAbsentOnDate,
} from "@schichtwerk/database";
import { sortProfilesByShiftCountDesc } from "@/lib/profile-display-sort";
import {
  buildPlanningShiftsByCellDisplay,
  type PlanningShiftDisplaySegment,
} from "@/lib/planning-overnight-shift-display";
import { pickFirstPlanningShiftPerEmployeeDay } from "@/lib/simple-calendar-display-toggle";
import { useSimpleCalendarDisplay } from "@/lib/simple-calendar-display-context";
import { useDashboardStaffColumnWidthPx } from "@/lib/use-dashboard-staff-column-width";
import {
  PLANNING_PAGE_CALENDAR_BODY_CLASS,
  PLANNING_PAGE_CALENDAR_CONTENT_PADDING_CLASS,
  APP_SHELL_CONTENT_OFFSET_CLASS,
  PLANNING_PAGE_CALENDAR_MAIN_CLASS,
  PLANNING_PAGE_CALENDAR_SECTION_CLASS,
} from "@/lib/app-shell-layout";
import {
  computeTagAreaDayFooterStatsForDate,
  formatTagAreaFooterLabels,
} from "@/lib/tag-area-footer-stats";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
import { useLocallyRemovedShifts } from "@/lib/use-locally-removed-shifts";
import type {
  CommunicationOpenOptions,
  CommunicationSwapRequestRow,
} from "@/lib/communication-hub";
import { collectShiftAbsenceConflicts } from "@/lib/shift-absence-conflict";
import {
  DASHBOARD_CELL_CONTEXT_MENU_WIDTH_PX,
  AREA_DAY_CONTEXT_MENU_WIDTH_PX,
  PLANNING_CONTEXT_MENU_SURFACE_CLASS,
  useClampedContextMenuPosition,
} from "@/lib/context-menu-position";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  CompensationSurchargeType,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Profile,
  ProfileRecurringAvailability,
  Qualification,
  Role,
  ManagerNotification,
} from "@schichtwerk/types";
import { SettingsMessageModal } from "@/components/settings/settings-message-modal";
import {
  Button,
  IconButton,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";

export type { PlanningShift } from "@/lib/planning-shift-card";

type Props = {
  weekStart: string;
  dates: string[];
  employees: Profile[];
  shifts: PlanningShift[];
  locationShifts: PlanningShift[];
  organizationWeekShifts?: PlanningShift[];
  recurringAvailability: ProfileRecurringAvailability[];
  absences: AbsenceRequest[];
  communicationSwapRequests?: CommunicationSwapRequestRow[];
  communicationCancelActors?: Record<string, "employee" | "manager">;
  communicationHubLocationShifts?: PlanningShift[];
  communicationHubAbsences?: AbsenceRequest[];
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  selectedAreaId: string | null;
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides?: LocationAreaStaffingOverride[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  readOnlyWeek?: boolean;
  managerNotifications?: ManagerNotification[];
  settingsModals?: {
    profiles: Profile[];
    roles: Role[];
    compensationSurchargeTypes: CompensationSurchargeType[];
  };
};

type Picker = {
  employeeId: string;
  date: string;
  shiftId?: string;
  withoutServiceHours?: boolean;
};

type CellContextMenuState = {
  x: number;
  y: number;
  employeeId: string;
  date: string;
  shiftId?: string;
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

type DayAssignContextMenuState = {
  x: number;
  y: number;
  date: string;
};

const PLANNING_CELL_CONTEXT_MENU_ITEM_HEIGHT_PX = 36;
const CONTEXT_MENU_CLOSE_DISTANCE_PX = 20;
const SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM = true;

function planningCellContextMenuHeightPx(
  simplePlanning: boolean,
  shiftConfirmationEnabled: boolean
): number {
  const items =
    (simplePlanning ? 2 : 3) + (shiftConfirmationEnabled ? 1 : 0);
  return items * PLANNING_CELL_CONTEXT_MENU_ITEM_HEIGHT_PX + 8;
}

function planningShiftContextMenuHeightPx(actionCount: number): number {
  return actionCount * PLANNING_CELL_CONTEXT_MENU_ITEM_HEIGHT_PX + 8;
}

function clampPlanningContextMenuPosition(
  clientX: number,
  clientY: number,
  menuHeight: number
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }
  const padding = 8;
  const menuWidth = DASHBOARD_CELL_CONTEXT_MENU_WIDTH_PX;
  const maxX = Math.max(padding, window.innerWidth - menuWidth - padding);
  const maxY = Math.max(padding, window.innerHeight - menuHeight - padding);
  return {
    x: Math.min(Math.max(padding, clientX), maxX),
    y: Math.min(Math.max(padding, clientY), maxY),
  };
}

function clampPlanningCellContextMenuPosition(
  clientX: number,
  clientY: number,
  simplePlanning: boolean,
  shiftConfirmationEnabled: boolean
): { x: number; y: number } {
  return clampPlanningContextMenuPosition(
    clientX,
    clientY,
    planningCellContextMenuHeightPx(simplePlanning, shiftConfirmationEnabled)
  );
}

function planningAreaDayContextMenuHeightPx(simplePlanning: boolean): number {
  const items =
    (SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM ? 1 : 0) + (!simplePlanning ? 1 : 0);
  return items * PLANNING_CELL_CONTEXT_MENU_ITEM_HEIGHT_PX + 8;
}

function clampPlanningAreaDayContextMenuPosition(
  clientX: number,
  clientY: number,
  simplePlanning: boolean
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }
  const padding = 8;
  const menuWidth = AREA_DAY_CONTEXT_MENU_WIDTH_PX;
  const menuHeight = planningAreaDayContextMenuHeightPx(simplePlanning);
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

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

export function DashboardView({
  weekStart,
  dates,
  employees: employeesFromProps,
  shifts: shiftsFromProps,
  locationShifts: locationShiftsFromProps,
  organizationWeekShifts: organizationWeekShiftsFromProps = [],
  recurringAvailability: recurringAvailabilityFromProps,
  absences: absencesFromProps,
  communicationSwapRequests: communicationSwapRequestsFromProps = [],
  communicationCancelActors: communicationCancelActorsFromProps = {},
  communicationHubLocationShifts: communicationHubLocationShiftsFromProps = [],
  communicationHubAbsences: communicationHubAbsencesFromProps = [],
  locations: locationsFromProps,
  selectedLocationId,
  areas: areasFromProps,
  selectedAreaId: selectedAreaIdFromProps,
  areaShiftTemplates: areaShiftTemplatesFromProps,
  serviceHours: serviceHoursFromProps,
  staffingRules: staffingRulesFromProps,
  staffingOverrides: staffingOverridesFromProps = [],
  qualifications: qualificationsFromProps,
  profileQualificationIds: profileQualificationIdsFromProps,
  readOnlyWeek = false,
  managerNotifications: managerNotificationsFromProps = [],
  settingsModals: settingsModalsFromProps,
}: Props) {
  const calendarLayer = useDashboardCalendarLayer();
  const calendarLayerReady = calendarLayer === null || calendarLayer.ready;
  const calendarPending = calendarLayer !== null && !calendarLayer.ready;
  const layer = calendarLayerReady ? calendarLayer?.data : null;

  const employees = layer?.employees ?? employeesFromProps;
  const shifts = layer?.shifts ?? shiftsFromProps;
  const locationShifts = layer?.locationShifts ?? locationShiftsFromProps;
  const organizationWeekShifts =
    layer?.organizationWeekShifts ?? organizationWeekShiftsFromProps;
  const areas = layer?.areas ?? areasFromProps;
  const selectedAreaId = layer?.selectedAreaId ?? selectedAreaIdFromProps;
  const areaShiftTemplates = layer?.areaShiftTemplates ?? areaShiftTemplatesFromProps;
  const serviceHours = layer?.serviceHours ?? serviceHoursFromProps;
  const staffingRules = layer?.staffingRules ?? staffingRulesFromProps;
  const staffingHeaderAreaId = useMemo(
    () =>
      resolveStaffingHeaderAreaId({
        selectedAreaId,
        areas,
        locationShifts,
        staffingRules,
        serviceHours,
      }),
    [selectedAreaId, areas, locationShifts, staffingRules, serviceHours]
  );
  /** Bereich für Schicht-Zuweisung (URL oder Fallback wie Bedarf-Header). */
  const assignAreaId = selectedAreaId ?? staffingHeaderAreaId;
  const staffingOverrides = layer?.staffingOverrides ?? staffingOverridesFromProps;
  const communicationSwapRequests =
    layer?.communicationSwapRequests ?? communicationSwapRequestsFromProps;
  const communicationCancelActors =
    layer?.communicationCancelActors ?? communicationCancelActorsFromProps;
  const communicationHubLocationShifts =
    layer?.communicationHubLocationShifts ??
    communicationHubLocationShiftsFromProps;
  const communicationHubAbsences =
    layer?.communicationHubAbsences ?? communicationHubAbsencesFromProps;
  const locations = locationsFromProps;
  const recurringAvailability = recurringAvailabilityFromProps;
  const absences = absencesFromProps;
  const qualifications = qualificationsFromProps;
  const profileQualificationIdsRecord = profileQualificationIdsFromProps;
  const managerNotifications = managerNotificationsFromProps;
  const settingsModals = settingsModalsFromProps;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { locale } = useLocale();
  const features = useOrgFeatures();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
  const organization = useOrganization();
  const pendingAfterMinutes = useShiftConfirmationPendingAfterMinutes();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
  const simplePlanning = !features.areas;
  const intlLocale = toIntlLocale(locale);
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(parseISODate(todayISO))),
    [todayISO]
  );
  const weeklyHoursTodayISO = useMemo(
    () => organizationTodayISO(organization.timezone),
    [organization.timezone]
  );
  const [pending, startTransition] = useTransition();
  const { highlightedEmployeeId, handleEmployeeHover } = useDelayedEmployeeHighlight();
  const [picker, setPicker] = useState<Picker | null>(null);
  const closeAssignModal = useCallback(() => {
    setPicker(null);
    setSelectedEmployeeId("");
    setQualificationId("");
    setNote("");
  }, []);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [qualificationId, setQualificationId] = useState("");
  const [qualificationManuallySelected, setQualificationManuallySelected] =
    useState(false);
  const [cellContextMenu, setCellContextMenu] =
    useState<CellContextMenuState | null>(null);
  const [dayAssignContextMenu, setDayAssignContextMenu] =
    useState<DayAssignContextMenuState | null>(null);
  const [staffingHeaderContextMenu, setStaffingHeaderContextMenu] =
    useState<StaffingHeaderContextMenuState | null>(null);
  const [staffingEditDialog, setStaffingEditDialog] =
    useState<StaffingEditDialogState | null>(null);
  const {
    menu: employeeListContextMenu,
    menuRef: employeeListContextMenuRef,
    openMenu: openEmployeeListContextMenu,
    openAvailabilities: openEmployeeAvailabilities,
    openAbsences: openEmployeeAbsences,
    openPreferences: openEmployeePreferences,
    openCompensation: openEmployeeCompensation,
    openSurcharges: openEmployeeSurcharges,
    openQualifications: openEmployeeQualifications,
  } = usePlanningEmployeeListContextMenu();
  const [addShiftDialog, setAddShiftDialog] =
    useState<AreaCalendarAddShiftDialogState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<AreaCalendarBulkShiftDialogState | null>(null);
  const [noServiceHoursAssignConfirm, setNoServiceHoursAssignConfirm] =
    useState<{
      employeeId: string;
      date: string;
      mode: "picker" | "bulk";
    } | null>(null);
  const dayAssignContextMenuRef = useRef<HTMLDivElement>(null);
  const skipDayAssignContextMenuCloseRef = useRef(false);
  const dayAssignContextMenuOpenedAtRef = useRef(0);
  const [shiftDeleteConfirmId, setShiftDeleteConfirmId] = useState<string | null>(
    null
  );
  const [deleteShiftError, setDeleteShiftError] = useState<string | null>(null);
  const [deleteShiftPending, startDeleteShift] = useTransition();
  const [shiftCancelConfirm, setShiftCancelConfirm] = useState<{
    shiftId: string;
    employeeName: string;
  } | null>(null);
  const [cancelShiftError, setCancelShiftError] = useState<string | null>(null);
  const [cancelShiftPending, startCancelShift] = useTransition();
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [communicationBusy, setCommunicationBusy] = useState(false);
  const [communicationOptions, setCommunicationOptions] = useState<
    CommunicationOpenOptions | undefined
  >(undefined);
  const { simpleCalendarFirstShiftOnly } = useSimpleCalendarDisplay();
  const [confirmationSendError, setConfirmationSendError] = useState<string | null>(
    null
  );
  const [sendConfirmationPending, startSendConfirmation] = useTransition();
  const [confirmShiftError, setConfirmShiftError] = useState<string | null>(null);
  const [confirmShiftPending, startConfirmShift] = useTransition();
  const cellContextMenuRef = useRef<HTMLDivElement>(null);
  const skipCellContextMenuCloseRef = useRef(false);
  const cellContextMenuOpenedAtRef = useRef(0);
  const staffingHeaderContextMenuRef = useRef<HTMLDivElement>(null);
  const skipStaffingHeaderContextMenuCloseRef = useRef(false);
  const staffingHeaderContextMenuOpenedAtRef = useRef(0);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [note, setNote] = useState("");
  const skipPresetFromTimesSyncRef = useRef(false);

  const shellLocked = useIsAppShellLocked();
  const controlsDisabled = pending || shellLocked || calendarPending;

  useAppShellModalLockActive(
    Boolean(picker) ||
      Boolean(addShiftDialog) ||
      Boolean(bulkShiftDialog) ||
      Boolean(shiftDeleteConfirmId) ||
      Boolean(shiftCancelConfirm) ||
      Boolean(staffingEditDialog) ||
      communicationOpen
  );
  useAppShellWaitCursorActive(communicationBusy);

  function openCommunication(options?: CommunicationOpenOptions) {
    setCommunicationOptions(options);
    setCommunicationBusy(false);
    setCommunicationOpen(true);
  }

  function closeCommunication() {
    setCommunicationOpen(false);
    setCommunicationBusy(false);
    setCommunicationOptions(undefined);
  }

  const templatesForArea = useMemo(
    () =>
      staffingHeaderAreaId
        ? areaShiftTemplatesForArea(staffingHeaderAreaId, areaShiftTemplates)
        : [],
    [areaShiftTemplates, staffingHeaderAreaId]
  );

  const assignmentPresets = useMemo(
    () => areaCalendarAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );

  const serviceHourAreaIds = useMemo(
    () =>
      staffingHeaderAreaId
        ? [staffingHeaderAreaId]
        : areas.map((area) => area.id),
    [staffingHeaderAreaId, areas]
  );

  const holidayNames = useMemo(
    () => buildHolidayNamesByDate(dates, locale === "en" ? "en" : "de"),
    [dates, locale]
  );

  const dayHasServiceHours = useMemo(
    () =>
      dates.map((date) =>
        hasEffectiveServiceHoursOnDate(serviceHours, date, serviceHourAreaIds)
      ),
    [dates, serviceHours, serviceHourAreaIds]
  );

  const dayHasStaffingHeaderServiceHours = useMemo(() => {
    if (!assignAreaId) {
      return dates.map(() => false);
    }
    return dates.map((date) =>
      hasStaffingHeaderServiceHoursOnDate(serviceHours, date, assignAreaId)
    );
  }, [dates, serviceHours, assignAreaId]);

  const locallyRemovedShiftsScopeKey = `${weekStart}:${selectedLocationId ?? ""}:${selectedAreaId ?? ""}`;
  const { removedIds, markRemoved, unmarkRemoved } = useLocallyRemovedShifts(
    locallyRemovedShiftsScopeKey
  );

  const visibleShifts = useMemo(
    () => shifts.filter((shift) => !removedIds.has(shift.id)),
    [shifts, removedIds]
  );

  const visibleLocationShifts = useMemo(
    () => locationShifts.filter((shift) => !removedIds.has(shift.id)),
    [locationShifts, removedIds]
  );

  const visibleCommunicationHubLocationShifts = useMemo(
    () =>
      communicationHubLocationShifts.filter((shift) => !removedIds.has(shift.id)),
    [communicationHubLocationShifts, removedIds]
  );

  const communicationCancelActorsMap = useMemo(
    () => new Map(Object.entries(communicationCancelActors)),
    [communicationCancelActors]
  );

  const calendarPlanningShifts = useMemo(
    () =>
      visibleShifts.filter((shift) =>
        shouldDisplayShiftOnPlanningCalendar({
          id: shift.id,
          shiftDate: shift.shift_date,
          confirmationStatus: shift.confirmationStatus,
          cancelActors: communicationCancelActorsMap,
          cancelledBy: shift.displayState?.openCancellation?.cancelledBy,
        })
      ),
    [visibleShifts, communicationCancelActorsMap]
  );

  const weeklyHoursShifts = useMemo(
    () => planningShiftsForCalendarWeek(organizationWeekShifts, dates),
    [organizationWeekShifts, dates]
  );

  const locationNameById = useMemo(
    () => buildLocationNameByIdMap(locationsFromProps),
    [locationsFromProps]
  );

  const areaIdToLocationId = useMemo(
    () => buildAreaIdToLocationIdMap(areas),
    [areas]
  );

  const breaksByTemplateId = useMemo(
    () => buildBreaksByTemplateIdFromAreaTemplates(areaShiftTemplates),
    [areaShiftTemplates]
  );

  const weeklyHoursTooltipDisplayByEmployeeId = useMemo(
    () =>
      buildEmployeeWeeklyHoursDisplayByEmployeeId({
        employees,
        shifts: weeklyHoursShifts.length ? weeklyHoursShifts : locationShifts,
        weekDates: dates,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: selectedLocationId,
        breaksByTemplateId,
      }),
    [
      employees,
      weeklyHoursShifts,
      locationShifts,
      dates,
      locationNameById,
      areaIdToLocationId,
      selectedLocationId,
      breaksByTemplateId,
    ]
  );

  const weeklyHoursCardLabelsByEmployeeId = useMemo(
    () =>
      buildEmployeeWeeklyHoursCardLabelsByEmployeeId({
        employees,
        shifts: weeklyHoursShifts.length ? weeklyHoursShifts : locationShifts,
        weekDates: dates,
        locale,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: selectedLocationId,
        breaksByTemplateId,
      }),
    [
      employees,
      weeklyHoursShifts,
      locationShifts,
      dates,
      locale,
      locationNameById,
      areaIdToLocationId,
      selectedLocationId,
      breaksByTemplateId,
    ]
  );

  const weeklyHoursOverLimitByEmployeeId = useMemo(() => {
    const map = new Map<string, boolean>();
    const hoursShifts = weeklyHoursShifts.length ? weeklyHoursShifts : locationShifts;
    for (const employee of employees) {
      const display = buildEmployeeWeeklyHoursDisplay({
        employeeId: employee.id,
        shifts: hoursShifts,
        weekDates: dates,
        targetHours: employee.weekly_hours ?? 40,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: selectedLocationId,
        breaksByTemplateId,
      });
      map.set(employee.id, display.totalHours > display.targetHours);
    }
    return map;
  }, [
    employees,
    weeklyHoursShifts,
    locationShifts,
    dates,
    locationNameById,
    areaIdToLocationId,
    selectedLocationId,
    breaksByTemplateId,
  ]);

  const staffingCalendarShifts = useMemo(
    () =>
      visibleLocationShifts.filter((shift) =>
        shouldDisplayShiftOnPlanningCalendar({
          id: shift.id,
          shiftDate: shift.shift_date,
          confirmationStatus: shift.confirmationStatus,
          cancelActors: communicationCancelActorsMap,
          cancelledBy: shift.displayState?.openCancellation?.cancelledBy,
        })
      ),
    [visibleLocationShifts, communicationCancelActorsMap]
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const shift of calendarPlanningShifts) {
      map.set(shift.shift_date, (map.get(shift.shift_date) ?? 0) + 1);
    }
    return map;
  }, [calendarPlanningShifts]);

  const countShiftsInAreaOnDate = useCallback(
    (date: string, areaId: string | null | undefined = assignAreaId) => {
      if (!areaId) return 0;
      return staffingCalendarShifts.filter(
        (shift) =>
          shift.shift_date === date && shift.location_area_id === areaId
      ).length;
    },
    [staffingCalendarShifts, assignAreaId]
  );

  const dayReferenceShiftTimesByDate = useMemo(() => {
    const map = new Map<
      string,
      readonly { startTime: string; endTime: string }[]
    >();
    for (const date of dates) {
      map.set(
        date,
        calendarPlanningShifts
          .filter((shift) => shift.shift_date === date)
          .map((shift) => ({
            startTime: shift.startTime,
            endTime: shift.endTime,
          }))
      );
    }
    return map;
  }, [dates, calendarPlanningShifts]);

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
    resolveEmployeeCalendarLayoutDayDates(
      dates,
      dayHasServiceHours,
      shiftsByDate,
      new Set(),
      {
        weekStart,
        currentWeekStart: toISODate(startOfWeek(parseISODate(toISODate(new Date())))),
        todayISO: toISODate(new Date()),
        savedWeekExpansion: undefined,
      }
    )
  );
  const [layoutActiveDayDates, setLayoutActiveDayDates] = useState<Set<string>>(
    () =>
      resolveEmployeeCalendarLayoutDayDates(
        dates,
        dayHasServiceHours,
        shiftsByDate,
        new Set(),
        {
          weekStart,
          currentWeekStart: toISODate(startOfWeek(parseISODate(toISODate(new Date())))),
          todayISO: toISODate(new Date()),
          savedWeekExpansion: undefined,
        }
      )
  );
  const layoutDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planningLayoutScopeRef = useRef<string | null>(null);
  const weekDayExpansionRef = useRef<Map<string, Set<string>>>(new Map());
  const userExpandedNoServiceWeekdaysRef = useRef<Set<number>>(new Set());
  const [isPlanningCalendarVisible, setIsPlanningCalendarVisible] =
    useState(() => calendarLayer === null);
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
    const hasServerCalendarData =
      calendarLayer === null ||
      shiftsFromProps.length > 0 ||
      locationShiftsFromProps.length > 0;
    if (calendarLayer !== null && !calendarLayer.ready && !hasServerCalendarData) {
      return;
    }

    const scopeKey = `${weekStart}:${selectedLocationId ?? ""}:${staffingHeaderAreaId ?? ""}:${calendarLayer?.ready ? "1" : "0"}`;
    if (planningLayoutScopeRef.current === scopeKey) {
      return;
    }
    planningLayoutScopeRef.current = scopeKey;

    const nextDays = resolveEmployeeCalendarLayoutDayDates(
      dates,
      dayHasServiceHours,
      shiftsByDate,
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
    setLayoutTransitionEnabled(false);
    syncLayoutDaysImmediate(nextDays);
    setIsPlanningCalendarVisible(true);
  }, [
    dates,
    weekStart,
    currentWeekStart,
    todayISO,
    selectedLocationId,
    staffingHeaderAreaId,
    calendarLayer?.ready,
    dayHasServiceHours,
    serviceHourAreaIds,
    serviceHours,
    shiftsByDate,
    simplePlanning,
    syncLayoutDaysImmediate,
  ]);

  useClearMainNavPendingWhenReady(calendarLayerReady && isPlanningCalendarVisible);

  const toggleDayActive = useCallback(
    (date: string, active: boolean) => {
      const dayIndex = dates.indexOf(date);
      const hasService =
        dayIndex >= 0 ? dayHasServiceHours[dayIndex] ?? false : false;
      const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
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
    [dates, dayHasServiceHours, shiftsByDate, scheduleLayoutDays, weekStart]
  );

  const dayUsesWideColumn = useMemo(
    () =>
      dates.map((date, dayIndex) => {
        if (!layoutActiveDayDates.has(date)) return false;
        if (!dayHasOpenArea[dayIndex]) {
          return !dayHasServiceHours[dayIndex];
        }
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

  /** Zugeklappte Tage: Mindestbreite statt 1fr — auch wenn alle Tage zugeklappt sind. */
  const fillColumnsEqually = false;

  const narrowDayColumnWidthsPx = useMemo(
    () => resolveNarrowDayColumnWidthsPx(dates, holidayNames, intlLocale),
    [dates, holidayNames, intlLocale]
  );

  const staffColumnWidthPx = useDashboardStaffColumnWidthPx({
    employees,
    weeklyHoursCardLabelsByEmployeeId,
    staffColumnHeaderLabel: t("nav.employeeCalendar"),
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

  const employeeNameById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.full_name])),
    [employees]
  );

  const showStaffingHeaderRow =
    features.staffing && Boolean(staffingHeaderAreaId);

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

  const planningHeaderRowTemplate = useMemo(() => {
    return showStaffingHeaderRow
      ? `${CALENDAR_DAY_HEADER_ROW_HEIGHT} ${PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT}`
      : CALENDAR_DAY_HEADER_ROW_HEIGHT;
  }, [showStaffingHeaderRow]);

  const calendarEmployees = useMemo(
    () => sortProfilesByShiftCountDesc(employees, calendarPlanningShifts),
    [employees, calendarPlanningShifts]
  );

  const planningBodyRowTemplate = useMemo(() => {
    return calendarEmployees.length > 0
      ? `repeat(${calendarEmployees.length}, minmax(${PLANNING_EMPLOYEE_ROW_HEIGHT}, 1fr))`
      : "";
  }, [calendarEmployees.length]);

  const timesComplete = areAreaCalendarShiftTimesComplete(startTime, endTime);

  const calendarDisplayShifts = useMemo(
    () =>
      simpleCalendarFirstShiftOnly
        ? pickFirstPlanningShiftPerEmployeeDay(calendarPlanningShifts)
        : calendarPlanningShifts,
    [calendarPlanningShifts, simpleCalendarFirstShiftOnly]
  );

  const dailyStaffingByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof computeBulkStaffingHeaderEntries>
    >();
    if (!showStaffingHeaderRow || !staffingHeaderAreaId) return map;

    for (const date of dates) {
      map.set(
        date,
        computeBulkStaffingHeaderEntries({
          staffingRules: staffingRulesWithOverridesForAreaDate(
            staffingRules,
            staffingOverrides,
            staffingHeaderAreaId,
            date
          ),
          areaId: staffingHeaderAreaId,
          dateISO: date,
          serviceHours,
          assignments: staffingAssignmentsForAreaDay(
            staffingCalendarShifts,
            date,
            staffingHeaderAreaId
          ),
          assignmentPresets,
          qualifications,
          profileQualificationIds,
          employeeNameById,
          formatTimeLabel: formatStaffingTimeLabel,
          weekdayLabel: staffingWeekdayLabel,
          formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
        })
      );
    }
    return map;
  }, [
    showStaffingHeaderRow,
    staffingHeaderAreaId,
    dates,
    staffingCalendarShifts,
    staffingRules,
    staffingOverrides,
    serviceHours,
    assignmentPresets,
    qualifications,
    profileQualificationIds,
    employeeNameById,
    formatStaffingTimeLabel,
    staffingWeekdayLabel,
    formatCalendarStaffingTimeLabel,
  ]);

  const planningTagAreaShiftRefs = useMemo(
    () =>
      calendarDisplayShifts.map((shift) => ({
        employeeId: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        area_shift_template_id: shift.area_shift_template_id,
        location_area_id: shift.location_area_id,
      })),
    [calendarDisplayShifts]
  );

  const tagAreaFooterStatsOptions = useMemo(
    () => ({
      breaksByTemplateId,
      areaShiftTemplates,
    }),
    [breaksByTemplateId, areaShiftTemplates]
  );

  const shiftCompensation = useLazyShiftCompensation(planningTagAreaShiftRefs);

  const dailyFooterLabelsByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof formatTagAreaFooterLabels>
    >();
    if (planningTagAreaShiftRefs.length === 0) return map;
    for (const date of dates) {
      const stats = computeTagAreaDayFooterStatsForDate(
        date,
        planningTagAreaShiftRefs,
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
        formatTagAreaFooterLabels(stats, t, locale === "en" ? "en" : "de", {
          showCompensation: showCompensationInPlanningUi,
        })
      );
    }
    return map;
  }, [dates, planningTagAreaShiftRefs, shiftCompensation, tagAreaFooterStatsOptions, t, locale, showCompensationInPlanningUi]);

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
    for (const shift of calendarPlanningShifts) {
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
  }, [calendarPlanningShifts]);

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const areaCalendarShiftsForConfirmation = useMemo(
    () =>
      visibleCommunicationHubLocationShifts.flatMap((shift) => {
        if (
          !shouldDisplayShiftOnPlanningCalendar({
            id: shift.id,
            shiftDate: shift.shift_date,
            confirmationStatus: shift.confirmationStatus,
            cancelActors: communicationCancelActorsMap,
            cancelledBy: shift.displayState?.openCancellation?.cancelledBy,
          })
        ) {
          return [];
        }
        const employee = employeesById.get(shift.employee_id);
        return employee ? [planningShiftToAreaCalendarCard(shift, employee)] : [];
      }),
    [
      visibleCommunicationHubLocationShifts,
      employeesById,
      communicationCancelActorsMap,
    ]
  );

  const weeklyHoursCheckShifts = useMemo(
    () =>
      visibleCommunicationHubLocationShifts.map((shift) =>
        weeklyHoursCheckShiftFromPlanningShift(shift)
      ),
    [visibleCommunicationHubLocationShifts]
  );

  const weekShiftsForAssignment = useMemo(
    () => shiftAssignWeekShiftsFromPlanningShifts(visibleLocationShifts),
    [visibleLocationShifts]
  );

  const organizationWeekShiftsForAssignment = useMemo(
    () =>
      shiftAssignWeekShiftsFromPlanningShifts(
        planningShiftsForCalendarWeek(organizationWeekShifts, dates)
      ),
    [organizationWeekShifts, dates]
  );

  const weeklyHoursByEmployeeId = useMemo(
    () => weeklyHoursByEmployeeIdFromEmployees(employees),
    [employees]
  );

  const communicationHubOptions = useMemo(
    () => ({
      absences: communicationHubAbsences,
      swapRequests: communicationSwapRequests,
      cancelActors: communicationCancelActorsMap,
      todayISO: weeklyHoursTodayISO,
      weeklyHoursByEmployeeId,
      weeklyHoursCheckShifts,
    }),
    [
      communicationHubAbsences,
      communicationSwapRequests,
      communicationCancelActorsMap,
      weeklyHoursTodayISO,
      weeklyHoursByEmployeeId,
      weeklyHoursCheckShifts,
    ]
  );

  const absenceConflictShiftIds = useMemo(() => {
    const conflictEligibleShifts = calendarDisplayShifts.filter(
      (shift) =>
        !isConfirmedShiftCard(
          shift.confirmationStatus,
          shift.requestedAt,
          shift.displayState
        )
    );
    const conflicts = collectShiftAbsenceConflicts(
      conflictEligibleShifts.map((shift) => ({
        id: shift.id,
        employeeId: shift.employee_id,
        shift_date: shift.shift_date,
      })),
      absences
    );
    return new Set(conflicts.map((conflict) => conflict.shiftId));
  }, [calendarDisplayShifts, absences]);

  const swapRequestShiftIds = useMemo(
    () => new Set(communicationSwapRequests.map((request) => request.shiftId)),
    [communicationSwapRequests]
  );

  const getShiftCardMenuOptions = useCallback(
    (
      shift: { id: string; shift_date: string; displayState?: PlanningShift["displayState"] },
      cellDate?: string
    ) => ({
      shiftDate: shift.shift_date,
      cellDate: cellDate ?? shift.shift_date,
      isPastShiftDate,
      displayState: shift.displayState,
      hasAbsenceConflict: absenceConflictShiftIds.has(shift.id),
    }),
    [absenceConflictShiftIds]
  );

  const communicationItemCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? communicationBadgeCount(
            areaCalendarShiftsForConfirmation,
            communicationHubOptions
          )
        : 0,
    [
      shiftConfirmationEnabled,
      areaCalendarShiftsForConfirmation,
      communicationHubOptions,
    ]
  );

  const shiftsById = useMemo(() => {
    const map = new Map<string, PlanningShift>();
    for (const shift of visibleLocationShifts) {
      map.set(shift.id, shift);
    }
    return map;
  }, [visibleLocationShifts]);

  const summary = useMemo(
    () => weeklySummary(calendarDisplayShifts, employees),
    [calendarDisplayShifts, employees]
  );

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === assignAreaId)?.name ?? "",
    [areas, assignAreaId]
  );

  const selectedLocationName = useMemo(
    () => locations.find((location) => location.id === selectedLocationId)?.name ?? "",
    [locations, selectedLocationId]
  );

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const showLocationInUi = shouldShowLocationInPlanningUi(locations.length);

  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId) ?? null,
    [areas, selectedAreaId]
  );

  const pushPlanungQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const q = params.toString();
      startTransition(() => {
        router.push(q ? `${pathname}?${q}` : pathname);
      });
    },
    [pathname, router, searchParams]
  );

  const navigateToWeekFromNotification = useCallback(
    (nextWeekStart: string) => {
      if (nextWeekStart === weekStart) return;
      pushPlanungQuery({ week: nextWeekStart });
    },
    [pushPlanungQuery, weekStart]
  );

  const handleToolbarAreaChange = useCallback(
    (areaId: string) => {
      pushPlanungQuery({ area: areaId });
    },
    [pushPlanungQuery]
  );

  useRegisterPlanningToolbarPageBridge({
    areas,
    selectedAreaId,
    onAreaChange: handleToolbarAreaChange,
    communicationItemCount,
    communicationDisabled: sendConfirmationPending,
    onOpenCommunication: openCommunication,
    onNavigateToWeek: navigateToWeekFromNotification,
    managerNotifications,
  });

  function isDayReadOnly(date: string) {
    return readOnlyWeek || isPastShiftDate(date);
  }

  function applyPreset(preset: AreaCalendarAssignmentPreset) {
    setSelectedPresetId(preset.id);
    setStartTime(timeFieldValue(preset.start_time));
    setEndTime(timeFieldValue(preset.end_time));
  }

  function openPicker(
    employeeId: string,
    date: string,
    shiftId?: string,
    options?: { withoutServiceHours?: boolean }
  ) {
    clearDocumentTextSelection();

    const cellShifts = shiftsByCell.get(`${employeeId}:${date}`) ?? [];
    const existing = shiftId
      ? cellShifts.find((shift) => shift.id === shiftId)
      : undefined;
    let existingPrimaryClickKind: ReturnType<
      typeof resolveShiftCardPrimaryClick
    >["kind"] | null = null;

    if (existing) {
      const interactionContext = resolveShiftCardInteractionContext(
        {
          id: existing.id,
          shift_date: existing.shift_date,
          confirmationStatus: existing.confirmationStatus,
          requestedAt: existing.requestedAt,
          displayState: existing.displayState,
        },
        date,
        isPastShiftDate,
        {
          shiftConfirmationEnabled,
          hasAbsenceConflict: absenceConflictShiftIds.has(existing.id),
          hasSwapRequest: swapRequestShiftIds.has(existing.id),
          pendingAfterMinutes,
        }
      );
      const primaryClick = resolveShiftCardPrimaryClick(
        {
          id: existing.id,
          shift_date: existing.shift_date,
          confirmationStatus: existing.confirmationStatus,
          requestedAt: existing.requestedAt,
          displayState: existing.displayState,
        },
        interactionContext
      );
      existingPrimaryClickKind = primaryClick.kind;

      if (primaryClick.kind === "none") {
        return;
      }

      if (primaryClick.kind === "communicationHub") {
        openCommunication({
          category: primaryClick.category,
          preselectedShiftIds: [existing.id],
        });
        return;
      }

      if (primaryClick.kind === "reassign" && selectedAreaId) {
        openBulkShiftDialogForAreaDay(selectedAreaId, date, {
          focusShiftId: existing.id,
        });
        return;
      }
    }

    if (isDayReadOnly(date) && !existing && cellShifts.length === 0) return;
    if (
      !existing &&
      cellShifts.length === 0 &&
      getPlanningDayAssignBlockReason(
        employeeId,
        date,
        todayISO,
        recurringAvailability,
        absences
      )
    ) {
      return;
    }

    const reassigningExisting = existingPrimaryClickKind === "reassign";

    setPicker({
      employeeId: existing?.employee_id ?? employeeId,
      date,
      shiftId,
      withoutServiceHours: options?.withoutServiceHours,
    });
    setSelectedEmployeeId(
      reassigningExisting ? "" : (existing?.employee_id ?? employeeId)
    );
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
          ? resolveOpenDemandShiftPrefill({
              areaId: selectedAreaId,
              staffingEntries: dailyStaffingByDate.get(date) ?? [],
              serviceHours,
              assignmentPresets,
              staffingRules,
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
    assignToRemainingWeekDays?: boolean;
  }): Promise<DashboardShiftActionResult> {
    if (!picker || isDayReadOnly(picker.date) || !selectedEmployeeId) {
      return { ok: false, error: t("areaCalendar.bulkShiftValidationTimesRequired") };
    }
    if (!selectedLocationId) {
      return { ok: false, error: t("areaCalendar.noLocations") };
    }
    if (!simplePlanning && !selectedAreaId) {
      return { ok: false, error: t("dashboard.noAreas") };
    }
    if (!timesComplete) {
      return { ok: false, error: t("areaCalendar.bulkShiftValidationTimesRequired") };
    }

    if (!options?.withoutServiceHours && !simplePlanning) {
      const serviceHoursCheck = validateAreaCalendarShiftServiceHours(
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

    const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(picker.date);
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
      ? shiftsById.get(picker.shiftId)
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

    const selectedEmployee = employees.find(
      (employee) => employee.id === selectedEmployeeId
    );
    const weeklyHoursCheck = validateShiftAssignWeeklyHoursClient({
      employeeId: selectedEmployeeId,
      employeeName: selectedEmployee?.full_name,
      weeklyHours: selectedEmployee?.weekly_hours ?? null,
      weekShifts: locationShifts.map((shift) => ({
        id: shift.id,
        employee_id: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
      })),
      shiftDate: picker.date,
      startTime,
      endTime,
      timeZone: DEFAULT_ORGANIZATION_TIME_ZONE,
      excludeShiftIds:
        editingShift && !reassigningToDifferentEmployee
          ? new Set([editingShift.id])
          : undefined,
    });
    if (!weeklyHoursCheck.ok) {
      return {
        ok: false,
        error: translateActionError(weeklyHoursCheck.error, t),
      };
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
      assignToRemainingWeekDays: options?.assignToRemainingWeekDays,
      weekDates: dates,
      existingShiftId:
        reassigningToDifferentEmployee ? undefined : editingShift?.id,
      simulatedProposedOnAssign,
      relaxAppRegistrationGate,
    });

    if (!result.ok) {
      return { ok: false, error: translateActionError(result.error, t) };
    }

    router.refresh();

    if (result.warnings?.length) {
      return { ok: true, warnings: result.warnings };
    }

    return { ok: true };
  }

  async function handleRemove(shiftId: string): Promise<DashboardShiftActionResult> {
    const shift = shiftsById.get(shiftId);
    const canDelete =
      shift &&
      canDeleteShift({
        shiftDate: shift.shift_date,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate,
        pendingAfterMinutes,
      });
    if (picker && isDayReadOnly(picker.date) && !canDelete) {
      return { ok: false, error: t("dashboard.readOnlyDay") };
    }

    const result = await removeShift(shiftId);
    if (!result.ok) {
      return { ok: false, error: translateActionError(result.error, t) };
    }

    closeAssignModal();
    router.refresh();
    return { ok: true };
  }

  const openBulkShiftDialogForAreaDay = useCallback(
    (
      areaId: string,
      date: string,
      options?: {
        focusShiftId?: string;
        withoutServiceHours?: boolean;
        presetEmployeeId?: string;
      }
    ) => {
      setBulkShiftDialog({
        areaId,
        date,
        focusShiftId: options?.focusShiftId,
        withoutServiceHours:
          options?.withoutServiceHours ??
          !areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, date),
        presetEmployeeId: options?.presetEmployeeId,
      });
      setCellContextMenu(null);
    },
    [serviceHours]
  );

  function requestPlanningDayAssign(
    employeeId: string,
    date: string,
    mode: "picker" | "bulk"
  ) {
    const areaHasService =
      assignAreaId != null &&
      areaHasEffectiveServiceHoursOnDate(serviceHours, assignAreaId, date);
    const shiftCountInArea = countShiftsInAreaOnDate(date);

    if (
      assignAreaId &&
      canPromptNoServiceHoursShiftAssignForDay(
        date,
        assignAreaId,
        shiftCountInArea,
        serviceHours
      )
    ) {
      setNoServiceHoursAssignConfirm({ employeeId, date, mode });
      return;
    }

    if (mode === "bulk" && assignAreaId) {
      openBulkShiftDialogForAreaDay(assignAreaId, date, {
        presetEmployeeId: employeeId,
        withoutServiceHours: !areaHasService,
      });
      return;
    }

    openPicker(employeeId, date, undefined, {
      withoutServiceHours: !areaHasService,
    });
  }

  function requestPlanningDayAssignForArea(
    date: string,
    mode: "picker" | "bulk"
  ) {
    if (!assignAreaId) return;
    const areaHasService = areaHasEffectiveServiceHoursOnDate(
      serviceHours,
      assignAreaId,
      date
    );
    const shiftCountInArea = countShiftsInAreaOnDate(date);
    const isDayExpanded = activeDayDates.has(date);

    if (
      !simplePlanning &&
      canPromptNoServiceHoursShiftAssign(
        assignAreaId,
        date,
        true,
        isAreaCalendarAssignDayActive(
          date,
          isDayExpanded,
          assignAreaId,
          shiftCountInArea,
          serviceHours
        ),
        serviceHours,
        shiftCountInArea
      )
    ) {
      setNoServiceHoursAssignConfirm({ employeeId: "", date, mode });
      return;
    }

    if (mode === "bulk") {
      openBulkShiftDialogForAreaDay(assignAreaId, date, {
        withoutServiceHours: !areaHasService,
      });
      return;
    }

    setAddShiftDialog({
      areaId: simplePlanning ? null : assignAreaId,
      date,
      withoutServiceHours: !areaHasService,
    });
  }

  const canOpenCellAssignContextMenu = useCallback(
    (employeeId: string, date: string) => {
      if (!assignAreaId || isPastShiftDate(date)) return false;
      const cellSegments =
        shiftsByCellDisplay.get(`${employeeId}:${date}`) ?? [];
      if (
        cellSegments.length === 0 &&
        isEmployeeAbsentOnDate(employeeId, absences, date)
      ) {
        return false;
      }
      const isDayExpanded = layoutActiveDayDates.has(date);
      const blockReason =
        cellSegments.length === 0
          ? getPlanningDayAssignBlockReason(
              employeeId,
              date,
              todayISO,
              recurringAvailability,
              absences
            )
          : null;
      const shiftCountInArea = countShiftsInAreaOnDate(date);
      const areaHasNoService = !areaHasEffectiveServiceHoursOnDate(
        serviceHours,
        assignAreaId,
        date
      );
      const effectiveBlockReason =
        areaHasNoService && blockReason === "no_availability"
          ? null
          : blockReason;

      return canShowEmployeeDayCellAssignContextMenu(
        assignAreaId,
        date,
        isDayExpanded,
        shiftCountInArea,
        effectiveBlockReason,
        serviceHours,
        simplePlanning
      );
    },
    [
      assignAreaId,
      shiftsByCellDisplay,
      absences,
      layoutActiveDayDates,
      todayISO,
      recurringAvailability,
      countShiftsInAreaOnDate,
      serviceHours,
      simplePlanning,
    ]
  );

  const canOpenDayAssignContextMenu = useCallback(
    (date: string) => {
      if (!assignAreaId || isPastShiftDate(date)) return false;
      const isDayExpanded = layoutActiveDayDates.has(date);
      const shiftCountInArea = countShiftsInAreaOnDate(date);
      const isAssignDayActive = isAreaCalendarAssignDayActive(
        date,
        isDayExpanded,
        assignAreaId,
        shiftCountInArea,
        serviceHours
      );
      return canShowAreaDayAssignContextMenu(
        assignAreaId,
        date,
        true,
        isAssignDayActive,
        serviceHours,
        shiftCountInArea,
        simplePlanning
      );
    },
    [
      assignAreaId,
      layoutActiveDayDates,
      countShiftsInAreaOnDate,
      serviceHours,
      simplePlanning,
    ]
  );

  const openDayAssignContextMenuAt = useCallback(
    (date: string, clientX: number, clientY: number) => {
      const { x, y } = clampPlanningAreaDayContextMenuPosition(
        clientX,
        clientY,
        simplePlanning
      );
      skipDayAssignContextMenuCloseRef.current = true;
      dayAssignContextMenuOpenedAtRef.current = performance.now();
      setCellContextMenu(null);
      setDayAssignContextMenu({ x, y, date });
    },
    [simplePlanning]
  );

  const ensureAssignDayActive = useCallback(
    (date: string) => {
      if (!assignAreaId || activeDayDates.has(date)) return;
      const shiftCountInArea = countShiftsInAreaOnDate(date);
      if (
        isAreaCalendarAssignDayActive(
          date,
          false,
          assignAreaId,
          shiftCountInArea,
          serviceHours
        )
      ) {
        toggleDayActive(date, true);
      }
    },
    [assignAreaId, activeDayDates, countShiftsInAreaOnDate, serviceHours, toggleDayActive]
  );

  const handleDayAssignContextMenu = useCallback(
    (date: string, clientX: number, clientY: number) => {
      if (!canOpenDayAssignContextMenu(date)) return;
      ensureAssignDayActive(date);
      openDayAssignContextMenuAt(date, clientX, clientY);
    },
    [
      canOpenDayAssignContextMenu,
      ensureAssignDayActive,
      openDayAssignContextMenuAt,
    ]
  );

  const handleDayAssignClick = useCallback(
    (date: string, clientX: number, clientY: number) => {
      if (!assignAreaId || isPastShiftDate(date)) return;
      ensureAssignDayActive(date);

      const shiftCountInArea = countShiftsInAreaOnDate(date);
      const isAssignDayActive = isAreaCalendarAssignDayActive(
        date,
        activeDayDates.has(date),
        assignAreaId,
        shiftCountInArea,
        serviceHours
      );

      if (
        !simplePlanning &&
        canPromptNoServiceHoursShiftAssign(
          assignAreaId,
          date,
          true,
          isAssignDayActive,
          serviceHours,
          shiftCountInArea
        )
      ) {
        clearDocumentTextSelection();
        setNoServiceHoursAssignConfirm({ employeeId: "", date, mode: "bulk" });
        return;
      }

      if (!canOpenDayAssignContextMenu(date)) return;

      if (
        canOpenAssignShiftContextMenu(
          assignAreaId,
          date,
          true,
          isAssignDayActive,
          serviceHours,
          shiftCountInArea
        )
      ) {
        openDayAssignContextMenuAt(date, clientX, clientY);
      }
    },
    [
      assignAreaId,
      canOpenDayAssignContextMenu,
      ensureAssignDayActive,
      countShiftsInAreaOnDate,
      activeDayDates,
      serviceHours,
      simplePlanning,
      openDayAssignContextMenuAt,
    ]
  );

  const openCellContextMenuAt = useCallback(
    (
      employeeId: string,
      date: string,
      clientX: number,
      clientY: number,
      shiftId?: string
    ) => {
      if (shiftId) {
        const shift = shiftsById.get(shiftId);
        if (
          !shift ||
          !canOpenShiftCardContextMenu(
            shift.confirmationStatus,
            shift.requestedAt,
            { ...getShiftCardMenuOptions(shift) }
          )
        ) {
          return;
        }
      }
      const actionCount =
        shiftId && shiftConfirmationEnabled
          ? Math.max(
              1,
              shiftCardContextMenuActions(
                shiftsById.get(shiftId)?.confirmationStatus,
                shiftsById.get(shiftId)?.requestedAt,
                (() => {
                  const shift = shiftsById.get(shiftId);
                  return shift ? getShiftCardMenuOptions(shift) : undefined;
                })()
              ).length
            )
          : 1;
      const { x, y } = shiftId
        ? clampPlanningContextMenuPosition(
            clientX,
            clientY,
            planningShiftContextMenuHeightPx(actionCount)
          )
        : clampPlanningCellContextMenuPosition(
            clientX,
            clientY,
            simplePlanning,
            shiftConfirmationEnabled
          );
      skipCellContextMenuCloseRef.current = true;
      cellContextMenuOpenedAtRef.current = performance.now();
      setDayAssignContextMenu(null);
      setCellContextMenu({ x, y, employeeId, date, shiftId });
    },
    [shiftConfirmationEnabled, shiftsById, simplePlanning, getShiftCardMenuOptions]
  );

  const handleCellContextMenu = useCallback(
    (employeeId: string, date: string, clientX: number, clientY: number) => {
      if (isPastShiftDate(date)) return;
      if (
        isEmployeeAbsentOnDate(employeeId, absences, date) &&
        (shiftsByCellDisplay.get(`${employeeId}:${date}`) ?? []).length === 0
      ) {
        return;
      }
      ensureAssignDayActive(date);
      const cellSegments =
        shiftsByCellDisplay.get(`${employeeId}:${date}`) ?? [];
      const areaHasService =
        assignAreaId != null &&
        areaHasEffectiveServiceHoursOnDate(serviceHours, assignAreaId, date);
      if (!areaHasService && cellSegments.length === 0) {
        openDayAssignContextMenuAt(date, clientX, clientY);
        return;
      }
      if (!canOpenCellAssignContextMenu(employeeId, date)) return;
      openCellContextMenuAt(employeeId, date, clientX, clientY);
    },
    [
      absences,
      shiftsByCellDisplay,
      ensureAssignDayActive,
      assignAreaId,
      serviceHours,
      openDayAssignContextMenuAt,
      canOpenCellAssignContextMenu,
      openCellContextMenuAt,
    ]
  );

  const handleStaffingHeaderContextMenu = useCallback(
    (date: string, clientX: number, clientY: number) => {
      if (!selectedAreaId || readOnlyWeek || isPastShiftDate(date)) return;
      const entries = dailyStaffingByDate.get(date) ?? [];
      if (entries.length === 0) return;
      setCellContextMenu(null);
      staffingHeaderContextMenuOpenedAtRef.current = performance.now();
      setStaffingHeaderContextMenu({
        x: clientX,
        y: clientY,
        areaId: selectedAreaId,
        date,
        initialServiceHourId: entries[0]?.serviceHourId,
      });
    },
    [selectedAreaId, dailyStaffingByDate, readOnlyWeek]
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

  const handleShiftContextMenu = useCallback(
    (
      employeeId: string,
      date: string,
      shiftId: string,
      clientX: number,
      clientY: number
    ) => {
      const shift = shiftsById.get(shiftId);
      if (!shift) return;
      const menuOptions = getShiftCardMenuOptions(shift, date);
      if (
        !canOpenShiftCardContextMenu(
          shift.confirmationStatus,
          shift.requestedAt,
          menuOptions
        )
      ) {
        return;
      }
      openCellContextMenuAt(employeeId, date, clientX, clientY, shiftId);
    },
    [openCellContextMenuAt, shiftsById, getShiftCardMenuOptions]
  );

  const canOpenSingleAssignFromContext = useCallback(
    (employeeId: string, date: string) => {
      const cellSegments = shiftsByCellDisplay.get(`${employeeId}:${date}`) ?? [];
      if (isDayReadOnly(date) && cellSegments.length === 0) return false;
      const dayIndex = dates.indexOf(date);
      const dayHasService =
        dayIndex >= 0 ? dayHasServiceHours[dayIndex] : true;
      if (
        dayHasService &&
        cellSegments.length === 0 &&
        getPlanningDayAssignBlockReason(
          employeeId,
          date,
          todayISO,
          recurringAvailability,
          absences
        )
      ) {
        return false;
      }
      return true;
    },
    [
      shiftsByCellDisplay,
      dates,
      dayHasServiceHours,
      recurringAvailability,
      absences,
      readOnlyWeek,
      todayISO,
    ]
  );

  const handleEmployeeRowContextMenu = useCallback(
    (employeeId: string, clientX: number, clientY: number) => {
      setCellContextMenu(null);
      openEmployeeListContextMenu(employeeId, clientX, clientY);
    },
    [openEmployeeListContextMenu]
  );

  useEffect(() => {
    if (!cellContextMenu) return;

    function closeMenu() {
      setCellContextMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onMouseMove(event: MouseEvent) {
      if (performance.now() - cellContextMenuOpenedAtRef.current < 200) return;
      const menu = cellContextMenuRef.current;
      if (!menu) return;
      if (
        distanceFromPointToMenu(event.clientX, event.clientY, menu) >
        CONTEXT_MENU_CLOSE_DISTANCE_PX
      ) {
        closeMenu();
      }
    }

    function onDocumentContextMenu() {
      if (skipCellContextMenuCloseRef.current) {
        skipCellContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    function onDocumentClick() {
      if (skipCellContextMenuCloseRef.current) {
        skipCellContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("contextmenu", onDocumentContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("contextmenu", onDocumentContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [cellContextMenu]);

  useEffect(() => {
    if (!dayAssignContextMenu) return;

    function closeMenu() {
      setDayAssignContextMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onMouseMove(event: MouseEvent) {
      if (
        performance.now() - dayAssignContextMenuOpenedAtRef.current < 200
      ) {
        return;
      }
      const menu = dayAssignContextMenuRef.current;
      if (!menu) return;
      if (
        distanceFromPointToMenu(event.clientX, event.clientY, menu) >
        CONTEXT_MENU_CLOSE_DISTANCE_PX
      ) {
        closeMenu();
      }
    }

    function onDocumentContextMenu() {
      if (skipDayAssignContextMenuCloseRef.current) {
        skipDayAssignContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    function onDocumentClick() {
      if (skipDayAssignContextMenuCloseRef.current) {
        skipDayAssignContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("contextmenu", onDocumentContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("contextmenu", onDocumentContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [dayAssignContextMenu]);

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

    function onDocumentContextMenu() {
      if (skipStaffingHeaderContextMenuCloseRef.current) {
        skipStaffingHeaderContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    function onDocumentClick() {
      if (skipStaffingHeaderContextMenuCloseRef.current) {
        skipStaffingHeaderContextMenuCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("contextmenu", onDocumentContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("contextmenu", onDocumentContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [staffingHeaderContextMenu]);

  const handleContextAssignSingle = useCallback(() => {
    if (!cellContextMenu) return;
    skipCellContextMenuCloseRef.current = true;
    const { employeeId, date } = cellContextMenu;
    setCellContextMenu(null);
    requestPlanningDayAssign(employeeId, date, "picker");
  }, [cellContextMenu]);

  const handleContextAssignBulk = useCallback(() => {
    if (!cellContextMenu || !selectedAreaId) return;
    skipCellContextMenuCloseRef.current = true;
    const { employeeId, date } = cellContextMenu;
    setCellContextMenu(null);
    requestPlanningDayAssign(employeeId, date, "bulk");
  }, [cellContextMenu, selectedAreaId]);

  const handleDayContextAssignSingle = useCallback(() => {
    if (!dayAssignContextMenu) return;
    skipDayAssignContextMenuCloseRef.current = true;
    const { date } = dayAssignContextMenu;
    setDayAssignContextMenu(null);
    requestPlanningDayAssignForArea(date, "picker");
  }, [dayAssignContextMenu]);

  const handleDayContextAssignBulk = useCallback(() => {
    if (!dayAssignContextMenu) return;
    skipDayAssignContextMenuCloseRef.current = true;
    const { date } = dayAssignContextMenu;
    setDayAssignContextMenu(null);
    requestPlanningDayAssignForArea(date, "bulk");
  }, [dayAssignContextMenu]);

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
    if (!shiftId) return;
    const shift = shiftsById.get(shiftId);
    if (!shift) return;

    const canDelete = canDeleteShift({
      shiftDate: shift.shift_date,
      confirmationStatus: shift.confirmationStatus,
      requestedAt: shift.requestedAt,
      isPastShiftDate,
      pendingAfterMinutes,
    });
    if (isDayReadOnly(cellContextMenu.date) && !canDelete) return;

    skipCellContextMenuCloseRef.current = true;
    setCellContextMenu(null);
    setDeleteShiftError(null);
    setShiftDeleteConfirmId(null);

    if (!canDelete) {
      const status = shift.confirmationStatus ?? "confirmed";
      setDeleteShiftError(shiftDeleteBlockedMessage(status, t));
      return;
    }

    setShiftDeleteConfirmId(shiftId);
  }, [cellContextMenu, shiftsByCellDisplay, shiftsById, readOnlyWeek, t]);

  const handleReassignFromPanel = useCallback(
    (shift: AreaCalendarShiftCard) => {
      setCommunicationOpen(false);
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
      closeAssignModal();
      router.refresh();
    });
  }, [shiftDeleteConfirmId, closeAssignModal, router, t]);

  const handleContextCancelShift = useCallback(() => {
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
    if (!shiftId) return;
    const shift = shiftsById.get(shiftId);
    if (!shift) return;
    skipCellContextMenuCloseRef.current = true;
    setCellContextMenu(null);
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
        setCancelShiftError(translateShiftCancelError(SHIFT_CANCEL_PAST_ERROR, t));
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

    const employee = employees.find((entry) => entry.id === shift.employee_id);
    setShiftCancelConfirm({
      shiftId,
      employeeName: employee?.full_name ?? shift.employee_id,
    });
  }, [cellContextMenu, shiftsByCellDisplay, shiftsById, employees, t]);

  const handleContextReassignShift = useCallback(() => {
    if (!cellContextMenu?.shiftId || !selectedAreaId) return;
    skipCellContextMenuCloseRef.current = true;
    const { shiftId, date, employeeId } = cellContextMenu;
    setCellContextMenu(null);
    openBulkShiftDialogForAreaDay(selectedAreaId, date, {
      focusShiftId: shiftId,
    });
  }, [cellContextMenu, selectedAreaId, openBulkShiftDialogForAreaDay]);

  const handleContextRequestConfirmation = useCallback(() => {
    if (!cellContextMenu?.shiftId || !selectedLocationId) return;
    const shiftId = cellContextMenu.shiftId;
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
      const result = await submitCommunicationConfirmationRequests({
        shiftIds: [shiftId],
        weekStart,
        locationId: selectedLocationId,
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
    cellContextMenu,
    selectedLocationId,
    weekStart,
    router,
    t,
    blocksOutboundSend,
    simulatedProposedOnAssign,
    relaxAppRegistrationGate,
  ]);

  const handleContextSetConfirmed = useCallback(() => {
    if (!cellContextMenu?.shiftId) return;
    const shiftId = cellContextMenu.shiftId;
    skipCellContextMenuCloseRef.current = true;
    setCellContextMenu(null);
    setConfirmShiftError(null);
    startConfirmShift(async () => {
      const result = await confirmPastShiftAsManager(shiftId);
      if (!result.ok) {
        setConfirmShiftError(translatePastConfirmError(result.error, t));
        return;
      }
      router.refresh();
    });
  }, [cellContextMenu, router, t]);

  const handleContextShiftAction = useCallback(
    (action: ShiftCardContextMenuAction) => {
      switch (action) {
        case "delete":
          handleContextRemoveShift();
          break;
        case "cancel":
          handleContextCancelShift();
          break;
        case "reassign":
          handleContextReassignShift();
          break;
        case "requestConfirmation":
          handleContextRequestConfirmation();
          break;
        case "setConfirmed":
          handleContextSetConfirmed();
          break;
      }
    },
    [
      handleContextRemoveShift,
      handleContextCancelShift,
      handleContextReassignShift,
      handleContextRequestConfirmation,
      handleContextSetConfirmed,
    ]
  );

  const handleConfirmCancelShift = useCallback(() => {
    if (!shiftCancelConfirm) return;
    const shiftId = shiftCancelConfirm.shiftId;
    setCancelShiftError(null);
    setShiftCancelConfirm(null);
    markRemoved([shiftId]);
    startCancelShift(async () => {
      try {
        const result = await cancelShiftAsManager(shiftId);
        if (!result.ok) {
          unmarkRemoved([shiftId]);
          setCancelShiftError(translateShiftCancelError(result.error, t));
        }
      } catch {
        unmarkRemoved([shiftId]);
        setCancelShiftError(t("shiftConfirmation.cancel.failed"));
      }
    });
  }, [shiftCancelConfirm, markRemoved, unmarkRemoved, t]);

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
        const shiftId =
          uniqueShiftIds.length === 1 ? uniqueShiftIds[0] : undefined;
        if (!shiftId) return undefined;
        const shift = shiftsById.get(shiftId);
        if (
          !shift ||
          !shiftCardAllowsRemoveFromAssignDialog(
            shift.confirmationStatus,
            shift.requestedAt,
            { ...getShiftCardMenuOptions(shift) }
          )
        ) {
          return undefined;
        }
        return shiftId;
      })())
    : undefined;

  const contextMenuShiftActions = useMemo(() => {
    if (!cellContextMenu?.shiftId || !shiftConfirmationEnabled) return [];
    const shift = shiftsById.get(cellContextMenu.shiftId);
    if (!shift) return [];
    return shiftCardContextMenuActions(
      shift.confirmationStatus,
      shift.requestedAt,
      getShiftCardMenuOptions(shift, cellContextMenu?.date)
    );
  }, [cellContextMenu, shiftsById, shiftConfirmationEnabled, getShiftCardMenuOptions]);

  const clampedCellContextMenuPosition = useClampedContextMenuPosition(
    cellContextMenu != null,
    cellContextMenu?.x ?? 0,
    cellContextMenu?.y ?? 0,
    cellContextMenuRef,
    [
      cellContextMenu?.shiftId,
      cellContextMenu?.employeeId,
      simplePlanning,
      shiftConfirmationEnabled,
      contextMenuShiftActions.length,
      contextMenuRemoveShiftId,
    ]
  );

  const clampedDayAssignContextMenuPosition = useClampedContextMenuPosition(
    dayAssignContextMenu != null,
    dayAssignContextMenu?.x ?? 0,
    dayAssignContextMenu?.y ?? 0,
    dayAssignContextMenuRef,
    [dayAssignContextMenu, simplePlanning, SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM]
  );

  const clampedStaffingHeaderContextMenuPosition = useClampedContextMenuPosition(
    staffingHeaderContextMenu != null,
    staffingHeaderContextMenu?.x ?? 0,
    staffingHeaderContextMenu?.y ?? 0,
    staffingHeaderContextMenuRef,
    [staffingHeaderContextMenu]
  );

  const contextMenuShift = cellContextMenu?.shiftId
    ? shiftsById.get(cellContextMenu.shiftId)
    : undefined;

  const getDayAssignBlockReasonForCell = useCallback(
    (employeeId: string, date: string) =>
      getPlanningDayAssignBlockReason(
        employeeId,
        date,
        todayISO,
        recurringAvailability,
        absences
      ),
    [recurringAvailability, absences, todayISO]
  );

  if (employees.length === 0) {
    return (
      <div className={cn("border border-dashed border-border bg-surface p-12 text-center", DASHBOARD_PANEL_ROUNDED_CLASS)}>
        <p className="text-muted">
          {t("dashboard.noEmployeesPrefix")}{" "}
          <a
            href={buildSettingsModalUrl(pathname, searchParams, "profiles")}
            className="font-medium text-primary"
          >
            {t("dashboard.noEmployeesProfilesLink")}
          </a>{" "}
          {t("dashboard.noEmployeesSuffix")}
        </p>
      </div>
    );
  }

  const canAssign =
    Boolean(selectedLocationId) &&
    (simplePlanning ||
      (Boolean(assignAreaId) && assignmentPresets.length > 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={PLANNING_PAGE_CALENDAR_SECTION_CLASS}>
        <div
          className={cn(
            PLANNING_PAGE_CALENDAR_MAIN_CLASS,
            PLANNING_PAGE_CALENDAR_CONTENT_PADDING_CLASS,
            APP_SHELL_CONTENT_OFFSET_CLASS
          )}
        >
          <div className={PLANNING_PAGE_CALENDAR_BODY_CLASS}>
            <DashboardCalendarGrid
            staffColumnHeaderLabel={t("nav.employeeCalendar")}
            dates={dates}
            employees={calendarEmployees}
            weeklyHoursTooltipDisplayByEmployeeId={weeklyHoursTooltipDisplayByEmployeeId}
            weeklyHoursCardLabelsByEmployeeId={weeklyHoursCardLabelsByEmployeeId}
            weeklyHoursOverLimitByEmployeeId={weeklyHoursOverLimitByEmployeeId}
            shifts={calendarPlanningShifts}
            calendarDisplayShifts={calendarDisplayShifts}
            shiftsByCell={calendarShiftsByCell}
            shiftsByCellDisplay={shiftsByCellDisplay}
            holidayNames={holidayNames}
            dayHasServiceHours={dayHasServiceHours}
            dayHasStaffingHeaderServiceHours={dayHasStaffingHeaderServiceHours}
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
            onRequestPlanningDayAssign={requestPlanningDayAssign}
            canOpenCellAssignContextMenu={canOpenCellAssignContextMenu}
            onCellContextMenu={handleCellContextMenu}
            onDayAssignContextMenu={handleDayAssignContextMenu}
            onDayAssignClick={handleDayAssignClick}
            onShiftContextMenu={handleShiftContextMenu}
            onEmployeeRowContextMenu={handleEmployeeRowContextMenu}
            onStaffingHeaderContextMenu={handleStaffingHeaderContextMenu}
            staffingHeaderContextMenuOpen={staffingHeaderContextMenu != null}
            selectedAreaId={assignAreaId}
            selectedAreaName={selectedAreaName}
            areas={areas}
            serviceHours={serviceHours}
            staffingRules={staffingRules}
            qualifications={qualifications}
            profileQualificationIds={profileQualificationIdsRecord}
            recurringAvailability={recurringAvailability}
            highlightedEmployeeId={highlightedEmployeeId}
            onEmployeeHover={handleEmployeeHover}
            absenceConflictShiftIds={absenceConflictShiftIds}
            swapRequestShiftIds={swapRequestShiftIds}
            shiftConfirmationEnabled={shiftConfirmationEnabled}
          />
          </div>
        </div>

        {cellContextMenu ? (
          <div
            ref={cellContextMenuRef}
            className={PLANNING_CONTEXT_MENU_SURFACE_CLASS}
            style={{
              left: clampedCellContextMenuPosition.x,
              top: clampedCellContextMenuPosition.y,
              width: DASHBOARD_CELL_CONTEXT_MENU_WIDTH_PX,
            }}
            role="menu"
            aria-label={t("dashboard.contextAssignSingle")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {!cellContextMenu.shiftId ? (
              <>
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
                  {t("dashboard.contextAssignSingle")}
                </button>
                {!simplePlanning ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedAreaId}
                    onClick={handleContextAssignBulk}
                  >
                    {t("dashboard.contextAssignBulk")}
                  </button>
                ) : null}
                {contextMenuRemoveShiftId ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isDayReadOnly(cellContextMenu.date)}
                    onClick={handleContextRemoveShift}
                  >
                    {t("dashboard.contextRemoveShift")}
                  </button>
                ) : null}
              </>
            ) : shiftConfirmationEnabled ? (
              contextMenuShiftActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    (action === "delete" &&
                      (deleteShiftPending ||
                        !(
                          contextMenuShift &&
                          canDeleteShift({
                            shiftDate: contextMenuShift.shift_date,
                            confirmationStatus: contextMenuShift.confirmationStatus,
                            requestedAt: contextMenuShift.requestedAt,
                            isPastShiftDate,
                            pendingAfterMinutes,
                          })
                        ))) ||
                    (action === "cancel" && cancelShiftPending) ||
                    (action === "requestConfirmation" && sendConfirmationPending) ||
                    (action === "setConfirmed" && confirmShiftPending)
                  }
                  onClick={() => handleContextShiftAction(action)}
                >
                  {t(shiftCardContextMenuActionLabelKey(action))}
                </button>
              ))
            ) : (
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  deleteShiftPending || isDayReadOnly(cellContextMenu.date)
                }
                onClick={handleContextRemoveShift}
              >
                {t("dashboard.contextRemoveShift")}
              </button>
            )}
          </div>
        ) : null}

        {dayAssignContextMenu &&
        (SHOW_ASSIGN_SHIFT_CONTEXT_MENU_ITEM || !simplePlanning) ? (
          <div
            ref={dayAssignContextMenuRef}
            className={PLANNING_CONTEXT_MENU_SURFACE_CLASS}
            style={{
              left: clampedDayAssignContextMenuPosition.x,
              top: clampedDayAssignContextMenuPosition.y,
              width: AREA_DAY_CONTEXT_MENU_WIDTH_PX,
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
                onClick={handleDayContextAssignSingle}
              >
                {t("areaCalendar.assignShift")}
              </button>
            ) : null}
            {!simplePlanning ? (
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"
                onClick={handleDayContextAssignBulk}
              >
                {t("areaCalendar.assignMultipleShifts")}
              </button>
            ) : null}
          </div>
        ) : null}

        {employeeListContextMenu ? (
          <PlanningEmployeeListContextMenu
            state={employeeListContextMenu}
            menuRef={employeeListContextMenuRef}
            onOpenAvailabilities={openEmployeeAvailabilities}
            onOpenAbsences={openEmployeeAbsences}
            onOpenPreferences={openEmployeePreferences}
            onOpenCompensation={openEmployeeCompensation}
            onOpenSurcharges={openEmployeeSurcharges}
            onOpenQualifications={openEmployeeQualifications}
          />
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

        {staffingEditDialog && selectedLocation && selectedArea ? (
          <CalendarStaffingEditModal
            mode={staffingEditDialog.mode}
            location={selectedLocation}
            area={selectedArea}
            anchorDate={staffingEditDialog.anchorDate}
            weekDates={dates}
            shiftTemplates={templatesForArea}
            editorData={buildCalendarStaffingEditorData(
              staffingEditDialog.areaId,
              serviceHours,
              staffingRules,
              qualifications
            )}
            staffingOverrides={staffingOverrides}
            initialServiceHourId={staffingEditDialog.initialServiceHourId}
            onClose={() => setStaffingEditDialog(null)}
            onSaved={handleStaffingEditSaved}
          />
        ) : null}

        {picker ? (
          <DashboardAssignShiftModal
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
            withoutServiceHours={picker.withoutServiceHours}
            timesComplete={timesComplete}
            canAssign={canAssign}
            hasExistingShift={Boolean(picker.shiftId)}
            editingShiftId={picker.shiftId ?? null}
            weekDates={dates}
            weekShifts={locationShifts.map((shift) => ({
              id: shift.id,
              employee_id: shift.employee_id,
              shift_date: shift.shift_date,
              startTime: shift.startTime,
              endTime: shift.endTime,
            }))}
            organizationWeekShifts={organizationWeekShiftsForAssignment}
            timeZone={organization.timezone ?? DEFAULT_ORGANIZATION_TIME_ZONE}
            weeklyHoursDisplayByEmployeeId={weeklyHoursTooltipDisplayByEmployeeId}
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
            onClose={closeAssignModal}
          />
        ) : null}

      {noServiceHoursAssignConfirm ? (
        <NoServiceHoursShiftConfirmModal
          areaName={selectedAreaName ?? ""}
          onCancel={() => setNoServiceHoursAssignConfirm(null)}
          onConfirm={() => {
            const { employeeId, date, mode } = noServiceHoursAssignConfirm;
            setNoServiceHoursAssignConfirm(null);
            if (!assignAreaId) return;
            if (!employeeId) {
              if (mode === "bulk") {
                openBulkShiftDialogForAreaDay(assignAreaId, date, {
                  withoutServiceHours: true,
                });
                return;
              }
              setAddShiftDialog({
                areaId: simplePlanning ? null : assignAreaId,
                date,
                withoutServiceHours: true,
              });
              return;
            }
            if (mode === "bulk") {
              openBulkShiftDialogForAreaDay(assignAreaId, date, {
                presetEmployeeId: employeeId,
                withoutServiceHours: true,
              });
              return;
            }
            openPicker(employeeId, date, undefined, { withoutServiceHours: true });
          }}
        />
      ) : null}

      {addShiftDialog && selectedLocationId ? (
        <AreaCalendarAddShiftModal
          key={`planning-single:${addShiftDialog.areaId ?? "simple"}:${addShiftDialog.date}`}
          dialog={addShiftDialog}
          locationId={selectedLocationId}
          areas={areas}
          areaShiftTemplates={areaShiftTemplates}
          serviceHours={serviceHours}
          staffingRules={staffingRules}
          qualifications={qualifications}
          profileQualificationIds={profileQualificationIdsRecord}
          areaExistingAssignments={
            addShiftDialog.areaId
              ? visibleLocationShifts
                  .filter(
                    (shift) =>
                      shift.location_area_id === addShiftDialog.areaId &&
                      shift.shift_date === addShiftDialog.date
                  )
                  .map((shift) => ({
                    employeeId: shift.employee_id,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                  }))
              : visibleLocationShifts
                  .filter((shift) => shift.shift_date === addShiftDialog.date)
                  .map((shift) => ({
                    employeeId: shift.employee_id,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                  }))
          }
          weekDates={dates}
          weekShifts={organizationWeekShiftsForAssignment}
          onClose={() => setAddShiftDialog(null)}
          onSaved={handleBulkShiftSaved}
        />
      ) : null}

      {bulkShiftDialog && selectedLocationId && selectedAreaId && !simplePlanning ? (
        <AreaCalendarBulkShiftModal
          key={`planning-bulk:${bulkShiftDialog.areaId}:${bulkShiftDialog.date}:${bulkShiftDialog.focusShiftId ?? ""}:${bulkShiftDialog.presetEmployeeId ?? ""}:${bulkShiftDialog.withoutServiceHours ? "nosh" : "sh"}`}
          dialog={bulkShiftDialog}
          locationId={selectedLocationId}
          locationName={selectedLocationName}
          showLocationName={showLocationInUi}
          areas={areas}
          areaShiftTemplates={areaShiftTemplates}
          staffingRules={staffingRules}
          serviceHours={serviceHours}
          qualifications={qualifications}
          existingAreaShifts={visibleLocationShifts
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
              confirmationStatus: shift.confirmationStatus,
              requestedAt: shift.requestedAt,
            }))}
          areaExistingAssignments={visibleLocationShifts
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
          locationDayAssignments={locationDayAssignmentsFromShiftRefsForDate(
            organizationWeekShifts,
            bulkShiftDialog.date
          )}
          weekDates={dates}
          weekShifts={organizationWeekShiftsForAssignment}
          onClose={() => setBulkShiftDialog(null)}
          onSaved={handleBulkShiftSaved}
        />
      ) : null}

      {shiftDeleteConfirmId ? (
        <AreaCalendarShiftDeleteConfirmModal
          pending={deleteShiftPending}
          onCancel={() => {
            if (deleteShiftPending) return;
            setShiftDeleteConfirmId(null);
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

      {communicationOpen ? (
        <CommunicationHubModal
          key={`communication-${communicationOptions?.category ?? communicationOptions?.responseTab ?? "auto"}-${communicationOptions?.preselectedShiftIds?.join(",") ?? ""}`}
          weekStart={weekStart}
          locationId={selectedLocationId}
          locationName={showLocationInUi ? selectedLocationName : undefined}
          areas={areas}
          shifts={areaCalendarShiftsForConfirmation}
          absences={communicationHubAbsences}
          swapRequests={communicationSwapRequests}
          cancelActors={communicationCancelActorsMap}
          todayISO={weeklyHoursTodayISO}
          weeklyHoursByEmployeeId={weeklyHoursByEmployeeId}
          weeklyHoursCheckShifts={weeklyHoursCheckShifts}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          initialOptions={communicationOptions}
          onClose={closeCommunication}
          onReassign={handleReassignFromPanel}
          onBusyChange={setCommunicationBusy}
          onLocalShiftRemoved={markRemoved}
          onLocalShiftRestore={unmarkRemoved}
        />
      ) : null}

      </div>

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
  );
}

/** @deprecated Use DashboardView */
export const WeekCalendar = DashboardView;