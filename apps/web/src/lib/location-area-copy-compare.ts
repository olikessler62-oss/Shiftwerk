import { normalizeServiceHourTimeComparable } from "@schichtwerk/database";
import type {
  AreaShiftTemplateWithBreaks,
  LocationAreaServiceHour,
  LocationAreaStaffing,
} from "@schichtwerk/types";
import {
  buildServiceHourPayloadFromEntries,
  type ServiceHourEntry,
} from "@/lib/location-service-hour-entries";

type ServiceHourRow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

function normalizeServiceHourRowKeys(rows: ServiceHourRow[]): string[] {
  return rows
    .map((row) => ({
      weekday: row.weekday,
      start_time: normalizeServiceHourTimeComparable(row.start_time),
      end_time: normalizeServiceHourTimeComparable(row.end_time),
    }))
    .sort(
      (a, b) =>
        a.weekday - b.weekday ||
        a.start_time.localeCompare(b.start_time) ||
        a.end_time.localeCompare(b.end_time)
    )
    .map((row) => `${row.weekday}|${row.start_time}|${row.end_time}`);
}

export function serviceHoursSetsEqual(
  current: ServiceHourRow[],
  source: readonly LocationAreaServiceHour[]
): boolean {
  const currentKeys = normalizeServiceHourRowKeys(current);
  const sourceKeys = normalizeServiceHourRowKeys(
    source.map((hour) => ({
      weekday: hour.weekday,
      start_time: hour.start_time,
      end_time: hour.end_time,
    }))
  );
  if (currentKeys.length !== sourceKeys.length) return false;
  return currentKeys.every((key, index) => key === sourceKeys[index]);
}

export function currentServiceHoursMatchSource(
  entries: ServiceHourEntry[],
  source: readonly LocationAreaServiceHour[]
): boolean {
  return serviceHoursSetsEqual(
    buildServiceHourPayloadFromEntries(entries),
    source
  );
}

function shiftTemplateSignature(template: AreaShiftTemplateWithBreaks): string {
  const breaks = [...(template.area_shift_template_breaks ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (entry) =>
        `${normalizeServiceHourTimeComparable(entry.break_start)}-${normalizeServiceHourTimeComparable(entry.break_end)}`
    )
    .join(",");
  return [
    template.name.trim(),
    normalizeServiceHourTimeComparable(template.start_time),
    normalizeServiceHourTimeComparable(template.end_time),
    template.color,
    breaks,
  ].join("|");
}

export function areaShiftTemplatesSetsEqual(
  current: readonly AreaShiftTemplateWithBreaks[],
  source: readonly AreaShiftTemplateWithBreaks[]
): boolean {
  const currentSignatures = [...current]
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
    )
    .map(shiftTemplateSignature);
  const sourceSignatures = [...source]
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
    )
    .map(shiftTemplateSignature);
  if (currentSignatures.length !== sourceSignatures.length) return false;
  return currentSignatures.every(
    (signature, index) => signature === sourceSignatures[index]
  );
}

type StaffingWindowRow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

function staffingWindowKey(row: StaffingWindowRow): string {
  return `${row.weekday}|${normalizeServiceHourTimeComparable(row.start_time)}|${normalizeServiceHourTimeComparable(row.end_time)}`;
}

function buildStaffingSignatureKeys(
  serviceHours: readonly LocationAreaServiceHour[],
  staffing: readonly LocationAreaStaffing[],
  allowedQualificationIds: ReadonlySet<string>
): string[] {
  const rulesByHour = new Map<string, LocationAreaStaffing[]>();
  for (const rule of staffing) {
    if (rule.required_count <= 0 || !allowedQualificationIds.has(rule.qualification_id)) {
      continue;
    }
    const list = rulesByHour.get(rule.service_hour_id) ?? [];
    list.push(rule);
    rulesByHour.set(rule.service_hour_id, list);
  }

  const keys: string[] = [];
  for (const hour of serviceHours) {
    const rules = rulesByHour.get(hour.id);
    if (!rules?.length) continue;
    const rulePart = rules
      .map((rule) => `${rule.qualification_id}:${rule.required_count}`)
      .sort()
      .join(",");
    keys.push(`${staffingWindowKey(hour)}|${rulePart}`);
  }
  return keys.sort();
}

export function locationAreaStaffingSetsEqual(
  targetHours: readonly LocationAreaServiceHour[],
  targetStaffing: readonly LocationAreaStaffing[],
  targetQualifications: readonly { id: string }[],
  sourceHours: readonly LocationAreaServiceHour[],
  sourceStaffing: readonly LocationAreaStaffing[]
): boolean {
  const allowedQualificationIds = new Set(targetQualifications.map((qual) => qual.id));
  const targetKeys = buildStaffingSignatureKeys(
    targetHours,
    targetStaffing,
    allowedQualificationIds
  );
  const sourceKeys = buildStaffingSignatureKeys(
    sourceHours,
    sourceStaffing,
    allowedQualificationIds
  );
  if (targetKeys.length !== sourceKeys.length) return false;
  return targetKeys.every((key, index) => key === sourceKeys[index]);
}
