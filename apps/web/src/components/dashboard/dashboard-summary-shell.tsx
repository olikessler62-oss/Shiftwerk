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
import { useOrganization } from "@/lib/org-features-provider";
import { organizationTodayISO } from "@schichtwerk/database";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import {
  weeklyHoursByEmployeeIdFromProfiles,
  weeklyHoursCheckShiftFromPlanningShift,
} from "@/lib/weekly-hours-check-shifts";
import { useAppShellModalLockActive, useAppShellWaitCursorActive } from "@/lib/app-shell-modal-lock";
import { useRegisterPlanningToolbarPageBridge } from "@/lib/planning-toolbar-page-bridge";
import {
  planningShiftToAreaCalendarCard,
  type PlanningShift,
} from "@/lib/planning-shift-card";
import { shouldDisplayShiftOnPlanningCalendar } from "@/lib/shift-cancellation-policy";
import { useLocallyRemovedShifts } from "@/lib/use-locally-removed-shifts";
import type { DashboardSummaryShift } from "@/lib/dashboard-summary-data";
import type {
  AbsenceRequest,
  CompensationSurchargeType,
  Location,
  LocationArea,
  ManagerNotification,
  Profile,
  Role,
} from "@schichtwerk/types";

type Props = {
  weekStart: string;
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  selectedLocationName?: string;
  shifts: DashboardSummaryShift[];
  areas: LocationArea[];
  locationShifts: PlanningShift[];
  employees: Profile[];
  absences: AbsenceRequest[];
  communicationSwapRequests: CommunicationSwapRequestRow[];
  communicationCancelActors: Record<string, "employee" | "manager">;
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
  shifts,
  areas,
  locationShifts,
  employees,
  absences,
  communicationSwapRequests,
  communicationCancelActors,
  managerNotifications,
  readOnlyWeek = false,
  settingsModals,
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

  const visibleLocationShifts = useMemo(
    () => locationShifts.filter((shift) => !removedIds.has(shift.id)),
    [locationShifts, removedIds]
  );

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const communicationShiftCards = useMemo(() => {
    const cards: AreaCalendarShiftCard[] = [];
    for (const shift of visibleLocationShifts) {
      if (
        !shouldDisplayShiftOnPlanningCalendar({
          id: shift.id,
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
  }, [visibleLocationShifts, employeesById, communicationCancelActorsMap]);

  const weeklyHoursCheckShifts = useMemo(
    () => visibleLocationShifts.map(weeklyHoursCheckShiftFromPlanningShift),
    [visibleLocationShifts]
  );

  const weeklyHoursByEmployeeId = useMemo(
    () => weeklyHoursByEmployeeIdFromProfiles(employees),
    [employees]
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

  return (
    <>
      <DashboardSummaryView
        weekStart={weekStart}
        dates={dates}
        locations={locations}
        selectedLocationId={selectedLocationId}
        shifts={shifts}
        readOnlyWeek={readOnlyWeek}
        settingsModals={settingsModals}
      />
      {communicationOpen ? (
        <CommunicationHubModal
          key={`communication-${communicationOptions?.category ?? communicationOptions?.responseTab ?? "auto"}-${communicationOptions?.preselectedShiftIds?.join(",") ?? ""}`}
          weekStart={weekStart}
          locationId={selectedLocationId}
          locationName={selectedLocationName}
          areas={areas}
          shifts={communicationShiftCards}
          absences={absences}
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
