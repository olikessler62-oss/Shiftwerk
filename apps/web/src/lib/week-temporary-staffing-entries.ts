import {
  resolvePresetIdFromTimes,
  resolvePresetShiftTemplateForDemandTimes,
} from "@/lib/areacalendar-assignment-presets";
import { personalbedarfDemandTimesForEntry } from "@/lib/bulk-shift-staffing";
import { suggestStaffingCreateWindow } from "@/lib/location-staffing-create-suggest";
import {
  serviceWeekdayForDate,
  sampleDateISOForWeekday,
  tagAreaHeaderStaffingEntries,
} from "@/lib/location-staffing-client";
import { staffingRulesWithOverridesForAreaDate } from "@/lib/staffing-rules-with-overrides";
import type {
  AreaShiftTemplateWithBreaks,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Qualification,
} from "@schichtwerk/types";

export type WeekTemporaryQualRow = {
  key: string;
  qualification_id: string;
  count: string;
};

export type WeekTemporaryStaffingEntry = {
  key: string;
  serviceHourId?: string;
  templateId: string;
  startTime: string;
  endTime: string;
  qualifications: WeekTemporaryQualRow[];
};

let shiftEntryKeyCounter = 0;
export function nextWeekTemporaryShiftEntryKey(): string {
  shiftEntryKeyCounter += 1;
  return `week-shift-${shiftEntryKeyCounter}`;
}

let qualRowKeyCounter = 0;
export function nextWeekTemporaryQualRowKey(): string {
  qualRowKeyCounter += 1;
  return `week-qual-${qualRowKeyCounter}`;
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function windowKey(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`;
}

function buildQualRowsFromOverrides(
  serviceHourId: string,
  anchorDate: string,
  areaId: string,
  staffing: readonly LocationAreaStaffing[],
  overrides: readonly LocationAreaStaffingOverride[]
): WeekTemporaryQualRow[] {
  const overrideRules = overrides.filter(
    (override) =>
      override.location_area_id === areaId &&
      override.shift_date === anchorDate &&
      override.service_hour_id === serviceHourId &&
      override.required_count > 0
  );
  const source =
    overrideRules.length > 0
      ? overrideRules
      : staffing.filter(
          (rule) => rule.service_hour_id === serviceHourId && rule.required_count > 0
        );
  return source.map((rule) => ({
    key: nextWeekTemporaryQualRowKey(),
    qualification_id: rule.qualification_id,
    count: String(rule.required_count),
  }));
}

function defaultQualRow(qualifications: readonly Qualification[]): WeekTemporaryQualRow[] {
  if (!qualifications[0]) return [];
  return [
    {
      key: nextWeekTemporaryQualRowKey(),
      qualification_id: qualifications[0].id,
      count: "1",
    },
  ];
}

function entryFromServiceHour(
  serviceHourId: string,
  anchorDate: string,
  areaId: string,
  staffing: readonly LocationAreaStaffing[],
  overrides: readonly LocationAreaStaffingOverride[],
  serviceHours: readonly LocationAreaServiceHour[],
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[],
  qualifications: readonly Qualification[]
): WeekTemporaryStaffingEntry {
  const mergedStaffing = staffingRulesWithOverridesForAreaDate(
    staffing,
    overrides,
    areaId,
    anchorDate
  );
  const hour = serviceHours.find((item) => item.id === serviceHourId);
  const demand = personalbedarfDemandTimesForEntry(
    serviceHourId,
    serviceHours,
    shiftTemplates,
    mergedStaffing,
    areaId
  );
  const startTime =
    demand?.startTime ?? timeFieldValue(hour?.start_time ?? "");
  const endTime = demand?.endTime ?? timeFieldValue(hour?.end_time ?? "");
  const qualificationsRows = buildQualRowsFromOverrides(
    serviceHourId,
    anchorDate,
    areaId,
    staffing,
    overrides
  );
  return {
    key: nextWeekTemporaryShiftEntryKey(),
    serviceHourId,
    templateId: resolvePresetShiftTemplateForDemandTimes(
      startTime,
      endTime,
      shiftTemplates,
      resolvePresetIdFromTimes(startTime, endTime, shiftTemplates) ?? ""
    ),
    startTime,
    endTime,
    qualifications:
      qualificationsRows.length > 0
        ? qualificationsRows
        : defaultQualRow(qualifications),
  };
}

export function buildWeekTemporaryStaffingEntries(input: {
  areaId: string;
  anchorDate: string;
  initialServiceHourId?: string;
  serviceHours: readonly LocationAreaServiceHour[];
  staffing: readonly LocationAreaStaffing[];
  staffingOverrides: readonly LocationAreaStaffingOverride[];
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[];
  qualifications: readonly Qualification[];
}): WeekTemporaryStaffingEntry[] {
  return buildStaffingShiftEntriesForAreaDay({
    areaId: input.areaId,
    dateISO: input.anchorDate,
    initialServiceHourId: input.initialServiceHourId,
    serviceHours: input.serviceHours,
    staffing: input.staffing,
    staffingOverrides: input.staffingOverrides,
    shiftTemplates: input.shiftTemplates,
    qualifications: input.qualifications,
  });
}

/** Eine leere Schichtzeile für Personalbedarf anlegen (nicht bestehende Fenster laden). */
export function buildCreateStaffingShiftEntries(input: {
  serviceHours: readonly LocationAreaServiceHour[];
  staffing: readonly LocationAreaStaffing[];
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[];
  qualifications: readonly Qualification[];
}): WeekTemporaryStaffingEntry[] {
  const suggestion = suggestStaffingCreateWindow(
    input.serviceHours,
    input.staffing,
    input.shiftTemplates,
    { searchAllWeekdays: true }
  );
  return [
    {
      key: nextWeekTemporaryShiftEntryKey(),
      templateId: suggestion.templateId,
      startTime: suggestion.start_time,
      endTime: suggestion.end_time,
      qualifications: defaultQualRow(input.qualifications),
    },
  ];
}

export function buildBulkStaffingShiftEntries(input: {
  areaId: string;
  referenceWeekday: number;
  initialServiceHourId?: string;
  serviceHours: readonly LocationAreaServiceHour[];
  staffing: readonly LocationAreaStaffing[];
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[];
  qualifications: readonly Qualification[];
}): WeekTemporaryStaffingEntry[] {
  return buildStaffingShiftEntriesForAreaDay({
    areaId: input.areaId,
    dateISO: sampleDateISOForWeekday(input.referenceWeekday),
    initialServiceHourId: input.initialServiceHourId,
    serviceHours: input.serviceHours,
    staffing: input.staffing,
    staffingOverrides: [],
    shiftTemplates: input.shiftTemplates,
    qualifications: input.qualifications,
  });
}

export function buildStaffingShiftEntriesForAreaDay(input: {
  areaId: string;
  dateISO: string;
  initialServiceHourId?: string;
  serviceHours: readonly LocationAreaServiceHour[];
  staffing: readonly LocationAreaStaffing[];
  staffingOverrides?: readonly LocationAreaStaffingOverride[];
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[];
  qualifications: readonly Qualification[];
}): WeekTemporaryStaffingEntry[] {
  const {
    areaId,
    dateISO,
    initialServiceHourId,
    serviceHours,
    staffing,
    staffingOverrides = [],
    shiftTemplates,
    qualifications,
  } = input;

  const weekday = serviceWeekdayForDate(dateISO);
  const mergedStaffing = staffingRulesWithOverridesForAreaDate(
    staffing,
    staffingOverrides,
    areaId,
    dateISO
  );
  const staffedEntries = tagAreaHeaderStaffingEntries(
    mergedStaffing,
    areaId,
    dateISO,
    serviceHours,
    []
  );
  const staffedHourIds = staffedEntries.map((entry) => entry.serviceHourId);

  if (
    initialServiceHourId &&
    !staffedHourIds.includes(initialServiceHourId)
  ) {
    const initialHour = serviceHours.find(
      (hour) => hour.id === initialServiceHourId
    );
    if (initialHour && initialHour.weekday === weekday) {
      staffedHourIds.unshift(initialServiceHourId);
    }
  }

  if (staffedHourIds.length > 0) {
    const sortedHourIds = [...staffedHourIds].sort((hourIdA, hourIdB) => {
      const demandA = personalbedarfDemandTimesForEntry(
        hourIdA,
        serviceHours,
        shiftTemplates,
        mergedStaffing,
        areaId
      );
      const demandB = personalbedarfDemandTimesForEntry(
        hourIdB,
        serviceHours,
        shiftTemplates,
        mergedStaffing,
        areaId
      );
      const hourA = serviceHours.find((hour) => hour.id === hourIdA);
      const hourB = serviceHours.find((hour) => hour.id === hourIdB);
      const startA =
        demandA?.startTime ?? timeFieldValue(hourA?.start_time ?? "");
      const startB =
        demandB?.startTime ?? timeFieldValue(hourB?.start_time ?? "");
      return startA.localeCompare(startB);
    });

    return sortedHourIds.map((serviceHourId) =>
      entryFromServiceHour(
        serviceHourId,
        dateISO,
        areaId,
        staffing,
        staffingOverrides,
        serviceHours,
        shiftTemplates,
        qualifications
      )
    );
  }

  if (initialServiceHourId) {
    const initialHour = serviceHours.find(
      (hour) => hour.id === initialServiceHourId
    );
    if (initialHour) {
      return [
        entryFromServiceHour(
          initialServiceHourId,
          dateISO,
          areaId,
          staffing,
          staffingOverrides,
          serviceHours,
          shiftTemplates,
          qualifications
        ),
      ];
    }
  }

  const suggestion = suggestStaffingCreateWindow(
    serviceHours,
    staffing,
    shiftTemplates,
    { searchAllWeekdays: true }
  );
  return [
    {
      key: nextWeekTemporaryShiftEntryKey(),
      templateId: suggestion.templateId,
      startTime: suggestion.start_time,
      endTime: suggestion.end_time,
      qualifications: defaultQualRow(qualifications),
    },
  ];
}

export function suggestNextWeekTemporaryShiftEntry(
  existingEntries: readonly WeekTemporaryStaffingEntry[],
  serviceHours: readonly LocationAreaServiceHour[],
  staffing: readonly LocationAreaStaffing[],
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[],
  qualifications: readonly Qualification[]
): WeekTemporaryStaffingEntry {
  const usedWindows = new Set(
    existingEntries.map((entry) => windowKey(entry.startTime, entry.endTime))
  );
  const suggestion = suggestStaffingCreateWindow(
    serviceHours,
    staffing,
    shiftTemplates,
    { searchAllWeekdays: true }
  );

  let startTime = suggestion.start_time;
  let endTime = suggestion.end_time;
  let templateId = suggestion.templateId;

  for (const template of shiftTemplates) {
    const start = timeFieldValue(template.start_time);
    const end = timeFieldValue(template.end_time);
    const key = windowKey(start, end);
    if (!usedWindows.has(key)) {
      startTime = start;
      endTime = end;
      templateId = template.id;
      break;
    }
  }

  return {
    key: nextWeekTemporaryShiftEntryKey(),
    templateId,
    startTime,
    endTime,
    qualifications: defaultQualRow(qualifications),
  };
}
