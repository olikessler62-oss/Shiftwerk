"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type {
  AbsenceRequest,
  Location,
  LocationArea,
  LocationAreaStaffing,
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
import { AreaCalendarEmployeeLegendSidebar } from "./areacalendar-employee-legend-sidebar";
import { PlanningEmployeeListContextMenu } from "@/components/planning/planning-employee-list-context-menu";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { AreaCalendarHeader } from "./areacalendar-header";
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
  APP_SHELL_CONTENT_OFFSET_CLASS,
  AREA_CALENDAR_VIEW_ROOT_CLASS,
  PLANNING_PAGE_CALENDAR_MAIN_CLASS,
  PLANNING_PAGE_CALENDAR_SECTION_CLASS,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";
import { usePlanningEmployeeListContextMenu } from "@/lib/use-planning-employee-list-context-menu";

type Props = {
  weekStart: string;
  dates: string[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  areas: LocationArea[];
  staffingRules: StaffingRule[];
  fullStaffingRules: LocationAreaStaffing[];
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

  const calendarShifts = useMemo(
    () =>
      visibleShifts.filter((shift) =>
        shouldDisplayShiftOnPlanningCalendar({
          id: shift.id,
          confirmationStatus: shift.confirmationStatus,
          cancelActors: communicationCancelActorsMap,
        })
      ),
    [visibleShifts, communicationCancelActorsMap]
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

  const weeklyHoursCheckShifts = useMemo(
    () => visibleShifts.map(weeklyHoursCheckShiftFromAreaCalendarCard),
    [visibleShifts]
  );

  const weeklyHoursByEmployeeId = useMemo(
    () => weeklyHoursByEmployeeIdFromProfiles(profiles),
    [profiles]
  );

  const communicationHubOptions = useMemo(
    () => ({
      absences,
      swapRequests: communicationSwapRequests,
      cancelActors: communicationCancelActorsMap,
      todayISO: weeklyHoursTodayISO,
      weeklyHoursByEmployeeId,
      weeklyHoursCheckShifts,
    }),
    [
      absences,
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
        ? communicationBadgeCount(visibleShifts, communicationHubOptions)
        : 0,
    [shiftConfirmationEnabled, visibleShifts, communicationHubOptions]
  );

  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(
    null
  );
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

  return (
    <div
      className={AREA_CALENDAR_VIEW_ROOT_CLASS}
      onContextMenu={(event) => event.preventDefault()}
    >
      <AreaCalendarHeader
        weekStart={weekStart}
        locations={locations}
        selectedLocationId={selectedLocationId}
        communicationItemCount={communicationItemCount}
        shiftConfirmationEnabled={shiftConfirmationEnabled}
        managerNotifications={managerNotifications}
        onOpenCommunication={openCommunication}
        onNavigateToWeek={navigateToWeek}
      />
      <section className={cn("relative flex flex-col px-2 md:px-4", PLANNING_PAGE_CALENDAR_SECTION_CLASS)}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 max-md:overflow-visible md:flex-row md:gap-3">
          <AreaCalendarEmployeeLegendSidebar
            shifts={calendarShifts}
            profiles={profiles}
            absences={absences}
            recurringAvailability={recurringAvailability}
            qualifications={qualifications}
            profileQualificationIds={profileQualificationIds}
            locale={locale}
            employeeHoursLabel={t("common.basic")}
            emptyLabel={t("areaCalendar.weekEmployeeLegendEmpty")}
            onEmployeeHover={setHighlightedEmployeeId}
            onEmployeeContextMenu={openEmployeeListContextMenu}
            className={cn(
              APP_SHELL_CONTENT_OFFSET_CLASS,
              "max-md:!mt-0 max-md:!w-full max-md:shrink-0"
            )}
          />
          <div
            className={cn(
              PLANNING_PAGE_CALENDAR_MAIN_CLASS,
              APP_SHELL_CONTENT_OFFSET_CLASS
            )}
          >
            <AreaCalendar
              weekStart={weekStart}
              dates={dates}
              locationId={selectedLocationId}
              locationName={selectedLocation?.name ?? ""}
              areas={areas}
              staffingRules={staffingRules}
              serviceHours={serviceHours}
              shifts={calendarShifts}
              areaShiftTemplates={areaShiftTemplates}
              qualifications={qualifications}
              profileQualificationIds={profileQualificationIds}
              fullStaffingRules={fullStaffingRules}
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
            />
          </div>
        </div>
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
            locationName={selectedLocation?.name}
            areas={areas}
            shifts={visibleShifts}
            absences={absences}
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
      </section>
    </div>
  );
}
