import type { BulkShiftColumnPrefs } from "@/lib/bulk-shift-column-prefs";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

export type BulkStaffingTableRow = {
  key: string;
  serviceHourId: string;
  /** null = reine Überschrift ohne Job-Zeile (kein Speed-Button). */
  qualificationId: string | null;
  /** Schichtvorlage (z. B. Frühschicht), falls Zeiten einer Vorlage entsprechen. */
  shiftLabel: string;
  timeLabel: string;
  hasFormattedTimeRange: boolean;
  required: number;
  qualificationName: string;
  assigned: number;
  totalAssigned: number;
  met: boolean;
};

export function isBulkShiftStaffingSpeedModeActive(
  prefill: BulkShiftColumnPrefs["prefill"]
): boolean {
  return prefill.template && prefill.qualification && prefill.employee;
}

export function bulkStaffingTableRowsSupportSpeedActions(
  rows: readonly Pick<BulkStaffingTableRow, "qualificationId">[]
): boolean {
  return rows.some((row) => row.qualificationId != null);
}

export function buildBulkStaffingTableRows(
  entries: readonly TagAreaHeaderStaffingEntry[]
): BulkStaffingTableRow[] {
  const rows: BulkStaffingTableRow[] = [];
  for (const entry of entries) {
    const qualifications =
      entry.qualifications?.filter((qualification) => qualification.required > 0) ??
      [];
    if (qualifications.length > 0) {
      for (const qualification of qualifications) {
        rows.push({
          key: `${entry.serviceHourId}:${qualification.qualificationId}`,
          serviceHourId: entry.serviceHourId,
          qualificationId: qualification.qualificationId,
          shiftLabel: entry.shiftTemplateLabel?.trim() ?? "",
          timeLabel: entry.timeLabel ?? entry.label,
          hasFormattedTimeRange: Boolean(entry.timeLabel),
          required: qualification.required,
          qualificationName: qualification.name,
          assigned: qualification.assigned,
          totalAssigned: qualification.assigned,
          met: qualification.assigned >= qualification.required,
        });
      }
      continue;
    }
    rows.push({
      key: entry.serviceHourId,
      serviceHourId: entry.serviceHourId,
      qualificationId: null,
      shiftLabel: entry.shiftTemplateLabel?.trim() ?? "",
      timeLabel: entry.timeLabel ?? entry.label,
      hasFormattedTimeRange: Boolean(entry.timeLabel),
      required: entry.required,
      qualificationName: "—",
      assigned: entry.assigned,
      totalAssigned: entry.assigned,
      met: entry.assigned >= entry.required,
    });
  }
  return rows;
}
