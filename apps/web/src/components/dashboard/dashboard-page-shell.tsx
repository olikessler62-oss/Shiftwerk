import { loadDashboardPageData } from "@/lib/dashboard-data-loader";
import { DashboardLocationPreferenceSync } from "@/components/dashboard/dashboard-location-preference-sync";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { DashboardSearchParams } from "@/lib/dashboard-page-frame";

export async function DashboardPageShell({
  params,
}: {
  params: DashboardSearchParams;
}) {
  const {
    snapshot,
    weekStart,
    selectedLocationId,
    locations,
    communicationBundle,
    settingsModals,
  } = await loadDashboardPageData(params);

  return (
    <>
      <DashboardLocationPreferenceSync locationId={selectedLocationId} />
      <DashboardShell
        snapshot={snapshot}
        weekStart={weekStart}
        locations={locations}
        selectedLocationId={selectedLocationId}
        selectedLocationName={snapshot.locationName}
        settingsModals={settingsModals}
        areas={communicationBundle.areas}
        employees={communicationBundle.employees}
        communicationSwapRequests={communicationBundle.communicationSwapRequests}
        communicationCancelActors={communicationBundle.communicationCancelActors}
        communicationHubLocationShifts={
          communicationBundle.communicationHubLocationShifts
        }
        communicationHubAbsences={communicationBundle.communicationHubAbsences}
        managerNotifications={communicationBundle.managerNotifications}
        locationShifts={communicationBundle.locationShifts}
        serviceHours={communicationBundle.serviceHours}
        staffingRules={communicationBundle.staffingRules}
        staffingOverrides={communicationBundle.staffingOverrides}
        areaShiftTemplates={communicationBundle.areaShiftTemplates}
        qualifications={communicationBundle.qualifications}
        profileQualificationIds={communicationBundle.profileQualificationIds}
      />
    </>
  );
}
