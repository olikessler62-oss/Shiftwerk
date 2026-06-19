import type { AreaCalendarShiftAssignEmployee } from "@/app/actions/areacalendar-shift-assign";
import {
  areAreaCalendarShiftTimesComplete,
  filterBulkShiftAssignEmployeesForRow,
  filterBulkShiftAssignEmployeesWithoutTimeWindow,
  pickEmployeeLongestWithoutShift,
} from "@/lib/available-employees-for-shift";
import type { BulkShiftColumnPrefs } from "@/lib/bulk-shift-column-prefs";
import {
  presetQualificationForServiceHour,
  filterEmployeesWithAnyAreaQualification,
  filterEmployeesWithAnyQualificationInSet,
} from "@/lib/bulk-shift-qualification";
import {
  personalbedarfDemandTimesForEntry,
  personalbedarfTimesForServiceHour,
  resolveStaffingEntryForBulkPrefill,
} from "@/lib/bulk-shift-staffing";
import { shiftClockRangesOverlapMinutes } from "@/lib/bulk-staffing-header";
import {
  filterAssignmentPresetsMatchingTimes,
  prefillBulkRowWithEarliestAssignmentPreset,
  resolvePresetShiftTemplateForDemandTimes,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import type { StaffingQualificationOption } from "@/lib/bulk-shift-qualification";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  staffingQualificationIdsForServiceHour,
} from "@schichtwerk/database";
import type { LocationAreaStaffing } from "@schichtwerk/types";
import type { AreaCalendarAssignmentTimeWindow } from "@/lib/shift-overlap";

export type ProfileShiftPreferenceEntry = {
  weekday: number;
  start_time: string;
  end_time: string;
  location_id: string | null;
  location_area_id: string | null;
  qualification_id: string | null;
  priority: number;
};

export type BulkPrefillRow = {
  id: string;
  employeeId: string;
  qualificationId: string;
  shiftTypeId: string;
  startTime: string;
  endTime: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
  demandServiceHourId?: string;
  employeeManuallySelected: boolean;
  shiftTypeManuallySelected: boolean;
  qualificationManuallySelected: boolean;
};

export type LocationDayAssignmentRef = {
  locationAreaId: string | null;
  employeeId: string;
  startTime: string;
  endTime: string;
};

export type BuildPrefilledBulkRowInput = {
  existingRows: readonly BulkPrefillRow[];
  prefill: BulkShiftColumnPrefs["prefill"];
  staffingEntries: readonly TagAreaHeaderStaffingEntry[];
  serviceHours: readonly AreaServiceHourRef[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  staffingRules: readonly LocationAreaStaffing[];
  areaId: string;
  weekday: number;
  dateISO: string;
  countryCode: string;
  timeZone: string;
  employees: readonly AreaCalendarShiftAssignEmployee[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  profileShiftPreferences: Readonly<Record<string, ProfileShiftPreferenceEntry[]>>;
  areaQualifications: readonly StaffingQualificationOption[];
  areaExistingAssignments: readonly AreaCalendarAssignmentTimeWindow[];
  locationDayAssignments: readonly LocationDayAssignmentRef[];
  emptyEmployeeId: string;
  createEmptyRow: () => BulkPrefillRow;
  /** Bedarfsliste: konkretes Servicezeit-Fenster + Job. */
  targetDemand?: {
    serviceHourId: string;
    qualificationId: string;
  };
  /** Keine Servicezeit — nur Verfügbarkeit, keine Personalbedarf-Filter. */
  withoutServiceHours?: boolean;
};

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function otherAreaAssignmentsForBulkRow(
  locationDayAssignments: readonly LocationDayAssignmentRef[],
  areaId: string
): AreaCalendarAssignmentTimeWindow[] {
  return locationDayAssignments
    .filter(
      (assignment) =>
        assignment.locationAreaId !== areaId &&
        assignment.locationAreaId != null &&
        areAreaCalendarShiftTimesComplete(assignment.startTime, assignment.endTime)
    )
    .map((assignment) => ({
      employeeId: assignment.employeeId,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
    }));
}

function buildAreaAssignmentsForRow(
  areaExistingAssignments: readonly AreaCalendarAssignmentTimeWindow[],
  rows: readonly BulkPrefillRow[],
  excludeRowId: string,
  emptyEmployeeId: string
): AreaCalendarAssignmentTimeWindow[] {
  const fromRows = rows.flatMap((row) => {
    if (row.id === excludeRowId) return [];
    if (row.employeeId === emptyEmployeeId || !row.employeeId) return [];
    if (!areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)) return [];
    return [
      {
        employeeId: row.employeeId,
        startTime: row.startTime,
        endTime: row.endTime,
      },
    ];
  });
  return [...areaExistingAssignments, ...fromRows];
}

function matchingEmployeesForPrefillRow(
  row: Pick<
    BulkPrefillRow,
    | "id"
    | "startTime"
    | "endTime"
    | "requestedStartTime"
    | "requestedEndTime"
    | "demandServiceHourId"
  >,
  options: {
    employees: readonly AreaCalendarShiftAssignEmployee[];
    weekday: number;
    dateISO: string;
    areaId: string;
    countryCode: string;
    timeZone: string;
    staffingRules: readonly LocationAreaStaffing[];
    areaQualifications: readonly StaffingQualificationOption[];
    profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
    areaExistingAssignments: readonly AreaCalendarAssignmentTimeWindow[];
    locationDayAssignments: readonly LocationDayAssignmentRef[];
    allRows: readonly BulkPrefillRow[];
    emptyEmployeeId: string;
    withoutServiceHours?: boolean;
  }
): AreaCalendarShiftAssignEmployee[] {
  const windowStart =
    row.requestedStartTime && areAreaCalendarShiftTimesComplete(row.requestedStartTime, row.requestedEndTime ?? "")
      ? row.requestedStartTime
      : row.startTime;
  const windowEnd =
    row.requestedEndTime && areAreaCalendarShiftTimesComplete(row.requestedStartTime ?? "", row.requestedEndTime)
      ? row.requestedEndTime
      : row.endTime;

  if (options.withoutServiceHours && !areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) {
    return filterBulkShiftAssignEmployeesWithoutTimeWindow(
      options.employees,
      options.weekday
    );
  }

  if (!areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) return [];

  const areaQualificationIds = new Set(
    options.areaQualifications.map((option) => option.id)
  );
  const areaAssignmentsForRow = buildAreaAssignmentsForRow(
    options.areaExistingAssignments,
    options.allRows,
    row.id,
    options.emptyEmployeeId
  );
  const byWindow = filterBulkShiftAssignEmployeesForRow(
    options.employees,
    options.weekday,
    windowStart,
    windowEnd,
    {
      shiftDate: options.dateISO,
      countryCode: options.countryCode,
      timeZone: options.timeZone,
      areaAssignments: areaAssignmentsForRow,
      otherAreaAssignments: otherAreaAssignmentsForBulkRow(
        options.locationDayAssignments,
        options.areaId
      ),
    }
  );
  if (options.withoutServiceHours) {
    return byWindow;
  }
  const demandQualificationIds = staffingQualificationIdsForServiceHour(
    options.staffingRules,
    options.areaId,
    row.demandServiceHourId
  );
  if (demandQualificationIds.size > 0) {
    return filterEmployeesWithAnyQualificationInSet(
      byWindow,
      demandQualificationIds,
      options.profileQualificationIds
    );
  }
  return filterEmployeesWithAnyAreaQualification(
    byWindow,
    areaQualificationIds,
    options.profileQualificationIds
  );
}

function employeeWishScore(
  employeeId: string,
  demandStart: string,
  demandEnd: string,
  areaId: string,
  preferences: Readonly<Record<string, ProfileShiftPreferenceEntry[]>>
): number {
  const wishes = preferences[employeeId] ?? [];
  let best = 0;
  for (const wish of wishes) {
    const areaMatch =
      !wish.location_area_id || wish.location_area_id === areaId;
    if (!areaMatch) continue;
    const overlap = shiftClockRangesOverlapMinutes(
      demandStart,
      demandEnd,
      timeFieldValue(wish.start_time),
      timeFieldValue(wish.end_time)
    );
    if (overlap <= 0) continue;
    best = Math.max(best, overlap * 100 + wish.priority);
  }
  return best;
}

export function pickEmployeeForBulkPrefill(
  candidates: readonly AreaCalendarShiftAssignEmployee[],
  demandStart: string,
  demandEnd: string,
  areaId: string,
  preferences: Readonly<Record<string, ProfileShiftPreferenceEntry[]>>
): AreaCalendarShiftAssignEmployee | null {
  if (!candidates.length) return null;

  const ranked = [...candidates].sort((a, b) => {
    const wishDiff =
      employeeWishScore(b.id, demandStart, demandEnd, areaId, preferences) -
      employeeWishScore(a.id, demandStart, demandEnd, areaId, preferences);
    if (wishDiff !== 0) return wishDiff;

    if (!a.last_shift_date && !b.last_shift_date) {
      return a.full_name.localeCompare(b.full_name, "de");
    }
    if (!a.last_shift_date) return -1;
    if (!b.last_shift_date) return 1;
    const byDate = a.last_shift_date.localeCompare(b.last_shift_date);
    if (byDate !== 0) return byDate;
    return a.full_name.localeCompare(b.full_name, "de");
  });

  return ranked[0] ?? pickEmployeeLongestWithoutShift(candidates);
}

export function buildPrefilledBulkRow(input: BuildPrefilledBulkRowInput): BulkPrefillRow {
  const row = input.createEmptyRow();

  if (input.withoutServiceHours) {
    row.employeeManuallySelected = !input.prefill.employee;
    row.shiftTypeManuallySelected = !input.prefill.template;
    row.qualificationManuallySelected = !input.prefill.qualification;

    prefillBulkRowWithEarliestAssignmentPreset(row, input.assignmentPresets);

    if (
      input.prefill.employee &&
      areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)
    ) {
      const picked = pickEmployeeForBulkPrefill(
        matchingEmployeesForPrefillRow(row, {
          employees: input.employees,
          weekday: input.weekday,
          dateISO: input.dateISO,
          areaId: input.areaId,
          countryCode: input.countryCode,
          timeZone: input.timeZone,
          staffingRules: input.staffingRules,
          areaQualifications: input.areaQualifications,
          profileQualificationIds: input.profileQualificationIds,
          areaExistingAssignments: input.areaExistingAssignments,
          locationDayAssignments: input.locationDayAssignments,
          allRows: input.existingRows,
          emptyEmployeeId: input.emptyEmployeeId,
          withoutServiceHours: true,
        }),
        row.startTime,
        row.endTime,
        input.areaId,
        input.profileShiftPreferences
      );
      if (picked) {
        row.employeeId = picked.id;
      }
    }

    return row;
  }

  const targetEntry = input.targetDemand
    ? (input.staffingEntries.find(
        (entry) => entry.serviceHourId === input.targetDemand!.serviceHourId
      ) ?? null)
    : resolveStaffingEntryForBulkPrefill(
        input.staffingEntries,
        input.serviceHours,
        input.existingRows
      );

  const shouldSetDemandTimes =
    input.prefill.template ||
    input.prefill.qualification ||
    input.prefill.employee;

  let demand = targetEntry
    ? personalbedarfDemandTimesForEntry(
        targetEntry.serviceHourId,
        input.serviceHours,
        input.assignmentPresets,
        input.staffingRules,
        input.areaId
      )
    : null;

  if (!demand && targetEntry?.serviceHourId) {
    const hourTimes = personalbedarfTimesForServiceHour(
      input.serviceHours,
      targetEntry.serviceHourId
    );
    if (hourTimes) {
      demand = {
        ...hourTimes,
        serviceHourId: targetEntry.serviceHourId,
      };
    }
  }

  row.demandServiceHourId =
    demand?.serviceHourId || targetEntry?.serviceHourId || undefined;

  if (shouldSetDemandTimes) {
    const startTime = demand?.startTime ?? "00:00";
    const endTime = demand?.endTime ?? "00:00";
    const demandTimesComplete = areAreaCalendarShiftTimesComplete(startTime, endTime);

    row.startTime = demandTimesComplete ? startTime : "00:00";
    row.endTime = demandTimesComplete ? endTime : "00:00";
    row.requestedStartTime = demandTimesComplete ? startTime : undefined;
    row.requestedEndTime = demandTimesComplete ? endTime : undefined;
  }

  if (!input.prefill.template) {
    row.shiftTypeManuallySelected = true;
  }

  if (!input.prefill.qualification) {
    row.qualificationManuallySelected = true;
  }

  if (!input.prefill.employee) {
    row.employeeManuallySelected = true;
  }

  if (input.prefill.template && shouldSetDemandTimes) {
    const startTime = row.startTime;
    const endTime = row.endTime;
    const demandTimesComplete = areAreaCalendarShiftTimesComplete(startTime, endTime);

    if (demandTimesComplete) {
      const matchedPresetId = resolvePresetShiftTemplateForDemandTimes(
        startTime,
        endTime,
        input.assignmentPresets
      );
      if (matchedPresetId) {
        const preset = input.assignmentPresets.find((item) => item.id === matchedPresetId);
        if (preset) {
          row.shiftTypeId = matchedPresetId;
          row.startTime = timeFieldValue(preset.start_time);
          row.endTime = timeFieldValue(preset.end_time);
        }
      } else {
        const matching = filterAssignmentPresetsMatchingTimes(
          startTime,
          endTime,
          input.assignmentPresets
        );
        if (matching.length === 1) {
          row.shiftTypeId = matching[0]!.id;
          row.startTime = timeFieldValue(matching[0]!.start_time);
          row.endTime = timeFieldValue(matching[0]!.end_time);
        }
      }
    }
  }

  if (input.prefill.qualification) {
    if (input.targetDemand?.qualificationId) {
      row.qualificationId = input.targetDemand.qualificationId;
    } else if (row.demandServiceHourId) {
      row.qualificationId = presetQualificationForServiceHour(
        input.staffingRules,
        input.areaId,
        row.demandServiceHourId
      );
    }
  }

  if (
    input.prefill.employee &&
    areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)
  ) {
    let eligible = matchingEmployeesForPrefillRow(row, {
      employees: input.employees,
      weekday: input.weekday,
      dateISO: input.dateISO,
      areaId: input.areaId,
      countryCode: input.countryCode,
      timeZone: input.timeZone,
      staffingRules: input.staffingRules,
      areaQualifications: input.areaQualifications,
      profileQualificationIds: input.profileQualificationIds,
      areaExistingAssignments: input.areaExistingAssignments,
      locationDayAssignments: input.locationDayAssignments,
      allRows: input.existingRows,
      emptyEmployeeId: input.emptyEmployeeId,
    });
    if (input.targetDemand?.qualificationId) {
      eligible = filterEmployeesWithAnyQualificationInSet(
        eligible,
        new Set([input.targetDemand.qualificationId]),
        input.profileQualificationIds
      );
    }
    const picked = pickEmployeeForBulkPrefill(
      eligible,
      row.startTime,
      row.endTime,
      input.areaId,
      input.profileShiftPreferences
    );
    if (picked) {
      row.employeeId = picked.id;
    }
  }

  return row;
}
