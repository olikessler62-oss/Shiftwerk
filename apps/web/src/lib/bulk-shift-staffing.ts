import {
  areAreaCalendarShiftTimesComplete,
  availabilityRangeContainedInWindow,
} from "@/lib/available-employees-for-shift";
import {
  resolvePresetIdFromTimes,
  resolvePresetShiftTemplateForDemandTimes,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import { presetQualificationForServiceHour } from "@/lib/bulk-shift-qualification";
import { isTagAreaHeaderStaffingEntryOverstaffed } from "@/lib/tag-area-header-staffing-display";
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
  if (entries.length === 0) return false;

  return entries.every((entry) => {
    const qualifications =
      entry.qualifications?.filter((qualification) => qualification.required > 0) ??
      [];
    if (qualifications.length > 0) {
      return qualifications.every(
        (qualification) => qualification.assigned >= qualification.required
      );
    }
    return entry.assigned >= entry.required;
  });
}

export function staffingDemandExceeded(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some((entry) => isTagAreaHeaderStaffingEntryOverstaffed(entry));
}

export type BulkStaffingRowDemandRef = {
  demandServiceHourId?: string;
  qualificationId?: string;
  existingShiftId?: string;
  employeeId?: string;
  startTime?: string;
  endTime?: string;
};

export type OpenStaffingDemandRef = {
  serviceHourId: string;
  qualificationId: string;
};

function isCompleteUnsavedDemandRow(
  row: BulkStaffingRowDemandRef
): boolean {
  if (row.existingShiftId) return false;
  if (!row.employeeId) return false;
  return areAreaCalendarShiftTimesComplete(
    row.startTime ?? "",
    row.endTime ?? ""
  );
}

function completeUnsavedRowCountForServiceHour(
  existingRows: readonly BulkStaffingRowDemandRef[],
  serviceHourId: string
): number {
  return existingRows.filter((row) => {
    if (!isCompleteUnsavedDemandRow(row)) return false;
    return row.demandServiceHourId === serviceHourId;
  }).length;
}

function completeUnsavedRowCountForQualificationDemand(
  existingRows: readonly BulkStaffingRowDemandRef[],
  serviceHourId: string,
  qualificationId: string
): number {
  return existingRows.filter((row) => {
    if (!isCompleteUnsavedDemandRow(row)) return false;
    if (row.demandServiceHourId !== serviceHourId) return false;
    return row.qualificationId === qualificationId;
  }).length;
}

/** Offener Bedarf einer Tätigkeit unter Berücksichtigung vorbefüllter Zeilen. */
export function resolveRemainingQualificationNeed(
  entry: TagAreaHeaderStaffingEntry,
  qualificationId: string,
  existingRows: readonly BulkStaffingRowDemandRef[] = []
): number {
  const qualification = entry.qualifications?.find(
    (item) => item.qualificationId === qualificationId
  );
  if (!qualification) return 0;

  const completeUnsavedRows = completeUnsavedRowCountForQualificationDemand(
    existingRows,
    entry.serviceHourId,
    qualificationId
  );
  const effectiveAssigned = Math.max(qualification.assigned, completeUnsavedRows);
  return Math.max(0, qualification.required - effectiveAssigned);
}

/** Offener Bedarf unter Berücksichtigung bereits vorbefüllter, noch nicht gespeicherter Zeilen. */
export function resolveRemainingStaffingNeed(
  entry: TagAreaHeaderStaffingEntry,
  existingRows: readonly BulkStaffingRowDemandRef[] = []
): number {
  const completeUnsavedRows = completeUnsavedRowCountForServiceHour(
    existingRows,
    entry.serviceHourId
  );
  const effectiveAssigned = Math.max(entry.assigned, completeUnsavedRows);
  return Math.max(0, entry.required - effectiveAssigned);
}

/** Nächstes Bedarf-Fenster mit offenem Personalbedarf. */
export function staffingEntryForNewBulkRow(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  existingRows: readonly BulkStaffingRowDemandRef[] = []
): TagAreaHeaderStaffingEntry | null {
  const openDemand = resolveNextOpenStaffingDemand(
    staffingEntries,
    [],
    existingRows
  );
  if (!openDemand) return null;
  return (
    staffingEntries.find(
      (entry) => entry.serviceHourId === openDemand.serviceHourId
    ) ?? null
  );
}

/** Nächstes offenes Zeitfenster inkl. Tätigkeit (chronologisch). */
export function resolveNextOpenStaffingDemand(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[],
  existingRows: readonly BulkStaffingRowDemandRef[] = [],
  options?: {
    staffingRules?: readonly LocationAreaStaffing[];
    areaId?: string;
  }
): OpenStaffingDemandRef | null {
  const sorted = sortStaffingEntriesChronologically(staffingEntries, serviceHours);
  const staffingRules = options?.staffingRules ?? [];
  const areaId = options?.areaId ?? "";

  for (const entry of sorted) {
    const qualifications =
      entry.qualifications?.filter((qualification) => qualification.required > 0) ??
      [];

    if (qualifications.length > 0) {
      for (const qualification of qualifications) {
        if (
          resolveRemainingQualificationNeed(
            entry,
            qualification.qualificationId,
            existingRows
          ) > 0
        ) {
          return {
            serviceHourId: entry.serviceHourId,
            qualificationId: qualification.qualificationId,
          };
        }
      }
      continue;
    }

    if (resolveRemainingStaffingNeed(entry, existingRows) > 0) {
      return {
        serviceHourId: entry.serviceHourId,
        qualificationId: presetQualificationForServiceHour(
          staffingRules,
          areaId,
          entry.serviceHourId
        ),
      };
    }
  }

  return null;
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

/** Nächstes chronologisches ungedecktes Bedarf-Fenster. */
export function resolveStaffingEntryForBulkPrefill(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[],
  existingRows: readonly BulkStaffingRowDemandRef[] = [],
  options?: {
    staffingRules?: readonly LocationAreaStaffing[];
    areaId?: string;
  }
): TagAreaHeaderStaffingEntry | null {
  const openDemand = resolveNextOpenStaffingDemand(
    staffingEntries,
    serviceHours,
    existingRows,
    options
  );
  if (!openDemand) return null;
  return (
    staffingEntries.find(
      (entry) => entry.serviceHourId === openDemand.serviceHourId
    ) ?? null
  );
}

export type OpenDemandShiftPrefill = {
  presetId: string;
  startTime: string;
  endTime: string;
  qualificationId: string;
};

/** Früheste Schicht mit offenem Personalbedarf (chronologisch). */
export function resolveOpenDemandShiftPrefill(input: {
  areaId: string;
  staffingEntries: readonly TagAreaHeaderStaffingEntry[];
  serviceHours: readonly AreaServiceHourRef[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  staffingRules: readonly LocationAreaStaffing[];
  existingRows?: readonly BulkStaffingRowDemandRef[];
}): OpenDemandShiftPrefill | null {
  const openDemand = resolveNextOpenStaffingDemand(
    input.staffingEntries,
    input.serviceHours,
    input.existingRows ?? [],
    {
      staffingRules: input.staffingRules,
      areaId: input.areaId,
    }
  );
  if (!openDemand) {
    return null;
  }

  let demand = personalbedarfDemandTimesForEntry(
    openDemand.serviceHourId,
    input.serviceHours,
    input.assignmentPresets,
    input.staffingRules,
    input.areaId
  );

  if (!demand && openDemand.serviceHourId) {
    const hourTimes = personalbedarfTimesForServiceHour(
      input.serviceHours,
      openDemand.serviceHourId
    );
    if (hourTimes) {
      demand = {
        ...hourTimes,
        serviceHourId: openDemand.serviceHourId,
      };
    }
  }

  if (!demand || !areAreaCalendarShiftTimesComplete(demand.startTime, demand.endTime)) {
    return null;
  }

  const presetId =
    resolvePresetShiftTemplateForDemandTimes(
      demand.startTime,
      demand.endTime,
      input.assignmentPresets
    ) ?? "";

  let startTime = demand.startTime;
  let endTime = demand.endTime;
  if (presetId) {
    const preset = input.assignmentPresets.find((item) => item.id === presetId);
    if (preset) {
      startTime = timeFieldValue(preset.start_time);
      endTime = timeFieldValue(preset.end_time);
    }
  }

  const qualificationId =
    openDemand.qualificationId ||
    presetQualificationForServiceHour(
      input.staffingRules,
      input.areaId,
      demand.serviceHourId
    ) ||
    "";

  return { presetId, startTime, endTime, qualificationId };
}

export type AddShiftFormInitialValues = {
  shiftTypeId: string;
  startTime: string;
  endTime: string;
};

export function resolveAddShiftFormInitialValues(input: {
  areaId: string | null;
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  staffingEntries: readonly TagAreaHeaderStaffingEntry[];
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
}): AddShiftFormInitialValues {
  if (input.areaId) {
    const demandPrefill = resolveOpenDemandShiftPrefill({
      areaId: input.areaId,
      staffingEntries: input.staffingEntries,
      serviceHours: input.serviceHours,
      assignmentPresets: input.assignmentPresets,
      staffingRules: input.staffingRules,
    });
    if (demandPrefill) {
      return {
        shiftTypeId: demandPrefill.presetId,
        startTime: demandPrefill.startTime,
        endTime: demandPrefill.endTime,
      };
    }
  }

  const firstPreset = input.assignmentPresets[0];
  if (firstPreset) {
    return {
      shiftTypeId: firstPreset.id,
      startTime: timeFieldValue(firstPreset.start_time),
      endTime: timeFieldValue(firstPreset.end_time),
    };
  }

  return { shiftTypeId: "", startTime: "00:00", endTime: "00:00" };
}

export type BulkShiftCurrentRowCandidate = {
  id: string;
  existingShiftId?: string;
  demandServiceHourId?: string;
  qualificationId?: string;
};

/** Erste noch nicht gespeicherte Zeile für den aktuellen Personalbedarf. */
export function resolveCurrentBulkShiftRowId(
  rows: readonly BulkShiftCurrentRowCandidate[],
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[] = [],
  options?: {
    staffingRules?: readonly LocationAreaStaffing[];
    areaId?: string;
  }
): string | null {
  const unsavedRows = rows.filter((row) => !row.existingShiftId);
  if (unsavedRows.length === 0) return null;

  const openDemand = resolveNextOpenStaffingDemand(
    staffingEntries,
    serviceHours,
    rows,
    options
  );
  if (openDemand) {
    const demandMatch = unsavedRows.find(
      (row) =>
        row.demandServiceHourId === openDemand.serviceHourId &&
        (!openDemand.qualificationId ||
          row.qualificationId === openDemand.qualificationId)
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
  if (!areAreaCalendarShiftTimesComplete(startTime, endTime)) return null;
  return { startTime, endTime };
}

/**
 * Bedarfszeiten für einen Personalbedarf-Eintrag — nicht die ggf. breiteren Servicezeiten
 * des Bereichs. Liegt genau eine Schichtvorlage im Servicezeit-Fenster, gelten deren Zeiten.
 */
export function personalbedarfDemandTimesForEntry(
  serviceHourId: string | undefined,
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly AreaCalendarAssignmentPreset[],
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string
): { startTime: string; endTime: string; serviceHourId: string } | null {
  if (!serviceHourId) return null;
  const hour = serviceHours.find((item) => item.id === serviceHourId);
  if (!hour?.start_time || !hour?.end_time) return null;

  const hourStart = timeFieldValue(hour.start_time);
  const hourEnd = timeFieldValue(hour.end_time);
  if (!areAreaCalendarShiftTimesComplete(hourStart, hourEnd)) return null;

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
    if (!areAreaCalendarShiftTimesComplete(startTime, endTime)) return false;
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
  assignmentPresets: readonly AreaCalendarAssignmentPreset[]
): { startTime: string; endTime: string } | null {
  if (!shiftTypeId) return null;
  const preset = assignmentPresets.find((item) => item.id === shiftTypeId);
  if (!preset) return null;
  const startTime = timeFieldValue(preset.start_time);
  const endTime = timeFieldValue(preset.end_time);
  if (!areAreaCalendarShiftTimesComplete(startTime, endTime)) return null;
  return { startTime, endTime };
}

export function applyPersonalbedarfTimesToBulkRow<
  T extends BulkRowStaffingTimes,
>(
  row: T,
  options: {
    serviceHours: readonly AreaServiceHourRef[];
    assignmentPresets: readonly AreaCalendarAssignmentPreset[];
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
