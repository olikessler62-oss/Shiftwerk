"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  CommunicationHubModal,
  communicationBadgeCount,
} from "@/components/areacalendar/communication-hub-modal";
import { DashboardSummaryView } from "@/components/dashboard/dashboard-summary-view";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { useOrganization, useOrgFeatures } from "@/lib/org-features-provider";
import { organizationTodayISO } from "@schichtwerk/database";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import {
  weeklyHoursByEmployeeIdFromProfiles,
  weeklyHoursCheckShiftFromPlanningShift,
} from "@/lib/weekly-hours-check-shifts";
import { useAppShellModalLockActive, useAppShellWaitCursorActive } from "@/lib/app-shell-modal-lock";
import { useClearMainNavPendingWhenReady } from "@/lib/app-shell-main-nav-pending";
import { useRegisterPlanningToolbarPageBridge } from "@/lib/planning-toolbar-page-bridge";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";
import {
  planningShiftToAreaCalendarCard,
  type PlanningShift,
} from "@/lib/planning-shift-card";
import { shouldDisplayShiftOnPlanningCalendar } from "@/lib/shift-cancellation-policy";
import { useLocallyRemovedShifts } from "@/lib/use-locally-removed-shifts";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  CompensationSurchargeType,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  ManagerNotification,
  Profile,
  Qualification,
  Role,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

type Props = {
  weekStart: string;
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  selectedLocationName?: string;
  areas: LocationArea[];
  locationShifts: PlanningShift[];
  employees: Profile[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  absences: AbsenceRequest[];
  communicationSwapRequests: CommunicationSwapRequestRow[];
  communicationCancelActors: Record<string, "employee" | "manager">;
  communicationHubLocationShifts: PlanningShift[];
  communicationHubAbsences: AbsenceRequest[];
  managerNotifications: ManagerNotification[];
  readOnlyWeek?: boolean;
  settingsModals?: {
    profiles: Profile[];
    roles: Role[];
    compensationSurchargeTypes: CompensationSurchargeType[];
  };
};

export function DashboardSummaryShell({
  weekStart,
  dates,
  locations,
  selectedLocationId,
  selectedLocationName,
  areas,
  locationShifts,
  employees,
  serviceHours,
  staffingRules,
  staffingOverrides,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds,
  absences,
  communicationSwapRequests,
  communicationCancelActors,
  communicationHubLocationShifts,
  communicationHubAbsences,
  managerNotifications,
  readOnlyWeek = false,
  settingsModals,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const organization = useOrganization();
  const features = useOrgFeatures();
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

  const visibleLocationShifts = useMemo(
    () => locationShifts.filter((shift) => !removedIds.has(shift.id)),
    [locationShifts, removedIds]
  );

  const visibleCommunicationHubLocationShifts = useMemo(
    () =>
      communicationHubLocationShifts.filter((shift) => !removedIds.has(shift.id)),
    [communicationHubLocationShifts, removedIds]
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

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const employeeNameById = useMemo(
    () =>
      new Map(
        employees.map((employee) => [employee.id, employee.full_name ?? employee.id])
      ),
    [employees]
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
      visibleCommunicationHubLocationShifts.map(
        weeklyHoursCheckShiftFromPlanningShift
      ),
    [visibleCommunicationHubLocationShifts]
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
      <DashboardSummaryView
        weekStart={weekStart}
        dates={dates}
        locations={locations}
        selectedLocationId={selectedLocationId}
        selectedLocationName={selectedLocationName}
        areas={areas}
        calendarShifts={calendarPlanningShifts}
        serviceHours={serviceHours}
        staffingRules={staffingRules}
        staffingOverrides={staffingOverrides}
        areaShiftTemplates={areaShiftTemplates}
        qualifications={qualifications}
        profileQualificationIds={profileQualificationIds}
        employeeNameById={employeeNameById}
        staffingEnabled={features.staffing}
        readOnlyWeek={readOnlyWeek}
        settingsModals={settingsModals}
      />
      {communicationOpen ? (
        <CommunicationHubModal
          key={`communication-${communicationOptions?.category ?? communicationOptions?.responseTab ?? "auto"}-${communicationOptions?.preselectedShiftIds?.join(",") ?? ""}`}
          weekStart={weekStart}
          locationId={selectedLocationId}
          locationName={showLocationInUi ? selectedLocationName : undefined}
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
    </>
  );
}
