"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type {
  AbsenceRequest,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Profile,
  ProfileRecurringAvailability,
  Qualification,
  CompensationSurchargeType,
  Role,
  AreaShiftTemplateWithBreaks,
} from "@schichtwerk/types";
import type {
  AreaServiceHourRef,
  StaffingRule,
} from "@/lib/location-staffing-client";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { useOrganization } from "@/lib/org-features-provider";
import { organizationTodayISO } from "@schichtwerk/database";
import {
  weeklyHoursByEmployeeIdFromProfiles,
  weeklyHoursCheckShiftFromAreaCalendarCard,
} from "@/lib/weekly-hours-check-shifts";
import { useAppShellModalLockActive, useAppShellWaitCursorActive } from "@/lib/app-shell-modal-lock";
import { useClearMainNavPendingWhenReady } from "@/lib/app-shell-main-nav-pending";
import { useRegisterPlanningToolbarPageBridge } from "@/lib/planning-toolbar-page-bridge";
import { AreaCalendarEmployeeLegendSidebar } from "./areacalendar-employee-legend-sidebar";
import { PlanningEmployeeListContextMenu } from "@/components/planning/planning-employee-list-context-menu";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import {
  AreaCalendar,
  type AreaCalendarShiftCard,
} from "./areacalendar-calendar";
import {
  CommunicationHubModal,
  communicationBadgeCount,
} from "./communication-hub-modal";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
import type { ManagerNotification } from "@schichtwerk/types";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import { shouldDisplayShiftOnPlanningCalendar } from "@/lib/shift-cancellation-policy";
import { useLocallyRemovedShifts } from "@/lib/use-locally-removed-shifts";
import {
  PLANNING_PAGE_CALENDAR_BODY_CLASS,
  PLANNING_PAGE_CALENDAR_CONTENT_PADDING_CLASS,
  PLANNING_PAGE_CALENDAR_MAIN_CLASS,
  PLANNING_PAGE_CALENDAR_SECTION_CLASS,
  PLANNING_PAGE_CALENDAR_SURFACE_CLASS,
  APP_SHELL_CONTENT_OFFSET_CLASS,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";
import { usePlanningEmployeeListContextMenu } from "@/lib/use-planning-employee-list-context-menu";
import { useDelayedEmployeeHighlight } from "@/lib/use-delayed-employee-highlight";
import { filterAreaCalendarShiftsForEmployeeLegend } from "@/lib/areacalendar-week-employee-legend";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";
import { resolveSingleActiveAreaIds } from "@/lib/resolve-areacalendar-location";
import {
  planningShiftToAreaCalendarCard,
  type PlanningShift,
} from "@/lib/planning-shift-card";

type Props = {
  weekStart: string;
  dates: string[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  areas: LocationArea[];
  staffingRules: StaffingRule[];
  fullStaffingRules: LocationAreaStaffing[];
  staffingOverrides?: LocationAreaStaffingOverride[];
  serviceHours: AreaServiceHourRef[];
  shifts: AreaCalendarShiftCard[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  compensationSurchargeTypes: CompensationSurchargeType[];
  roles: Role[];
  profiles: Profile[];
  profileQualificationIds: Record<string, string[]>;
  locations: Location[];
  absences?: AbsenceRequest[];
  recurringAvailability?: readonly ProfileRecurringAvailability[];
  communicationSwapRequests?: CommunicationSwapRequestRow[];
  communicationCancelActors?: Record<string, "employee" | "manager">;
  communicationHubLocationShifts?: PlanningShift[];
  organizationWeekShifts?: PlanningShift[];
  communicationHubAbsences?: AbsenceRequest[];
  managerNotifications?: ManagerNotification[];
};

export function AreaCalendarView({
  weekStart,
  dates,
  selectedLocationId,
  selectedLocation,
  areas,
  staffingRules,
  fullStaffingRules,
  staffingOverrides = [],
  serviceHours,
  shifts,
  areaShiftTemplates,
  qualifications,
  compensationSurchargeTypes,
  roles,
  profiles,
  profileQualificationIds,
  locations,
  absences = [],
  recurringAvailability = [],
  communicationSwapRequests = [],
  communicationCancelActors = {},
  communicationHubLocationShifts = [],
  organizationWeekShifts = [],
  communicationHubAbsences = [],
  managerNotifications = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { locale } = useLocale();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const organization = useOrganization();
  const weeklyHoursTodayISO = useMemo(
    () => organizationTodayISO(organization.timezone),
    [organization.timezone]
  );
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [communicationBusy, setCommunicationBusy] = useState(false);
  const [communicationOptions, setCommunicationOptions] = useState<
    CommunicationOpenOptions | undefined
  >(undefined);
  const [reassignShiftRequest, setReassignShiftRequest] =
    useState<AreaCalendarShiftCard | null>(null);

  const locallyRemovedShiftsScopeKey = `${weekStart}:${selectedLocationId ?? ""}`;
  const { removedIds, markRemoved, unmarkRemoved } = useLocallyRemovedShifts(
    locallyRemovedShiftsScopeKey
  );

  const visibleShifts = useMemo(
    () => shifts.filter((shift) => !removedIds.has(shift.id)),
    [shifts, removedIds]
  );

  const communicationCancelActorsMap = useMemo(
    () => new Map(Object.entries(communicationCancelActors)),
    [communicationCancelActors]
  );

  const initialActiveAreaId = useMemo(() => {
    const areaParam = searchParams.get("area");
    if (!areaParam) return null;
    return areas.some((area) => area.id === areaParam) ? areaParam : null;
  }, [searchParams, areas]);

  const [employeeLegendActiveAreaIds, setEmployeeLegendActiveAreaIds] =
    useState<Set<string>>(() =>
      resolveSingleActiveAreaIds(areas, initialActiveAreaId)
    );

  const [employeeLegendActiveDayDates, setEmployeeLegendActiveDayDates] =
    useState<Set<string>>(() => new Set(dates));

  const showLocationInUi = shouldShowLocationInPlanningUi(locations.length);

  const handleActiveAreaIdsChange = useCallback((activeAreaIds: Set<string>) => {
    setEmployeeLegendActiveAreaIds(new Set(activeAreaIds));
  }, []);

  const handleActiveDayDatesChange = useCallback((activeDayDates: Set<string>) => {
    setEmployeeLegendActiveDayDates(new Set(activeDayDates));
  }, []);

  const calendarShifts = useMemo(
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

  const employeeLegendShifts = useMemo(
    () =>
      filterAreaCalendarShiftsForEmployeeLegend(
        calendarShifts,
        employeeLegendActiveAreaIds,
        employeeLegendActiveDayDates
      ),
    [
      calendarShifts,
      employeeLegendActiveAreaIds,
      employeeLegendActiveDayDates,
    ]
  );

  const compensationShiftRefs = useMemo(
    () =>
      calendarShifts.map((shift) => ({
        employeeId: shift.employeeId,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
      })),
    [calendarShifts]
  );
  const shiftCompensation = useLazyShiftCompensation(compensationShiftRefs);

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const communicationHubShifts = useMemo(() => {
    const cards: AreaCalendarShiftCard[] = [];
    for (const shift of communicationHubLocationShifts) {
      if (removedIds.has(shift.id)) continue;
      if (
        !shouldDisplayShiftOnPlanningCalendar({
          id: shift.id,
          shiftDate: shift.shift_date,
          confirmationStatus: shift.confirmationStatus,
          cancelActors: communicationCancelActorsMap,
          cancelledBy: shift.displayState?.openCancellation?.cancelledBy,
        })
      ) {
        continue;
      }
      const employee = profilesById.get(shift.employee_id);
      if (employee) {
        cards.push(planningShiftToAreaCalendarCard(shift, employee));
      }
    }
    return cards;
  }, [
    communicationHubLocationShifts,
    removedIds,
    communicationCancelActorsMap,
    profilesById,
  ]);

  const weeklyHoursByEmployeeId = useMemo(
    () => weeklyHoursByEmployeeIdFromProfiles(profiles),
    [profiles]
  );

  const weeklyHoursCheckShifts = useMemo(
    () => communicationHubShifts.map(weeklyHoursCheckShiftFromAreaCalendarCard),
    [communicationHubShifts]
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
  const communicationItemCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? communicationBadgeCount(communicationHubShifts, communicationHubOptions)
        : 0,
    [shiftConfirmationEnabled, communicationHubShifts, communicationHubOptions]
  );

  const { highlightedEmployeeId, handleEmployeeHover } = useDelayedEmployeeHighlight();
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

  useAppShellModalLockActive(communicationOpen);
  useAppShellWaitCursorActive(communicationBusy);
  useClearMainNavPendingWhenReady(true);

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

  function navigateToWeek(nextWeekStart: string) {
    if (nextWeekStart === weekStart) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", nextWeekStart);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useRegisterPlanningToolbarPageBridge({
    communicationItemCount,
    onOpenCommunication: openCommunication,
    onNavigateToWeek: navigateToWeek,
    managerNotifications,
  });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onContextMenu={(event) => event.preventDefault()}
    >
      <section className={PLANNING_PAGE_CALENDAR_SECTION_CLASS}>
        <div
          className={cn(
            PLANNING_PAGE_CALENDAR_MAIN_CLASS,
            PLANNING_PAGE_CALENDAR_CONTENT_PADDING_CLASS,
            APP_SHELL_CONTENT_OFFSET_CLASS
          )}
        >
          <div
            className={cn(
              PLANNING_PAGE_CALENDAR_BODY_CLASS,
              "gap-2 max-md:overflow-visible md:flex-row md:gap-3"
            )}
          >
            <AreaCalendarEmployeeLegendSidebar
              shifts={employeeLegendShifts}
              profiles={profiles}
              absences={absences}
              recurringAvailability={recurringAvailability}
              qualifications={qualifications}
              profileQualificationIds={profileQualificationIds}
              locale={locale}
              employeeHoursLabel={t("common.basic")}
              weekDates={dates}
              selectedLocationId={selectedLocationId}
              areas={areas}
              locations={locations}
              organizationWeekShifts={organizationWeekShifts}
              onEmployeeHover={handleEmployeeHover}
              onEmployeeContextMenu={openEmployeeListContextMenu}
              className="max-md:!mt-0 max-md:!w-full max-md:shrink-0"
            />
            <div className={PLANNING_PAGE_CALENDAR_SURFACE_CLASS}>
              <AreaCalendar
              weekStart={weekStart}
              dates={dates}
              locationId={selectedLocationId}
              locationName={selectedLocation?.name ?? ""}
              showLocationName={showLocationInUi}
              areas={areas}
              staffingRules={staffingRules}
              serviceHours={serviceHours}
              shifts={calendarShifts}
              areaShiftTemplates={areaShiftTemplates}
              qualifications={qualifications}
              profileQualificationIds={profileQualificationIds}
              fullStaffingRules={fullStaffingRules}
              staffingOverrides={staffingOverrides}
              selectedLocation={selectedLocation}
              shiftCompensation={shiftCompensation}
              profiles={profiles}
              reassignShiftRequest={reassignShiftRequest}
              onReassignShiftHandled={() => setReassignShiftRequest(null)}
              highlightedEmployeeId={highlightedEmployeeId}
              onLocalShiftRemoved={markRemoved}
              onLocalShiftRestore={unmarkRemoved}
              onOpenCommunication={openCommunication}
              swapRequestShiftIds={
                new Set(communicationSwapRequests.map((request) => request.shiftId))
              }
              initialActiveAreaId={initialActiveAreaId}
              onActiveAreaIdsChange={handleActiveAreaIdsChange}
              onActiveDayDatesChange={handleActiveDayDatesChange}
            />
            </div>
          </div>
        </div>
      </section>
        <SettingsModalsLayer
          data={{
            locations,
            selectedLocationId,
            areas,
            serviceHours,
            fullStaffingRules,
            areaShiftTemplates,
            qualifications,
            compensationSurchargeTypes,
            roles,
            profiles,
          }}
        />
        {communicationOpen ? (
          <CommunicationHubModal
            key={`communication-${communicationOptions?.category ?? communicationOptions?.responseTab ?? "auto"}-${communicationOptions?.preselectedShiftIds?.join(",") ?? ""}`}
            weekStart={weekStart}
            locationId={selectedLocationId}
            locationName={
              showLocationInUi ? selectedLocation?.name : undefined
            }
            areas={areas}
            shifts={communicationHubShifts}
            absences={communicationHubAbsences}
            swapRequests={communicationSwapRequests}
            cancelActors={communicationCancelActorsMap}
            todayISO={weeklyHoursTodayISO}
            weeklyHoursByEmployeeId={weeklyHoursByEmployeeId}
            weeklyHoursCheckShifts={weeklyHoursCheckShifts}
            shiftConfirmationEnabled={shiftConfirmationEnabled}
            initialOptions={communicationOptions}
            onClose={closeCommunication}
            onReassign={(shift) => setReassignShiftRequest(shift)}
            onBusyChange={setCommunicationBusy}
            onLocalShiftRemoved={markRemoved}
            onLocalShiftRestore={unmarkRemoved}
          />
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
    </div>
  );
}
