import type { DashboardStaffingWindowRowStatus } from "@/lib/dashboard-area-week-stats";
import { listStaffingWindowConfirmationStatuses } from "@/lib/dashboard-day-confirmation-counts";
import type { DashboardStaffingWindowRow } from "@/lib/dashboard-area-week-stats";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";

export function staffingWindowRowStatusLabelKey(
  status: DashboardStaffingWindowRowStatus
): string {
  switch (status) {
    case "understaffed":
      return "dashboard.areaAssignmentOverviewWindowStatusUnderstaffed";
    case "planned":
      return "dashboard.areaAssignmentOverviewWindowStatusPlanned";
    case "overstaffed":
      return "dashboard.areaAssignmentOverviewWindowStatusOverstaffed";
    case "met":
      return "dashboard.areaAssignmentOverviewWindowStatusMet";
  }
}

export function buildStaffingWindowRowBesetztTooltip(
  row: DashboardStaffingWindowRow,
  shiftConfirmationEnabled: boolean,
  t: (key: string) => string
): string | null {
  if (row.rowKind !== "staffing_window") return null;

  const lines: string[] = [t(staffingWindowRowStatusLabelKey(row.status))];

  if (shiftConfirmationEnabled && row.confirmationCounts) {
    for (const status of listStaffingWindowConfirmationStatuses(
      row.confirmationCounts
    )) {
      const count = row.confirmationCounts[status] ?? 0;
      if (count > 0) {
        lines.push(`${count} ${t(shiftConfirmationStatusLabelKey(status))}`);
      }
    }
  }

  return lines.join("\n");
}
