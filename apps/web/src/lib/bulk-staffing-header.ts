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
  type StaffingConflictDetail,
  type StaffingHintDetail,
  type StaffingQualificationCoverage,
  type TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import {
  isTagAreaHeaderStaffingEntryPlannedCoverage,
  isTagAreaHeaderStaffingEntryUnderstaffed,
} from "@/lib/tag-area-header-staffing-display";
import {
  countsTowardStaffingConfirmation,
  countsTowardStaffingProjection,
} from "@/lib/staffing-shift-confirmation";
import type {
  LocationAreaStaffing,
  Qualification,
  ShiftConfirmationStatus,
} from "@schichtwerk/types";

export type StaffingAssignmentRef = {
  startTime: string;
  endTime: string;
  employeeId?: string;
  qualificationId?: string;
  confirmationStatus?: ShiftConfirmationStatus;
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
  confirmationStatus?: ShiftConfirmationStatus;
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
      confirmationStatus: shift.confirmationStatus,
    }));
}

function filterStaffingAssignments(
  assignments: readonly StaffingAssignmentRef[],
  mode: "confirmed" | "projected"
): StaffingAssignmentRef[] {
  const predicate =
    mode === "confirmed"
      ? countsTowardStaffingConfirmation
      : countsTowardStaffingProjection;
  return assignments.filter((assignment) =>
    predicate(assignment.confirmationStatus)
  );
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

/** Projizierte Besetzung je Fenster für Kopf-Summen — nicht über Bedarf hinaus zählen. */
export function entryProjectedAssignedForStaffingTotal(
  entry: Pick<
    TagAreaHeaderStaffingEntry,
    "assigned" | "projectedAssigned" | "required"
  >
): number {
  const projected = entry.projectedAssigned ?? entry.assigned;
  if (entry.required <= 0) return projected;
  return Math.min(projected, entry.required);
}

function projectedStaffingAssignmentIndexMap(
  assignments: readonly StaffingAssignmentRef[]
): {
  projectedAssignments: StaffingAssignmentRef[];
  projectedToOriginalIndex: readonly number[];
} {
  const projectedAssignments: StaffingAssignmentRef[] = [];
  const projectedToOriginalIndex: number[] = [];

  assignments.forEach((assignment, index) => {
    if (!countsTowardStaffingProjection(assignment.confirmationStatus)) return;
    projectedAssignments.push(assignment);
    projectedToOriginalIndex.push(index);
  });

  return { projectedAssignments, projectedToOriginalIndex };
}

/**
 * Schicht-Indizes pro Tag für Footer-Kennzahlen (Schichten/Stunden/Kosten).
 * Pro Bedarf-Fenster höchstens `required` zugeordnete Schichten — wie Tabellenzeilen Früh/Spät.
 */
export function collectStaffingFooterScopedAssignmentIndicesForDay(
  dateISO: string,
  areaId: string,
  assignments: readonly StaffingAssignmentRef[],
  staffingRules: readonly LocationAreaStaffing[],
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly AreaCalendarAssignmentPreset[],
  areaOpenOnDate: boolean
): readonly number[] {
  if (assignments.length === 0) return [];
  if (!areaOpenOnDate) {
    return assignments.map((_, index) => index);
  }

  const baseEntries = tagAreaHeaderStaffingEntries(
    [...staffingRules],
    areaId,
    dateISO,
    serviceHours,
    [...assignments]
  );
  const demandWindows = buildDemandWindowsForAreaDay(
    baseEntries,
    serviceHours,
    assignmentPresets,
    staffingRules,
    areaId
  );
  const { projectedAssignments, projectedToOriginalIndex } =
    projectedStaffingAssignmentIndexMap(assignments);
  const projectedAllocation = allocateAssignmentsToDemandWindows(
    projectedAssignments,
    demandWindows
  );

  const selected = new Set<number>();
  for (const entry of baseEntries) {
    const allocatedProjectedIndices =
      projectedAllocation.get(entry.serviceHourId) ?? [];
    const cap = Math.max(0, entry.required);
    for (let index = 0; index < Math.min(cap, allocatedProjectedIndices.length); index++) {
      const originalIndex =
        projectedToOriginalIndex[allocatedProjectedIndices[index]!];
      if (originalIndex != null) selected.add(originalIndex);
    }
  }

  return [...selected].sort((left, right) => left - right);
}

/** Schichten, deren Zeiten exakt einem Bedarf-Fenster entsprechen (wie Tabellenzeilen Früh/Spät). */
export function countPlanningShiftsMatchingDemandWindows(
  dates: readonly string[],
  areaId: string,
  shifts: readonly PlanningStaffingShiftRef[],
  staffingRulesForDate: (dateISO: string) => readonly LocationAreaStaffing[],
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly AreaCalendarAssignmentPreset[]
): number {
  let count = 0;

  for (const dateISO of dates) {
    const rulesForDay = staffingRulesForDate(dateISO);
    const baseEntries = tagAreaHeaderStaffingEntries(
      [...rulesForDay],
      areaId,
      dateISO,
      serviceHours,
      []
    );
    const demandWindows = buildDemandWindowsForAreaDay(
      baseEntries,
      serviceHours,
      assignmentPresets,
      rulesForDay,
      areaId
    );

    for (const shift of shifts) {
      if (shift.shift_date !== dateISO) continue;
      const matchesDemand = demandWindows.some(
        (demand) =>
          areaCalendarTimeKey(shift.startTime) ===
            areaCalendarTimeKey(demand.startTime) &&
          areaCalendarTimeKey(shift.endTime) === areaCalendarTimeKey(demand.endTime)
      );
      if (matchesDemand) count += 1;
    }
  }

  return count;
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
    let bestScore = -Infinity;
    for (const rule of qualRules) {
      if (!employeeQuals.has(rule.qualification_id)) continue;
      const required = normalizeRequiredCount(rule.required_count);
      const assigned = assignedByQual.get(rule.qualification_id) ?? 0;
      const score =
        required > 0
          ? assigned < required
            ? (required - assigned) * 10_000 + required
            : required * 100 - assigned
          : 0;
      if (score > bestScore) {
        bestScore = score;
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

function formatAssignmentTimeLabel(
  assignment: StaffingAssignmentRef,
  formatCalendarTimeLabel?: (startTime: string, endTime: string) => string
): string {
  if (formatCalendarTimeLabel) {
    return formatCalendarTimeLabel(assignment.startTime, assignment.endTime);
  }
  return `${assignment.startTime}–${assignment.endTime}`;
}

function resolveStaffingEmployeeName(
  employeeId: string | undefined,
  employeeNameById: ReadonlyMap<string, string> | undefined
): string {
  const id = employeeId?.trim();
  if (!id) return "—";
  return employeeNameById?.get(id) ?? id;
}

function qualificationLabel(
  qualificationId: string,
  qualificationNameById: ReadonlyMap<string, string>
): string {
  return qualificationNameById.get(qualificationId) ?? qualificationId;
}

/** Konkrete Konflikte und Hinweise je Schicht für Kalender-Tooltip-Fußnote. */
export function buildStaffingAssignmentDetails(input: {
  hourAssignments: readonly StaffingAssignmentRef[];
  qualRules: readonly LocationAreaStaffing[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  qualificationNameById: ReadonlyMap<string, string>;
  employeeNameById?: ReadonlyMap<string, string>;
  formatCalendarTimeLabel?: (startTime: string, endTime: string) => string;
  totalRequired: number;
}): {
  conflicts: StaffingConflictDetail[];
  hints: StaffingHintDetail[];
} {
  const {
    hourAssignments,
    qualRules,
    profileQualificationIds,
    qualificationNameById,
    employeeNameById,
    formatCalendarTimeLabel,
    totalRequired,
  } = input;

  if (hourAssignments.length === 0) {
    return { conflicts: [], hints: [] };
  }

  if (qualRules.length === 0) {
    if (hourAssignments.length <= totalRequired) {
      return { conflicts: [], hints: [] };
    }
    return {
      conflicts: [],
      hints: hourAssignments.slice(totalRequired).map((assignment) => ({
        kind: "overstaffed" as const,
        employeeName: resolveStaffingEmployeeName(
          assignment.employeeId,
          employeeNameById
        ),
        timeLabel: formatAssignmentTimeLabel(
          assignment,
          formatCalendarTimeLabel
        ),
      })),
    };
  }

  const mapping = mapAssignmentQualificationIds(
    hourAssignments,
    qualRules,
    profileQualificationIds
  );
  const assignedByQual = countQualificationCoverage(
    hourAssignments,
    qualRules,
    profileQualificationIds
  );
  const requiredByQual = new Map(
    qualRules.map((rule) => [
      rule.qualification_id,
      normalizeRequiredCount(rule.required_count),
    ])
  );
  const understaffedQualIds = qualRules
    .filter(
      (rule) =>
        (assignedByQual.get(rule.qualification_id) ?? 0) <
        normalizeRequiredCount(rule.required_count)
    )
    .map((rule) => rule.qualification_id);

  const indicesByQual = new Map<string, number[]>();
  for (const [index, qualId] of mapping) {
    const bucket = indicesByQual.get(qualId);
    if (bucket) {
      bucket.push(index);
    } else {
      indicesByQual.set(qualId, [index]);
    }
  }

  const conflicts: StaffingConflictDetail[] = [];
  const hints: StaffingHintDetail[] = [];
  const surplusIndices = new Set<number>();

  for (const [qualId, indices] of indicesByQual) {
    const required = requiredByQual.get(qualId) ?? 0;
    if (indices.length <= required) continue;
    for (const index of indices.slice(required)) {
      surplusIndices.add(index);
      const assignment = hourAssignments[index]!;
      hints.push({
        kind: "overstaffed",
        employeeName: resolveStaffingEmployeeName(
          assignment.employeeId,
          employeeNameById
        ),
        timeLabel: formatAssignmentTimeLabel(
          assignment,
          formatCalendarTimeLabel
        ),
        assignedQualificationName: qualificationLabel(
          qualId,
          qualificationNameById
        ),
      });
    }
  }

  for (let index = 0; index < hourAssignments.length; index++) {
    if (mapping.has(index) || surplusIndices.has(index)) continue;
    const assignment = hourAssignments[index]!;
    const employeeId = assignment.employeeId?.trim();
    conflicts.push({
      kind: "no_matching_qualification",
      employeeName: resolveStaffingEmployeeName(
        assignment.employeeId,
        employeeNameById
      ),
      timeLabel: formatAssignmentTimeLabel(
        assignment,
        formatCalendarTimeLabel
      ),
      missingQualificationName:
        employeeId &&
        requiredQualificationNamesMissingForEmployee(
          employeeId,
          qualRules,
          profileQualificationIds,
          qualificationNameById
        ),
    });
  }

  if (hourAssignments.length >= totalRequired) {
    for (const [index, qualId] of mapping) {
      if (surplusIndices.has(index)) continue;
      const assignment = hourAssignments[index]!;
      const employeeId = assignment.employeeId?.trim();
      if (!employeeId) continue;

      const employeeQuals = profileQualificationIds.get(employeeId);
      if (!employeeQuals?.has(qualId)) {
        conflicts.push({
          kind: "qualification_mismatch",
          employeeName: resolveStaffingEmployeeName(
            assignment.employeeId,
            employeeNameById
          ),
          timeLabel: formatAssignmentTimeLabel(
            assignment,
            formatCalendarTimeLabel
          ),
          assignedQualificationName: qualificationLabel(
            qualId,
            qualificationNameById
          ),
          missingQualificationName: qualificationLabel(
            qualId,
            qualificationNameById
          ),
        });
        continue;
      }

      const couldFillUnderstaffedQualIds = understaffedQualIds.filter(
        (missingQualId) =>
          missingQualId !== qualId && employeeQuals.has(missingQualId)
      );
      if (couldFillUnderstaffedQualIds.length === 0) continue;

      conflicts.push({
        kind: "qualification_mismatch",
        employeeName: resolveStaffingEmployeeName(
          assignment.employeeId,
          employeeNameById
        ),
        timeLabel: formatAssignmentTimeLabel(
          assignment,
          formatCalendarTimeLabel
        ),
        assignedQualificationName: qualificationLabel(
          qualId,
          qualificationNameById
        ),
        missingQualificationName: couldFillUnderstaffedQualIds
          .map((missingQualId) =>
            qualificationLabel(missingQualId, qualificationNameById)
          )
          .join(", "),
      });
    }
  }

  return { conflicts, hints };
}

/** @deprecated Nur für Tests — nutze {@link buildStaffingAssignmentDetails}. */
export function buildStaffingConflictDetails(
  input: Parameters<typeof buildStaffingAssignmentDetails>[0]
): Array<StaffingConflictDetail | StaffingHintDetail> {
  const { conflicts, hints } = buildStaffingAssignmentDetails(input);
  return [...conflicts, ...hints];
}

function requiredQualificationNamesMissingForEmployee(
  employeeId: string,
  qualRules: readonly LocationAreaStaffing[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  qualificationNameById: ReadonlyMap<string, string>
): string | undefined {
  const employeeQuals = profileQualificationIds.get(employeeId);
  const missing = qualRules
    .filter((rule) => normalizeRequiredCount(rule.required_count) > 0)
    .map((rule) => rule.qualification_id)
    .filter((qualId) => !employeeQuals?.has(qualId))
    .map((qualId) => qualificationLabel(qualId, qualificationNameById));
  return missing.length > 0 ? missing.join(", ") : undefined;
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
  employeeNameById?: ReadonlyMap<string, string>;
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
    employeeNameById,
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
  const confirmedAssignments = filterStaffingAssignments(
    assignments,
    "confirmed"
  );
  const projectedAssignments = filterStaffingAssignments(
    assignments,
    "projected"
  );
  const confirmedAllocation = allocateAssignmentsToDemandWindows(
    confirmedAssignments,
    demandWindows
  );
  const projectedAllocation = allocateAssignmentsToDemandWindows(
    projectedAssignments,
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
    const confirmedHourAssignments = (
      confirmedAllocation.get(entry.serviceHourId) ?? []
    ).map((index) => confirmedAssignments[index]!);
    const projectedHourAssignments = (
      projectedAllocation.get(entry.serviceHourId) ?? []
    ).map((index) => projectedAssignments[index]!);

    return {
      ...entry,
      assigned: confirmedHourAssignments.length,
      projectedAssigned: projectedHourAssignments.length,
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
        confirmedHourAssignments,
        qualRules,
        profileQualificationIds,
        qualificationNameById,
        qualificationSortOrder
      ),
      projectedQualifications: buildStaffingQualificationBreakdown(
        projectedHourAssignments,
        qualRules,
        profileQualificationIds,
        qualificationNameById,
        qualificationSortOrder
      ),
      ...(() => {
        const { conflicts, hints } = buildStaffingAssignmentDetails({
          hourAssignments: confirmedHourAssignments,
          qualRules,
          profileQualificationIds,
          qualificationNameById,
          employeeNameById,
          formatCalendarTimeLabel,
          totalRequired: entry.required,
        });
        return {
          conflictDetails: conflicts.length > 0 ? conflicts : undefined,
          hintDetails: hints.length > 0 ? hints : undefined,
        };
      })(),
    };
  });
}

export type StaffingTooltipSection = {
  periodLine: string;
  coverageLines: string[];
};

export type StaffingTooltipCoverageFormatter = {
  confirmed: (
    assigned: number,
    required: number,
    name: string,
    shiftTime: string
  ) => string;
  unconfirmed: (
    assigned: number,
    required: number,
    name: string,
    shiftTime: string
  ) => string;
  vacant: (
    count: number,
    required: number,
    name: string,
    shiftTime: string
  ) => string;
  totalConfirmed: (assigned: number, required: number, shiftTime: string) => string;
  totalUnconfirmed: (
    assigned: number,
    required: number,
    shiftTime: string
  ) => string;
  totalPlanned?: (
    assigned: number,
    required: number,
    shiftTime: string
  ) => string;
  totalVacant: (count: number, required: number, shiftTime: string) => string;
  planned?: (
    assigned: number,
    required: number,
    name: string,
    shiftTime: string
  ) => string;
};

type StaffingTooltipQualRow = {
  name: string;
  required: number;
  confirmed: number;
  projected: number;
};

function mergeQualificationRowsForTooltip(
  entry: TagAreaHeaderStaffingEntry
): StaffingTooltipQualRow[] {
  const confirmedById = new Map(
    (entry.qualifications ?? []).map((qualification) => [
      qualification.qualificationId,
      qualification.assigned,
    ])
  );
  const projectedById = new Map(
    (entry.projectedQualifications ?? entry.qualifications ?? []).map(
      (qualification) => [qualification.qualificationId, qualification.assigned]
    )
  );
  const source =
    entry.projectedQualifications ?? entry.qualifications ?? [];

  return source
    .filter((qualification) => qualification.required > 0)
    .map((qualification) => ({
      name: qualification.name,
      required: qualification.required,
      confirmed: confirmedById.get(qualification.qualificationId) ?? 0,
      projected:
        projectedById.get(qualification.qualificationId) ??
        confirmedById.get(qualification.qualificationId) ??
        0,
    }));
}

function appendQualCoverageLines(
  lines: string[],
  row: StaffingTooltipQualRow,
  format: StaffingTooltipCoverageFormatter,
  options: { understaffed: boolean; planned: boolean }
): void {
  const unconfirmed = Math.max(0, row.projected - row.confirmed);
  const vacant = Math.max(0, row.required - row.projected);

  if (options.understaffed) {
    if (row.confirmed > 0) {
      lines.push(format.confirmed(row.confirmed, row.required, row.name, ""));
    }
    if (unconfirmed > 0) {
      lines.push(
        format.unconfirmed(unconfirmed, row.required, row.name, "")
      );
    }
    if (vacant > 0) {
      lines.push(format.vacant(vacant, row.required, row.name, ""));
    }
    if (
      row.confirmed === 0 &&
      unconfirmed === 0 &&
      vacant === 0 &&
      row.required > 0
    ) {
      lines.push(format.vacant(row.required, row.required, row.name, ""));
    }
    return;
  }

  if (options.planned) {
    if (row.confirmed > 0) {
      lines.push(format.confirmed(row.confirmed, row.required, row.name, ""));
    }
    if (unconfirmed > 0) {
      const plannedLine = format.planned ?? format.unconfirmed;
      lines.push(plannedLine(unconfirmed, row.required, row.name, ""));
    }
    return;
  }

  if (row.confirmed > 0 || row.required > 0) {
    lines.push(format.confirmed(row.confirmed, row.required, row.name, ""));
  }
}

function appendAggregateCoverageLines(
  lines: string[],
  entry: TagAreaHeaderStaffingEntry,
  format: StaffingTooltipCoverageFormatter,
  options: { understaffed: boolean; planned: boolean }
): void {
  const confirmed = entry.assigned;
  const projected = entry.projectedAssigned ?? entry.assigned;
  const required = entry.required;
  const unconfirmed = Math.max(0, projected - confirmed);
  const vacant = Math.max(0, required - projected);

  if (options.understaffed) {
    if (confirmed > 0) {
      lines.push(format.totalConfirmed(confirmed, required, ""));
    }
    if (unconfirmed > 0) {
      lines.push(format.totalUnconfirmed(unconfirmed, required, ""));
    }
    if (vacant > 0) {
      lines.push(format.totalVacant(vacant, required, ""));
    }
    if (confirmed === 0 && unconfirmed === 0 && vacant === 0 && required > 0) {
      lines.push(format.totalVacant(required, required, ""));
    }
    return;
  }

  if (options.planned) {
    if (confirmed > 0) {
      lines.push(format.totalConfirmed(confirmed, required, ""));
    }
    if (unconfirmed > 0) {
      const plannedLine = format.totalPlanned ?? format.totalUnconfirmed;
      lines.push(plannedLine(unconfirmed, required, ""));
    }
    return;
  }

  lines.push(format.totalConfirmed(confirmed, required, ""));
}

export function buildStaffingEntryTooltipCoverageLines(
  entry: TagAreaHeaderStaffingEntry,
  format: StaffingTooltipCoverageFormatter
): string[] {
  const understaffed = isTagAreaHeaderStaffingEntryUnderstaffed(entry);
  const planned = isTagAreaHeaderStaffingEntryPlannedCoverage(entry);
  const options = { understaffed, planned };
  const qualRows = mergeQualificationRowsForTooltip(entry);
  const lines: string[] = [];

  if (qualRows.length > 0) {
    for (const row of qualRows) {
      appendQualCoverageLines(lines, row, format, options);
    }
    return lines;
  }

  appendAggregateCoverageLines(lines, entry, format, options);
  return lines;
}

export function formatStaffingEntryTooltipSection(
  entry: TagAreaHeaderStaffingEntry,
  format: StaffingTooltipCoverageFormatter
): StaffingTooltipSection {
  const timeLabel = entry.calendarTimeLabel ?? entry.timeLabel ?? entry.label;
  const periodLine = entry.shiftTemplateLabel
    ? `${entry.shiftTemplateLabel}, ${timeLabel}`
    : timeLabel;
  return {
    periodLine,
    coverageLines: buildStaffingEntryTooltipCoverageLines(entry, format),
  };
}

export function formatStaffingEntriesTooltipSections(
  entries: readonly TagAreaHeaderStaffingEntry[],
  format: StaffingTooltipCoverageFormatter
): StaffingTooltipSection[] {
  return entries.map((entry) =>
    formatStaffingEntryTooltipSection(entry, format)
  );
}

export type StaffingAssignmentTooltipBlock = {
  titleLine: string;
  descriptionLine: string;
  /** Zusätzliche Zeile (z. B. Hinweistext bei Überbesetzung im Füllstands-Tooltip). */
  noteLine?: string;
};

type StaffingAssignmentTooltipTranslator = (
  key: string,
  params: Record<string, string>
) => string;

function formatStaffingConflictTooltipBlock(
  detail: StaffingConflictDetail,
  t: StaffingAssignmentTooltipTranslator
): StaffingAssignmentTooltipBlock {
  switch (detail.kind) {
    case "qualification_mismatch":
      return {
        titleLine: t("areaCalendar.staffingTooltipConflictMismatchTitle", {}),
        descriptionLine: t(
          "areaCalendar.staffingTooltipConflictMismatchDescription",
          {
            time: detail.timeLabel,
            name: detail.employeeName,
            position: detail.assignedQualificationName ?? "—",
            missing: detail.missingQualificationName ?? "—",
          }
        ),
      };
    case "no_matching_qualification":
      return {
        titleLine: t("areaCalendar.staffingTooltipConflictNoQualTitle", {}),
        descriptionLine: t(
          "areaCalendar.staffingTooltipConflictNoQualDescription",
          {
            time: detail.timeLabel,
            name: detail.employeeName,
            missing: detail.missingQualificationName ?? "—",
          }
        ),
      };
  }
}

function formatStaffingHintTooltipBlock(
  detail: StaffingHintDetail,
  t: StaffingAssignmentTooltipTranslator
): StaffingAssignmentTooltipBlock {
  return {
    titleLine: t("areaCalendar.staffingTooltipHintOverstaffedTitle", {}),
    descriptionLine: t("areaCalendar.staffingTooltipHintOverstaffedDescription", {
      time: detail.timeLabel,
      name: detail.employeeName,
      position: detail.assignedQualificationName ?? "—",
    }),
    noteLine: t("areaCalendar.staffingTooltipHintOverstaffedNote", {}),
  };
}

export function formatStaffingAssignmentTooltipBlocks(
  entries: readonly TagAreaHeaderStaffingEntry[],
  t: StaffingAssignmentTooltipTranslator
): {
  conflicts: StaffingAssignmentTooltipBlock[];
  hints: StaffingAssignmentTooltipBlock[];
} {
  const conflicts: StaffingAssignmentTooltipBlock[] = [];
  const hints: StaffingAssignmentTooltipBlock[] = [];

  for (const entry of entries) {
    for (const detail of entry.conflictDetails ?? []) {
      conflicts.push(formatStaffingConflictTooltipBlock(detail, t));
    }
    for (const detail of entry.hintDetails ?? []) {
      hints.push(formatStaffingHintTooltipBlock(detail, t));
    }
  }

  return { conflicts, hints };
}

/** @deprecated Nutze {@link formatStaffingAssignmentTooltipBlocks}. */
export function formatStaffingConflictTooltipLines(
  entries: readonly TagAreaHeaderStaffingEntry[],
  t: StaffingAssignmentTooltipTranslator
): string[] {
  const { conflicts, hints } = formatStaffingAssignmentTooltipBlocks(entries, t);
  return [...conflicts, ...hints].flatMap((block) => [
    block.titleLine,
    block.descriptionLine,
    ...(block.noteLine ? [block.noteLine] : []),
  ]);
}
