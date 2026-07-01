"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  CommunicationHubModal,
  communicationBadgeCount,
} from "@/components/areacalendar/communication-hub-modal";
import { DashboardOverviewView } from "@/components/dashboard/dashboard-overview-view";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { useOrganization } from "@/lib/org-features-provider";
import { organizationTodayISO } from "@schichtwerk/database";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import {
  weeklyHoursByEmployeeIdFromProfiles,
  weeklyHoursCheckShiftFromPlanningShift,
  planningShiftsForCalendarWeek,
} from "@/lib/weekly-hours-check-shifts";
import { useAppShellModalLockActive, useAppShellWaitCursorActive } from "@/lib/app-shell-modal-lock";
import { useRegisterPlanningToolbarPageBridge } from "@/lib/planning-toolbar-page-bridge";
import {
  planningShiftToAreaCalendarCard,
  type PlanningShift,
} from "@/lib/planning-shift-card";
import { shouldDisplayShiftOnPlanningCalendar } from "@/lib/shift-cancellation-policy";
import { useLocallyRemovedShifts } from "@/lib/use-locally-removed-shifts";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  ManagerNotification,
  Profile,
  Qualification,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { DashboardExtPanelSnapshot } from "@/lib/dashboard-ext-panel-data";
import type { DashboardSettingsModalsData } from "@/lib/dashboard-data-loader";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";

type Props = {
  snapshot: DashboardExtPanelSnapshot;
  weekStart: string;
  locations: Location[];
  selectedLocationId: string | null;
  selectedLocationName?: string;
  settingsModals: DashboardSettingsModalsData;
  areas: LocationArea[];
  employees: Profile[];
  communicationSwapRequests: CommunicationSwapRequestRow[];
  communicationCancelActors: Record<string, "employee" | "manager">;
  communicationHubLocationShifts: PlanningShift[];
  communicationHubAbsences: AbsenceRequest[];
  managerNotifications: ManagerNotification[];
  locationShifts: PlanningShift[];
  organizationWeekShifts: PlanningShift[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
};

export function DashboardShell({
  snapshot,
  weekStart,
  locations,
  selectedLocationId,
  selectedLocationName,
  settingsModals,
  areas,
  employees,
  communicationSwapRequests,
  communicationCancelActors,
  communicationHubLocationShifts,
  communicationHubAbsences,
  managerNotifications,
  locationShifts,
  organizationWeekShifts,
  serviceHours,
  staffingRules,
  staffingOverrides,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const locallyRemovedShiftsScopeKey = `${weekStart}:${selectedLocationId ?? ""}`;
  const { removedIds, markRemoved, unmarkRemoved } = useLocallyRemovedShifts(
    locallyRemovedShiftsScopeKey
  );

  const communicationCancelActorsMap = useMemo(
    () => new Map(Object.entries(communicationCancelActors)),
    [communicationCancelActors]
  );

  const visibleCommunicationHubLocationShifts = useMemo(
    () =>
      communicationHubLocationShifts.filter((shift) => !removedIds.has(shift.id)),
    [communicationHubLocationShifts, removedIds]
  );

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const visibleLocationShifts = useMemo(
    () => locationShifts.filter((shift) => !removedIds.has(shift.id)),
    [locationShifts, removedIds]
  );

  const calendarPlanningShifts = useMemo(
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

  const communicationShiftCards = useMemo(() => {
    const cards: AreaCalendarShiftCard[] = [];
    for (const shift of visibleCommunicationHubLocationShifts) {
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
      const employee = employeesById.get(shift.employee_id);
      if (employee) {
        cards.push(planningShiftToAreaCalendarCard(shift, employee));
      }
    }
    return cards;
  }, [
    visibleCommunicationHubLocationShifts,
    employeesById,
    communicationCancelActorsMap,
  ]);

  const weeklyHoursCheckShifts = useMemo(
    () =>
      visibleCommunicationHubLocationShifts.map((shift) =>
        weeklyHoursCheckShiftFromPlanningShift(shift)
      ),
    [visibleCommunicationHubLocationShifts]
  );

  const weeklyHoursShifts = useMemo(
    () =>
      planningShiftsForCalendarWeek(organizationWeekShifts, snapshot.dates),
    [organizationWeekShifts, snapshot.dates]
  );

  const weeklyHoursByEmployeeId = useMemo(
    () => weeklyHoursByEmployeeIdFromProfiles(employees),
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

  const communicationItemCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? communicationBadgeCount(communicationShiftCards, communicationHubOptions)
        : 0,
    [shiftConfirmationEnabled, communicationShiftCards, communicationHubOptions]
  );

  useAppShellModalLockActive(communicationOpen);
  useAppShellWaitCursorActive(communicationBusy);

  const openCommunication = useCallback((options?: CommunicationOpenOptions) => {
    setCommunicationOptions(options);
    setCommunicationBusy(false);
    setCommunicationOpen(true);
  }, []);

  const closeCommunication = useCallback(() => {
    setCommunicationOpen(false);
    setCommunicationBusy(false);
    setCommunicationOptions(undefined);
  }, []);

  const navigateToWeek = useCallback(
    (nextWeekStart: string) => {
      if (nextWeekStart === weekStart) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("week", nextWeekStart);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    },
    [pathname, router, searchParams, weekStart]
  );

  const handleReassign = useCallback(
    (shift: AreaCalendarShiftCard) => {
      closeCommunication();
      const params = new URLSearchParams(searchParams.toString());
      params.set("week", weekStart);
      if (selectedLocationId) params.set("location", selectedLocationId);
      if (shift.locationAreaId) params.set("area", shift.locationAreaId);
      router.push(`/mitarbeiter-kalender?${params.toString()}`);
    },
    [closeCommunication, router, searchParams, selectedLocationId, weekStart]
  );

  useRegisterPlanningToolbarPageBridge({
    communicationItemCount,
    onOpenCommunication: openCommunication,
    onNavigateToWeek: navigateToWeek,
    managerNotifications,
  });

  const showLocationInUi = shouldShowLocationInPlanningUi(locations.length);

  return (
    <>
      <DashboardOverviewView
        snapshot={snapshot}
        calendarShifts={calendarPlanningShifts}
        weeklyHoursShifts={weeklyHoursShifts}
        locations={locations}
        weekStart={weekStart}
        selectedLocationId={selectedLocationId}
        planningAreas={areas}
        employees={employees}
        serviceHours={serviceHours}
        staffingRules={staffingRules}
        staffingOverrides={staffingOverrides}
        areaShiftTemplates={areaShiftTemplates}
        qualifications={qualifications}
        profileQualificationIds={profileQualificationIds}
        showLocationInUi={showLocationInUi}
        communicationSwapRequests={communicationSwapRequests}
        onOpenSwapRequests={() => openCommunication({ category: "swaps" })}
      />
      {communicationOpen && selectedLocationId ? (
        <CommunicationHubModal
          key={`communication-${communicationOptions?.category ?? communicationOptions?.responseTab ?? "auto"}-${communicationOptions?.preselectedShiftIds?.join(",") ?? ""}`}
          weekStart={weekStart}
          locationId={selectedLocationId}
          locationName={
            showLocationInUi
              ? selectedLocationName ?? snapshot.locationName
              : undefined
          }
          areas={areas}
          shifts={communicationShiftCards}
          absences={communicationHubAbsences}
          swapRequests={communicationSwapRequests}
          cancelActors={communicationCancelActorsMap}
          todayISO={weeklyHoursTodayISO}
          weeklyHoursByEmployeeId={weeklyHoursByEmployeeId}
          weeklyHoursCheckShifts={weeklyHoursCheckShifts}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          initialOptions={communicationOptions}
          onClose={closeCommunication}
          onReassign={handleReassign}
          onBusyChange={setCommunicationBusy}
          onLocalShiftRemoved={markRemoved}
          onLocalShiftRestore={unmarkRemoved}
        />
      ) : null}
      {SETTINGS_MODALS_ON_CURRENT_PAGE ? (
        <SettingsModalsLayer
          data={{
            locations,
            selectedLocationId,
            areas,
            serviceHours: serviceHours as LocationAreaServiceHour[],
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
    </>
  );
}
