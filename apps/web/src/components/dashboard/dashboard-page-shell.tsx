import { DashboardSummaryShell } from "@/components/dashboard/dashboard-summary-shell";
import { DashboardLocationPreferenceSync } from "@/components/dashboard/dashboard-location-preference-sync";
import { loadDashboardPageData } from "@/lib/dashboard-data-loader";
import type { DashboardSearchParams } from "@/lib/dashboard-page-frame";

/** Dashboard: Schichtübersicht als Liste (kein Kalender). */
export async function DashboardPageShell({
  params,
}: {
  params: DashboardSearchParams;
}) {
  const {
    weekStart,
    dates,
    locations,
    selectedLocationId,
    selectedLocation,
    summaryBundle,
    readOnlyWeek,
    loadSettingsModalsData,
    settingsRoles,
    settingsProfiles,
    settingsCompensationSurchargeTypes,
  } = await loadDashboardPageData(params);

  return (
    <>
      <DashboardLocationPreferenceSync locationId={selectedLocationId} />
      <DashboardSummaryShell
        weekStart={weekStart}
        dates={dates}
        locations={locations}
        selectedLocationId={selectedLocationId}
        selectedLocationName={selectedLocation?.name}
        areas={summaryBundle.areas}
        locationShifts={summaryBundle.locationShifts}
        employees={summaryBundle.employees}
        serviceHours={summaryBundle.serviceHours}
        staffingRules={summaryBundle.staffingRules}
        staffingOverrides={summaryBundle.staffingOverrides}
        areaShiftTemplates={summaryBundle.areaShiftTemplates}
        qualifications={summaryBundle.qualifications}
        profileQualificationIds={summaryBundle.profileQualificationIds}
        absences={summaryBundle.absences}
        communicationSwapRequests={summaryBundle.communicationSwapRequests}
        communicationCancelActors={summaryBundle.communicationCancelActors}
        managerNotifications={summaryBundle.managerNotifications}
        readOnlyWeek={readOnlyWeek}
        settingsModals={
          loadSettingsModalsData
            ? {
                profiles: settingsProfiles,
                roles: settingsRoles,
                compensationSurchargeTypes: settingsCompensationSurchargeTypes,
              }
            : undefined
        }
      />
    </>
  );
}
