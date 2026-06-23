import {
  shiftTemplateLabelForDemandTimes,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import {
  availabilityRangeContainedInWindow,
  areaCalendarTimeKey,
} from "@/lib/available-employees-for-shift";
import { personalbedarfDemandTimesForEntry } from "@/lib/bulk-shift-staffing";
import {
  serviceWeekdayForDate,
  tagAreaHeaderStaffingEntries,
  type AreaServiceHourRef,
  type StaffingQualificationCoverage,
  type TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";

export type StaffingAssignmentRef = {
  startTime: string;
  endTime: string;
  employeeId?: string;
  qualificationId?: string;
};

export type DemandWindowRef = {
  serviceHourId: string;
  startTime: string;
  endTime: string;
};

function normalizeRequiredCount(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function qualificationRulesForServiceHour(
  rules: readonly LocationAreaStaffing[],
  areaId: string,
  serviceHourId: string
): LocationAreaStaffing[] {
  return rules.filter(
    (rule) =>
      rule.location_area_id === areaId &&
      rule.service_hour_id === serviceHourId &&
      normalizeRequiredCount(rule.required_count) > 0
  );
}

function parseShiftTimeToMinutes(value: string): number | null {
  const trimmed = value.trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizeMinuteRange(
  startTime: string,
  endTime: string
): { start: number; end: number } | null {
  const start = parseShiftTimeToMinutes(startTime);
  let end = parseShiftTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/** Echte Zeitüberlappung in Minuten — ohne „Bedarf liegt in breiter Schicht“. */
export function shiftClockRangesOverlapMinutes(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): number {
  const a = normalizeMinuteRange(startA, endA);
  const b = normalizeMinuteRange(startB, endB);
  if (!a || !b) return 0;
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function shiftFitsInDemandWindow(
  assignmentStart: string,
  assignmentEnd: string,
  demandStart: string,
  demandEnd: string
): boolean {
  return availabilityRangeContainedInWindow(
    assignmentStart,
    assignmentEnd,
    demandStart,
    demandEnd
  );
}

function demandWindowAssignmentScore(
  assignment: StaffingAssignmentRef,
  demand: DemandWindowRef
): number | null {
  const overlapMin = shiftClockRangesOverlapMinutes(
    assignment.startTime,
    assignment.endTime,
    demand.startTime,
    demand.endTime
  );
  if (overlapMin <= 0) return null;

  const fits = shiftFitsInDemandWindow(
    assignment.startTime,
    assignment.endTime,
    demand.startTime,
    demand.endTime
  );
  const exactMatch =
    areaCalendarTimeKey(assignment.startTime) ===
      areaCalendarTimeKey(demand.startTime) &&
    areaCalendarTimeKey(assignment.endTime) === areaCalendarTimeKey(demand.endTime);

  return (exactMatch ? 2_000_000 : 0) + (fits ? 1_000_000 : 0) + overlapMin;
}

/**
 * Ordnet jede Zuweisung höchstens einem Bedarf-Fenster zu (beste Übereinstimmung).
 * Zuweisungen haben Vorrang — breite Schichten werden nicht doppelt gezählt.
 */
export function allocateAssignmentsToDemandWindows(
  assignments: readonly StaffingAssignmentRef[],
  demandWindows: readonly DemandWindowRef[]
): Map<string, number[]> {
  const byHour = new Map<string, number[]>();
  type ScoredPair = {
    assignmentIndex: number;
    serviceHourId: string;
    score: number;
  };
  const pairs: ScoredPair[] = [];

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i]!;
    for (const demand of demandWindows) {
      const score = demandWindowAssignmentScore(assignment, demand);
      if (score == null) continue;
      pairs.push({
        assignmentIndex: i,
        serviceHourId: demand.serviceHourId,
        score,
      });
    }
  }

  pairs.sort(
    (a, b) =>
      b.score - a.score ||
      a.assignmentIndex - b.assignmentIndex ||
      a.serviceHourId.localeCompare(b.serviceHourId)
  );

  const usedAssignments = new Set<number>();
  for (const pair of pairs) {
    if (usedAssignments.has(pair.assignmentIndex)) continue;
    const list = byHour.get(pair.serviceHourId) ?? [];
    list.push(pair.assignmentIndex);
    byHour.set(pair.serviceHourId, list);
    usedAssignments.add(pair.assignmentIndex);
  }

  return byHour;
}

export function resolveBestDemandServiceHourForAssignment(
  startTime: string,
  endTime: string,
  demandWindows: readonly DemandWindowRef[]
): string | null {
  let best: { serviceHourId: string; score: number } | null = null;

  for (const demand of demandWindows) {
    const score = demandWindowAssignmentScore(
      { startTime, endTime },
      demand
    );
    if (score == null) continue;
    if (!best || score > best.score) {
      best = { serviceHourId: demand.serviceHourId, score };
    }
  }

  return best?.serviceHourId ?? null;
}

type PlanningStaffingShiftRef = {
  shift_date: string;
  location_area_id?: string | null;
  employee_id: string;
  startTime: string;
  endTime: string;
};

/** Schichten, die im Schichtplan-Kalender für Bereich/Tag sichtbar gezählt werden. */
export function staffingAssignmentsForPlanningAreaDay(
  shifts: readonly PlanningStaffingShiftRef[],
  dateISO: string,
  areaId: string,
  visibleEmployeeIds: ReadonlySet<string>
): StaffingAssignmentRef[] {
  return staffingAssignmentsForAreaDay(shifts, dateISO, areaId).filter(
    (assignment) =>
      assignment.employeeId != null &&
      visibleEmployeeIds.has(assignment.employeeId)
  );
}

/** Bereich für die Bedarfs-Headerzeile — URL, Bereichsliste oder Daten aus Schichten/Regeln. */
export function resolveStaffingHeaderAreaId(input: {
  selectedAreaId: string | null;
  areas: readonly { id: string }[];
  locationShifts: readonly { location_area_id: string | null }[];
  staffingRules: readonly { location_area_id: string }[];
  serviceHours: readonly { location_area_id?: string | null }[];
}): string | null {
  if (input.selectedAreaId) return input.selectedAreaId;
  if (input.areas[0]?.id) return input.areas[0].id;
  for (const shift of input.locationShifts) {
    if (shift.location_area_id) return shift.location_area_id;
  }
  for (const rule of input.staffingRules) {
    if (rule.location_area_id) return rule.location_area_id;
  }
  for (const hour of input.serviceHours) {
    if (hour.location_area_id) return hour.location_area_id;
  }
  return null;
}

/** Alle Schichten eines Bereichs/Tags für Personalbedarf-Zählung (wie Bereich-Kalender). */
export function staffingAssignmentsForAreaDay(
  shifts: readonly PlanningStaffingShiftRef[],
  dateISO: string,
  areaId: string
): StaffingAssignmentRef[] {
  return shifts
    .filter(
      (shift) =>
        shift.shift_date === dateISO && shift.location_area_id === areaId
    )
    .map((shift) => ({
      startTime: shift.startTime,
      endTime: shift.endTime,
      employeeId: shift.employee_id,
    }));
}

export function buildDemandWindowsForAreaDay(
  baseEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly AreaCalendarAssignmentPreset[],
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string
): DemandWindowRef[] {
  return baseEntries.flatMap((entry) => {
    const hour = serviceHours.find((item) => item.id === entry.serviceHourId);
    const demandTimes =
      personalbedarfDemandTimesForEntry(
        entry.serviceHourId,
        serviceHours,
        assignmentPresets,
        staffingRules,
        areaId
      ) ??
      (hour?.start_time && hour?.end_time
        ? {
            startTime: hour.start_time.slice(0, 5),
            endTime: hour.end_time.slice(0, 5),
            serviceHourId: entry.serviceHourId,
          }
        : null);
    if (!demandTimes) return [];
    return [
      {
        serviceHourId: entry.serviceHourId,
        startTime: demandTimes.startTime,
        endTime: demandTimes.endTime,
      },
    ];
  });
}

/** Ordnet jede Zuweisung genau einer Bedarf-Funktion zu (wie Personalbedarf-Zählung). */
export function mapAssignmentQualificationIds(
  hourAssignments: readonly StaffingAssignmentRef[],
  qualRules: readonly LocationAreaStaffing[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): Map<number, string> {
  const result = new Map<number, string>();
  const assignedByQual = new Map<string, number>();
  for (const rule of qualRules) {
    assignedByQual.set(rule.qualification_id, 0);
  }
  if (qualRules.length === 0) return result;

  const used = new Set<number>();

  hourAssignments.forEach((assignment, index) => {
    const qualId = assignment.qualificationId?.trim();
    if (!qualId || !assignedByQual.has(qualId)) return;
    assignedByQual.set(qualId, (assignedByQual.get(qualId) ?? 0) + 1);
    result.set(index, qualId);
    used.add(index);
  });

  hourAssignments.forEach((assignment, index) => {
    if (used.has(index)) return;
    const employeeId = assignment.employeeId?.trim();
    if (!employeeId) return;
    const employeeQuals = profileQualificationIds.get(employeeId);
    if (!employeeQuals?.size) return;

    let bestQualId: string | null = null;
    let bestGap = -Infinity;
    for (const rule of qualRules) {
      if (!employeeQuals.has(rule.qualification_id)) continue;
      const required = normalizeRequiredCount(rule.required_count);
      const assigned = assignedByQual.get(rule.qualification_id) ?? 0;
      if (assigned >= required) continue;
      const gap = required - assigned;
      if (gap > bestGap) {
        bestGap = gap;
        bestQualId = rule.qualification_id;
      }
    }

    if (bestQualId) {
      assignedByQual.set(
        bestQualId,
        (assignedByQual.get(bestQualId) ?? 0) + 1
      );
      result.set(index, bestQualId);
      used.add(index);
    }
  });

  return result;
}

/** Verteilt Schichten ohne Doppelzählung auf Funktions-Bedarfe (größtes Defizit zuerst). */
export function countQualificationCoverage(
  hourAssignments: readonly StaffingAssignmentRef[],
  qualRules: readonly LocationAreaStaffing[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, number> {
  const assignedByQual = new Map<string, number>();
  for (const rule of qualRules) {
    assignedByQual.set(rule.qualification_id, 0);
  }
  if (qualRules.length === 0) return assignedByQual;

  for (const qualId of mapAssignmentQualificationIds(
    hourAssignments,
    qualRules,
    profileQualificationIds
  ).values()) {
    assignedByQual.set(qualId, (assignedByQual.get(qualId) ?? 0) + 1);
  }

  return assignedByQual;
}

export function buildStaffingQualificationBreakdown(
  hourAssignments: readonly StaffingAssignmentRef[],
  qualRules: readonly LocationAreaStaffing[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  qualificationNameById: ReadonlyMap<string, string>,
  qualificationSortOrder: ReadonlyMap<string, number>
): StaffingQualificationCoverage[] {
  const assignedByQual = countQualificationCoverage(
    hourAssignments,
    qualRules,
    profileQualificationIds
  );

  return qualRules
    .slice()
    .sort(
      (a, b) =>
        (qualificationSortOrder.get(a.qualification_id) ?? 0) -
          (qualificationSortOrder.get(b.qualification_id) ?? 0) ||
        (qualificationNameById.get(a.qualification_id) ?? a.qualification_id).localeCompare(
          qualificationNameById.get(b.qualification_id) ?? b.qualification_id,
          "de"
        )
    )
    .map((rule) => ({
      qualificationId: rule.qualification_id,
      name:
        qualificationNameById.get(rule.qualification_id) ?? rule.qualification_id,
      assigned: assignedByQual.get(rule.qualification_id) ?? 0,
      required: normalizeRequiredCount(rule.required_count),
    }));
}

export function computeBulkStaffingHeaderEntries(input: {
  staffingRules: readonly LocationAreaStaffing[];
  areaId: string;
  dateISO: string;
  serviceHours: readonly AreaServiceHourRef[];
  assignments: readonly StaffingAssignmentRef[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  qualifications: readonly Qualification[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  formatTimeLabel: (weekdayLabel: string, startTime: string, endTime: string) => string;
  weekdayLabel: (weekday: number) => string;
  formatCalendarTimeLabel?: (startTime: string, endTime: string) => string;
}): TagAreaHeaderStaffingEntry[] {
  const {
    staffingRules,
    areaId,
    dateISO,
    serviceHours,
    assignments,
    assignmentPresets,
    qualifications,
    profileQualificationIds,
    formatTimeLabel,
    weekdayLabel,
    formatCalendarTimeLabel,
  } = input;

  const weekday = serviceWeekdayForDate(dateISO);
  const weekdayName = weekdayLabel(weekday);

  const qualificationNameById = new Map(
    qualifications.map((qualification) => [qualification.id, qualification.name])
  );
  const qualificationSortOrder = new Map(
    qualifications.map((qualification) => [qualification.id, qualification.sort_order])
  );

  const baseEntries = tagAreaHeaderStaffingEntries(
    [...staffingRules],
    areaId,
    dateISO,
    [...serviceHours],
    [...assignments]
  );

  const demandWindows = buildDemandWindowsForAreaDay(
    baseEntries,
    serviceHours,
    assignmentPresets,
    staffingRules,
    areaId
  );
  const allocation = allocateAssignmentsToDemandWindows(
    assignments,
    demandWindows
  );

  return baseEntries.map((entry) => {
    const hour = serviceHours.find((item) => item.id === entry.serviceHourId);
    const demandTimes =
      personalbedarfDemandTimesForEntry(
        entry.serviceHourId,
        serviceHours,
        assignmentPresets,
        staffingRules,
        areaId
      ) ??
      (hour?.start_time && hour?.end_time
        ? {
            startTime: hour.start_time.slice(0, 5),
            endTime: hour.end_time.slice(0, 5),
            serviceHourId: entry.serviceHourId,
          }
        : null);

    const qualRules = qualificationRulesForServiceHour(
      staffingRules,
      areaId,
      entry.serviceHourId
    );
    const hourAssignments = (allocation.get(entry.serviceHourId) ?? []).map(
      (index) => assignments[index]!
    );

    return {
      ...entry,
      assigned: hourAssignments.length,
      timeLabel: demandTimes
        ? formatTimeLabel(weekdayName, demandTimes.startTime, demandTimes.endTime)
        : entry.label,
      calendarTimeLabel: demandTimes
        ? formatCalendarTimeLabel?.(demandTimes.startTime, demandTimes.endTime)
        : undefined,
      shiftTemplateLabel: demandTimes
        ? shiftTemplateLabelForDemandTimes(
            demandTimes.startTime,
            demandTimes.endTime,
            assignmentPresets
          )
        : undefined,
      qualifications: buildStaffingQualificationBreakdown(
        hourAssignments,
        qualRules,
        profileQualificationIds,
        qualificationNameById,
        qualificationSortOrder
      ),
    };
  });
}

export function formatStaffingEntryTooltipContent(
  entry: TagAreaHeaderStaffingEntry,
  formatQualLine: (name: string, assigned: number, required: number) => string
): string {
  const timeHeader =
    entry.calendarTimeLabel ?? entry.timeLabel ?? entry.label;
  const headerLines = entry.shiftTemplateLabel
    ? [entry.shiftTemplateLabel, timeHeader]
    : [timeHeader];
  const qualLines = entry.qualifications
    ?.filter((qualification) => qualification.required > 0)
    .map((qualification) =>
      formatQualLine(
        qualification.name,
        qualification.assigned,
        qualification.required
      )
    );
  if (qualLines?.length) {
    return [...headerLines, ...qualLines].join("\n");
  }
  return [...headerLines, `${entry.assigned}/${entry.required}`].join("\n");
}

export function formatStaffingEntriesTooltipContent(
  entries: readonly TagAreaHeaderStaffingEntry[],
  formatQualLine: (name: string, assigned: number, required: number) => string
): string {
  return entries
    .map((entry) => formatStaffingEntryTooltipContent(entry, formatQualLine))
    .join("\n\n");
}
