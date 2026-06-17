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
import { DashboardSendConfirmationModal } from "./dashboard-send-confirmation-modal";
import { OpenConfirmationsPanel } from "./open-confirmations-panel";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
import type { ManagerNotification } from "@schichtwerk/types";
import { APP_SHELL_CONTENT_OFFSET_CLASS } from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";

type PanelTab = "pending" | "rejected" | "proposed";

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
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false);
  const [sendConfirmationBusy, setSendConfirmationBusy] = useState(false);
  const [confirmationsPanelOpen, setConfirmationsPanelOpen] = useState(false);
  const [confirmationsPanelTab, setConfirmationsPanelTab] = useState<PanelTab>("pending");
  const [reassignShiftRequest, setReassignShiftRequest] =
    useState<DashboardShiftCard | null>(null);
  const proposedSendCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? shifts.filter((shift) => shift.confirmationStatus === "proposed").length
        : 0,
    [shiftConfirmationEnabled, shifts]
  );
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
  const openConfirmationsCount = useMemo(
    () =>
      shiftConfirmationEnabled
        ? shifts.filter((shift) =>
            shift.confirmationStatus === "pending" ||
            shift.confirmationStatus === "rejected" ||
            shift.confirmationStatus === "proposed"
          ).length
        : 0,
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

  useAppShellModalLockActive(sendConfirmationOpen || confirmationsPanelOpen);
  useAppShellWaitCursorActive(sendConfirmationBusy);

  function openSendConfirmation() {
    setSendConfirmationBusy(true);
    setSendConfirmationOpen(true);
  }

  function closeSendConfirmation() {
    setSendConfirmationOpen(false);
    setSendConfirmationBusy(false);
  }

  function openConfirmationsPanel(tab: PanelTab = "pending") {
    setConfirmationsPanelTab(tab);
    setConfirmationsPanelOpen(true);
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
        proposedSendCount={proposedSendCount}
        openConfirmationsCount={openConfirmationsCount}
        shiftConfirmationEnabled={shiftConfirmationEnabled}
        managerNotifications={managerNotifications}
        onOpenSendConfirmation={openSendConfirmation}
        onOpenConfirmationsPanel={openConfirmationsPanel}
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
            shifts={shifts}
            initialTab={confirmationsPanelTab}
            onClose={() => setConfirmationsPanelOpen(false)}
            onReassign={(shift) => {
              setConfirmationsPanelOpen(false);
              setReassignShiftRequest(shift);
            }}
            onSendConfirmation={() => {
              setConfirmationsPanelOpen(false);
              openSendConfirmation();
            }}
          />
        ) : null}
      </section>
    </div>
  );
}
