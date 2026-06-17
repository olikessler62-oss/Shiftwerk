"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  AbsenceRequest,
  Location,
  LocationArea,
  LocationAreaStaffing,
  Profile,
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
import { useAppShellModalLockActive, useAppShellWaitCursorActive } from "@/lib/app-shell-modal-lock";
import { usePlanningAppSidebarContent } from "@/components/planning/planning-app-sidebar-slot";
import { DashboardEmployeeLegendSidebar } from "./dashboard-employee-legend-sidebar";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { DashboardHeader } from "./dashboard-header";
import {
  DashboardCalendar,
  type DashboardShiftCard,
} from "./dashboard-calendar";
import {
  CommunicationHubModal,
  communicationBadgeCount,
} from "./communication-hub-modal";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
import type { ManagerNotification } from "@schichtwerk/types";
import { APP_SHELL_CONTENT_OFFSET_CLASS } from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";

type Props = {
  weekStart: string;
  dates: string[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  areas: LocationArea[];
  staffingRules: StaffingRule[];
  fullStaffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  shifts: DashboardShiftCard[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  compensationSurchargeTypes: CompensationSurchargeType[];
  roles: Role[];
  profiles: Profile[];
  profileQualificationIds: Record<string, string[]>;
  locations: Location[];
  absences?: AbsenceRequest[];
  managerNotifications?: ManagerNotification[];
};

export function DashboardView({
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
  managerNotifications = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { locale } = useLocale();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [communicationBusy, setCommunicationBusy] = useState(false);
  const [communicationOptions, setCommunicationOptions] = useState<
    CommunicationOpenOptions | undefined
  >(undefined);
  const [reassignShiftRequest, setReassignShiftRequest] =
    useState<DashboardShiftCard | null>(null);

  const compensationShiftRefs = useMemo(
    () =>
      shifts.map((shift) => ({
        employeeId: shift.employeeId,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
      })),
    [shifts]
  );
  const shiftCompensation = useLazyShiftCompensation(compensationShiftRefs);
  const communicationItemCount = useMemo(
    () => (shiftConfirmationEnabled ? communicationBadgeCount(shifts) : 0),
    [shiftConfirmationEnabled, shifts]
  );

  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(
    null
  );

  const dashboardSidebarContent = useMemo(
    () => (
      <DashboardEmployeeLegendSidebar
        shifts={shifts}
        profiles={profiles}
        absences={absences}
        locale={locale}
        employeeHoursLabel={t("common.basic")}
        emptyLabel={t("dashboard.weekEmployeeLegendEmpty")}
        highlightedEmployeeId={highlightedEmployeeId}
        onEmployeeHover={setHighlightedEmployeeId}
      />
    ),
    [shifts, profiles, absences, locale, t, highlightedEmployeeId]
  );

  usePlanningAppSidebarContent(dashboardSidebarContent);

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
    router.push(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <div
      className="-mx-4 -mt-4 -mb-4 flex h-[calc(100%+32px)] min-h-0 flex-col bg-background pb-[10px] md:-mx-6 md:-mt-6 md:-mb-6 md:h-[calc(100%+48px)]"
      onContextMenu={(event) => event.preventDefault()}
    >
      <DashboardHeader
        weekStart={weekStart}
        locations={locations}
        selectedLocationId={selectedLocationId}
        communicationItemCount={communicationItemCount}
        shiftConfirmationEnabled={shiftConfirmationEnabled}
        managerNotifications={managerNotifications}
        onOpenCommunication={openCommunication}
        onNavigateToWeek={navigateToWeek}
      />
      <section
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden px-2 md:px-4",
          APP_SHELL_CONTENT_OFFSET_CLASS
        )}
      >
        <DashboardCalendar
          weekStart={weekStart}
          dates={dates}
          locationId={selectedLocationId}
          locationName={selectedLocation?.name ?? ""}
          areas={areas}
          staffingRules={staffingRules}
          serviceHours={serviceHours}
          shifts={shifts}
          areaShiftTemplates={areaShiftTemplates}
          qualifications={qualifications}
          profileQualificationIds={profileQualificationIds}
          fullStaffingRules={fullStaffingRules}
          shiftCompensation={shiftCompensation}
          profiles={profiles}
          reassignShiftRequest={reassignShiftRequest}
          onReassignShiftHandled={() => setReassignShiftRequest(null)}
          highlightedEmployeeId={highlightedEmployeeId}
        />
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
            key={communicationOptions?.responseTab ?? "auto"}
            weekStart={weekStart}
            locationId={selectedLocationId}
            locationName={selectedLocation?.name}
            areas={areas}
            shifts={shifts}
            shiftConfirmationEnabled={shiftConfirmationEnabled}
            initialOptions={communicationOptions}
            onClose={closeCommunication}
            onReassign={(shift) => setReassignShiftRequest(shift)}
            onBusyChange={setCommunicationBusy}
          />
        ) : null}
      </section>
    </div>
  );
}
