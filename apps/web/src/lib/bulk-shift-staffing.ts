import {
  areDashboardShiftTimesComplete,
  availabilityRangeContainedInWindow,
} from "@/lib/available-employees-for-shift";
import {
  resolvePresetIdFromTimes,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import { presetQualificationForServiceHour } from "@/lib/bulk-shift-qualification";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing } from "@schichtwerk/types";

export type BulkRowStaffingTimes = {
  shiftTypeId: string;
  qualificationId: string;
  startTime: string;
  endTime: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
};

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

export function isStaffingFullyCovered(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return (
    entries.length > 0 &&
    entries.every((entry) => entry.assigned >= entry.required)
  );
}

export function staffingDemandExceeded(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some((entry) => entry.assigned > entry.required);
}

/** Personalbedarf-Zeile für eine neue Bulk-Zeile (auch wenn Bedarf bereits gedeckt ist). */
export function staffingEntryForNewBulkRow(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  existingRows: readonly { demandServiceHourId?: string }[] = []
): TagAreaHeaderStaffingEntry | null {
  const usedDemandIds = new Set(
    existingRows
      .map((row) => row.demandServiceHourId?.trim())
      .filter((id): id is string => Boolean(id))
  );

  const unsatisfiedUncovered = staffingEntries.find(
    (entry) =>
      entry.assigned < entry.required && !usedDemandIds.has(entry.serviceHourId)
  );
  if (unsatisfiedUncovered) return unsatisfiedUncovered;

  const unsatisfied = staffingEntries.find(
    (entry) => entry.assigned < entry.required
  );
  if (unsatisfied) return unsatisfied;

  const uncovered = staffingEntries.find(
    (entry) => !usedDemandIds.has(entry.serviceHourId)
  );
  if (uncovered) return uncovered;

  return staffingEntries[0] ?? null;
}

function sortStaffingEntriesChronologically(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[]
): TagAreaHeaderStaffingEntry[] {
  return [...staffingEntries].sort((a, b) => {
    const startA =
      personalbedarfTimesForServiceHour(serviceHours, a.serviceHourId)?.startTime ??
      "99:99";
    const startB =
      personalbedarfTimesForServiceHour(serviceHours, b.serviceHourId)?.startTime ??
      "99:99";
    return startA.localeCompare(startB) || a.serviceHourId.localeCompare(b.serviceHourId);
  });
}

/** Nächstes chronologisches ungedecktes Bedarf-Fenster; Fallback wie staffingEntryForNewBulkRow. */
export function resolveStaffingEntryForBulkPrefill(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[],
  existingRows: readonly { demandServiceHourId?: string }[] = []
): TagAreaHeaderStaffingEntry | null {
  const sorted = sortStaffingEntriesChronologically(staffingEntries, serviceHours);
  const unsatisfied = sorted.find((entry) => entry.assigned < entry.required);
  if (unsatisfied) return unsatisfied;
  return staffingEntryForNewBulkRow(staffingEntries, existingRows);
}

export type BulkShiftCurrentRowCandidate = {
  id: string;
  existingShiftId?: string;
  demandServiceHourId?: string;
};

/** Erste noch nicht gespeicherte Zeile für den aktuellen Personalbedarf. */
export function resolveCurrentBulkShiftRowId(
  rows: readonly BulkShiftCurrentRowCandidate[],
  staffingEntries: readonly TagAreaHeaderStaffingEntry[]
): string | null {
  const unsavedRows = rows.filter((row) => !row.existingShiftId);
  if (unsavedRows.length === 0) return null;

  const targetEntry = staffingEntryForNewBulkRow(staffingEntries, rows);
  if (targetEntry) {
    const demandMatch = unsavedRows.find(
      (row) => row.demandServiceHourId === targetEntry.serviceHourId
    );
    if (demandMatch) return demandMatch.id;
  }

  return unsavedRows[0]?.id ?? null;
}

export function personalbedarfTimesForServiceHour(
  serviceHours: readonly AreaServiceHourRef[],
  serviceHourId: string | undefined
): { startTime: string; endTime: string } | null {
  if (!serviceHourId) return null;
  const hour = serviceHours.find((item) => item.id === serviceHourId);
  if (!hour?.start_time || !hour?.end_time) return null;
  const startTime = timeFieldValue(hour.start_time);
  const endTime = timeFieldValue(hour.end_time);
  if (!areDashboardShiftTimesComplete(startTime, endTime)) return null;
  return { startTime, endTime };
}

/**
 * Bedarfszeiten für einen Personalbedarf-Eintrag — nicht die ggf. breiteren Servicezeiten
 * des Bereichs. Liegt genau eine Schichtvorlage im Servicezeit-Fenster, gelten deren Zeiten.
 */
export function personalbedarfDemandTimesForEntry(
  serviceHourId: string | undefined,
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly DashboardAssignmentPreset[],
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string
): { startTime: string; endTime: string; serviceHourId: string } | null {
  if (!serviceHourId) return null;
  const hour = serviceHours.find((item) => item.id === serviceHourId);
  if (!hour?.start_time || !hour?.end_time) return null;

  const hourStart = timeFieldValue(hour.start_time);
  const hourEnd = timeFieldValue(hour.end_time);
  if (!areDashboardShiftTimesComplete(hourStart, hourEnd)) return null;

  const hasStaffing = staffingRules.some(
    (rule) =>
      rule.location_area_id === areaId &&
      rule.service_hour_id === serviceHourId &&
      rule.required_count > 0
  );
  if (!hasStaffing) return null;

  const fittingTemplates = assignmentPresets.filter((preset) => {
    const startTime = timeFieldValue(preset.start_time);
    const endTime = timeFieldValue(preset.end_time);
    if (!areDashboardShiftTimesComplete(startTime, endTime)) return false;
    return availabilityRangeContainedInWindow(
      startTime,
      endTime,
      hourStart,
      hourEnd
    );
  });

  if (fittingTemplates.length === 1) {
    const preset = fittingTemplates[0]!;
    return {
      startTime: timeFieldValue(preset.start_time),
      endTime: timeFieldValue(preset.end_time),
      serviceHourId,
    };
  }

  if (resolvePresetIdFromTimes(hourStart, hourEnd, assignmentPresets)) {
    return { startTime: hourStart, endTime: hourEnd, serviceHourId };
  }

  return { startTime: hourStart, endTime: hourEnd, serviceHourId };
}

export function personalbedarfTimesForShiftType(
  shiftTypeId: string,
  assignmentPresets: readonly DashboardAssignmentPreset[]
): { startTime: string; endTime: string } | null {
  if (!shiftTypeId) return null;
  const preset = assignmentPresets.find((item) => item.id === shiftTypeId);
  if (!preset) return null;
  const startTime = timeFieldValue(preset.start_time);
  const endTime = timeFieldValue(preset.end_time);
  if (!areDashboardShiftTimesComplete(startTime, endTime)) return null;
  return { startTime, endTime };
}

export function applyPersonalbedarfTimesToBulkRow<
  T extends BulkRowStaffingTimes,
>(
  row: T,
  options: {
    serviceHours: readonly AreaServiceHourRef[];
    assignmentPresets: readonly DashboardAssignmentPreset[];
    staffingRules: readonly LocationAreaStaffing[];
    areaId: string;
    staffingEntries: readonly TagAreaHeaderStaffingEntry[];
    shiftTypeId?: string;
  }
): T {
  const shiftTypeId = options.shiftTypeId ?? row.shiftTypeId;
  let times = personalbedarfTimesForShiftType(
    shiftTypeId,
    options.assignmentPresets
  );

  if (!times && row.requestedStartTime && row.requestedEndTime) {
    times = {
      startTime: row.requestedStartTime,
      endTime: row.requestedEndTime,
    };
  }

  if (!times) {
    const serviceHourId = options.staffingEntries.find(
      (entry) =>
        resolvePresetIdFromTimes(
          row.startTime,
          row.endTime,
          options.assignmentPresets
        ) === shiftTypeId || entry.serviceHourId
    )?.serviceHourId;
    times =
      personalbedarfDemandTimesForEntry(
        serviceHourId,
        options.serviceHours,
        options.assignmentPresets,
        options.staffingRules,
        options.areaId
      ) ?? personalbedarfTimesForServiceHour(options.serviceHours, serviceHourId);
  }

  if (!times) return row;

  const qualificationId =
    row.qualificationId ||
    presetQualificationForServiceHour(
      options.staffingRules,
      options.areaId,
      options.staffingEntries.find(
        (entry) => {
          const demandTimes = personalbedarfDemandTimesForEntry(
            entry.serviceHourId,
            options.serviceHours,
            options.assignmentPresets,
            options.staffingRules,
            options.areaId
          );
          return (
            demandTimes?.startTime === times!.startTime &&
            demandTimes?.endTime === times!.endTime
          );
        }
      )?.serviceHourId
    );

  return {
    ...row,
    shiftTypeId,
    qualificationId,
    startTime: times.startTime,
    endTime: times.endTime,
    requestedStartTime: times.startTime,
    requestedEndTime: times.endTime,
  };
}
