import { areAreaCalendarShiftTimesComplete } from "@/lib/available-employees-for-shift";
import {
  formatPlanningHoursRatio,
  planningHoursUnitLabel,
  type PlanningShiftRef,
} from "@/lib/planning-utils";
import { resolveProfileWeeklyHoursTarget, timeToMinutes } from "@schichtwerk/database";

export type WeeklyHoursLocationShiftRef = PlanningShiftRef & {
  location_id?: string | null;
  location_area_id?: string | null;
};

export type EmployeeWeeklyHoursLocationLine = {
  locationId: string;
  locationName: string;
  assignedHours: number;
  targetHours: number;
};

export type EmployeeWeeklyHoursDisplay = {
  lines: EmployeeWeeklyHoursLocationLine[];
  showTotalLine: boolean;
  totalHours: number;
  targetHours: number;
};

function shiftAssignDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime.slice(0, 5));
  let end = timeToMinutes(endTime.slice(0, 5));
  if (end <= start) end += 24 * 60;
  return end - start;
}

function roundPlanningHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export function resolveWeeklyHoursShiftLocationId(
  shift: WeeklyHoursLocationShiftRef,
  areaIdToLocationId?: ReadonlyMap<string, string>,
  fallbackLocationId?: string | null
): string | null {
  if (shift.location_id) return shift.location_id;
  if (shift.location_area_id && areaIdToLocationId) {
    return areaIdToLocationId.get(shift.location_area_id) ?? null;
  }
  return fallbackLocationId ?? null;
}

export function weeklyAssignedMinutesByEmployeeIdAndLocation(
  shifts: readonly WeeklyHoursLocationShiftRef[],
  weekDates: readonly string[],
  resolveLocationId: (shift: WeeklyHoursLocationShiftRef) => string | null
): Map<string, Map<string, number>> {
  const weekDateSet = new Set(weekDates);
  const totals = new Map<string, Map<string, number>>();

  for (const shift of shifts) {
    if (!weekDateSet.has(shift.shift_date)) continue;
    if (!areAreaCalendarShiftTimesComplete(shift.startTime, shift.endTime)) {
      continue;
    }

    const locationId = resolveLocationId(shift);
    if (!locationId) continue;

    const minutes = shiftAssignDurationMinutes(shift.startTime, shift.endTime);
    const byLocation = totals.get(shift.employee_id) ?? new Map<string, number>();
    byLocation.set(locationId, (byLocation.get(locationId) ?? 0) + minutes);
    totals.set(shift.employee_id, byLocation);
  }

  return totals;
}

export function buildEmployeeWeeklyHoursDisplay(input: {
  employeeId: string;
  shifts: readonly WeeklyHoursLocationShiftRef[];
  weekDates: readonly string[];
  targetHours: number;
  locationNameById: ReadonlyMap<string, string>;
  areaIdToLocationId?: ReadonlyMap<string, string>;
  fallbackLocationId?: string | null;
}): EmployeeWeeklyHoursDisplay {
  const minutesByLocation = weeklyAssignedMinutesByEmployeeIdAndLocation(
    input.shifts,
    input.weekDates,
    (shift) =>
      resolveWeeklyHoursShiftLocationId(
        shift,
        input.areaIdToLocationId,
        input.fallbackLocationId
      )
  ).get(input.employeeId);

  const lines: EmployeeWeeklyHoursLocationLine[] = [];
  let totalMinutes = 0;

  for (const [locationId, minutes] of minutesByLocation ?? []) {
    totalMinutes += minutes;
    lines.push({
      locationId,
      locationName: input.locationNameById.get(locationId) ?? "—",
      assignedHours: roundPlanningHours(minutes / 60),
      targetHours: input.targetHours,
    });
  }

  lines.sort((left, right) =>
    left.locationName.localeCompare(right.locationName, undefined, {
      sensitivity: "base",
    })
  );

  return {
    lines,
    showTotalLine: lines.length >= 2,
    totalHours: roundPlanningHours(totalMinutes / 60),
    targetHours: input.targetHours,
  };
}

export function formatEmployeeWeeklyHoursCardLabel(
  display: EmployeeWeeklyHoursDisplay,
  locale: string
): string {
  const tooltipLocale = locale.startsWith("de") ? "de" : "en";
  return formatPlanningHoursRatio(
    display.totalHours,
    display.targetHours,
    tooltipLocale
  );
}

function formatPlanningHoursAmount(hours: number, locale: string): string {
  return `${hours} ${planningHoursUnitLabel(locale)}`;
}

/** Tooltip: pro Standort nur Stunden; bei mehreren Standorten zusätzlich Summe gesamt/max. */
export function formatEmployeeWeeklyHoursDisplayLines(
  display: EmployeeWeeklyHoursDisplay,
  locale: string,
  totalLabel: string
): string[] {
  const tooltipLocale = locale.startsWith("de") ? "de" : "en";
  const lines = display.lines.map(
    (line) =>
      `${line.locationName}, ${formatPlanningHoursAmount(
        line.assignedHours,
        tooltipLocale
      )}`
  );

  if (display.showTotalLine) {
    lines.push(
      `${totalLabel} ${formatPlanningHoursRatio(
        display.totalHours,
        display.targetHours,
        tooltipLocale
      )}`
    );
  }

  return lines;
}

export function buildEmployeeWeeklyHoursCardLabelsByEmployeeId(input: {
  employees: readonly { id: string; weekly_hours?: number | null }[];
  shifts: readonly WeeklyHoursLocationShiftRef[];
  weekDates: readonly string[];
  locale: string;
  locationNameById: ReadonlyMap<string, string>;
  areaIdToLocationId?: ReadonlyMap<string, string>;
  fallbackLocationId?: string | null;
}): Map<string, string> {
  const labels = new Map<string, string>();

  for (const employee of input.employees) {
    const targetHours = resolveProfileWeeklyHoursTarget(
      employee.weekly_hours ?? null
    );
    const display = buildEmployeeWeeklyHoursDisplay({
      employeeId: employee.id,
      shifts: input.shifts,
      weekDates: input.weekDates,
      targetHours,
      locationNameById: input.locationNameById,
      areaIdToLocationId: input.areaIdToLocationId,
      fallbackLocationId: input.fallbackLocationId,
    });
    labels.set(
      employee.id,
      formatEmployeeWeeklyHoursCardLabel(display, input.locale)
    );
  }

  return labels;
}

export function employeeWeeklyHoursAssignedMinutes(
  display: EmployeeWeeklyHoursDisplay
): number {
  return Math.round(display.totalHours * 60);
}

export function buildEmployeeWeeklyHoursDisplayByEmployeeId(input: {
  employees: readonly { id: string; weekly_hours?: number | null }[];
  shifts: readonly WeeklyHoursLocationShiftRef[];
  weekDates: readonly string[];
  locationNameById: ReadonlyMap<string, string>;
  areaIdToLocationId?: ReadonlyMap<string, string>;
  fallbackLocationId?: string | null;
}): Map<string, EmployeeWeeklyHoursDisplay> {
  const displays = new Map<string, EmployeeWeeklyHoursDisplay>();

  for (const employee of input.employees) {
    const targetHours = resolveProfileWeeklyHoursTarget(
      employee.weekly_hours ?? null
    );
    displays.set(
      employee.id,
      buildEmployeeWeeklyHoursDisplay({
        employeeId: employee.id,
        shifts: input.shifts,
        weekDates: input.weekDates,
        targetHours,
        locationNameById: input.locationNameById,
        areaIdToLocationId: input.areaIdToLocationId,
        fallbackLocationId: input.fallbackLocationId,
      })
    );
  }

  return displays;
}

export function buildEmployeeWeeklyHoursDisplayLinesByEmployeeId(input: {
  employees: readonly { id: string; weekly_hours?: number | null }[];
  shifts: readonly WeeklyHoursLocationShiftRef[];
  weekDates: readonly string[];
  locale: string;
  locationNameById: ReadonlyMap<string, string>;
  totalLabel: string;
  areaIdToLocationId?: ReadonlyMap<string, string>;
  fallbackLocationId?: string | null;
}): Map<string, string[]> {
  const labels = new Map<string, string[]>();
  const displays = buildEmployeeWeeklyHoursDisplayByEmployeeId(input);

  for (const employee of input.employees) {
    const display = displays.get(employee.id);
    if (!display) continue;
    labels.set(
      employee.id,
      formatEmployeeWeeklyHoursDisplayLines(display, input.locale, input.totalLabel)
    );
  }

  return labels;
}

export function buildAreaIdToLocationIdMap(
  areas: readonly { id: string; location_id: string }[]
): Map<string, string> {
  return new Map(areas.map((area) => [area.id, area.location_id]));
}

export function buildLocationNameByIdMap(
  locations: readonly { id: string; name: string }[]
): Map<string, string> {
  return new Map(locations.map((location) => [location.id, location.name]));
}

export function longestEmployeeWeeklyHoursDisplayLine(
  linesByEmployeeId: ReadonlyMap<string, readonly string[]>
): string {
  let longest = "";
  for (const lines of linesByEmployeeId.values()) {
    for (const line of lines) {
      if (line.length > longest.length) longest = line;
    }
  }
  return longest;
}
