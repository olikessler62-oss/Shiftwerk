import { isPastCalendarDate } from "@/lib/dates";
import {
  isAreaOpenOnDate,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";
import type { PlanningDayAssignBlockReason } from "@/lib/planning-day-assign-block-reason";

/** Kontextmenü / Linksklick: Servicezeit-Tag oder manuelle Einsätze ohne Servicezeit. */
export function canOpenAssignShiftContextMenu(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: readonly AreaServiceHourRef[],
  shiftCountInArea: number
): boolean {
  if (!isAreaActive || !isDayActive) return false;
  if (isPastCalendarDate(dateISO)) return false;
  if (isAreaOpenOnDate(serviceHours, areaId, dateISO)) return true;
  return shiftCountInArea > 0;
}

/** Bestätigung vor erstem Einsatz an einem Planungstag ohne Servicezeit (Dashboard, heute/Zukunft). */
export function canPromptNoServiceHoursShiftAssignForDay(
  dateISO: string,
  dayHasServiceHours: boolean,
  shiftCountInCell: number
): boolean {
  if (isPastCalendarDate(dateISO)) return false;
  if (dayHasServiceHours) return false;
  return shiftCountInCell === 0;
}

/** Bestätigung vor erstem Einsatz an einem Tag ohne Servicezeit (heute/Zukunft). */
export function canPromptNoServiceHoursShiftAssign(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: readonly AreaServiceHourRef[],
  shiftCountInArea: number
): boolean {
  if (!isAreaActive || !isDayActive) return false;
  if (isPastCalendarDate(dateISO)) return false;
  if (isAreaOpenOnDate(serviceHours, areaId, dateISO)) return false;
  return shiftCountInArea === 0;
}

/** Rechtsklick-Kontextmenü (Servicezeit-Tag oder erster Einsatz ohne Servicezeit). */
export function canShowAreaDayAssignContextMenu(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: readonly AreaServiceHourRef[],
  shiftCountInArea: number,
  simplePlanning: boolean
): boolean {
  if (
    canOpenAssignShiftContextMenu(
      areaId,
      dateISO,
      isAreaActive,
      isDayActive,
      serviceHours,
      shiftCountInArea
    )
  ) {
    return true;
  }
  if (simplePlanning) return false;
  return canPromptNoServiceHoursShiftAssign(
    areaId,
    dateISO,
    isAreaActive,
    isDayActive,
    serviceHours,
    shiftCountInArea
  );
}

/**
 * Mitarbeiter-Kalender: Rechtsklick auf Zelle — gleiche Policy wie Bereich-Kalender-Tag.
 */
export function canShowEmployeeDayCellAssignContextMenu(
  areaId: string | null,
  dateISO: string,
  isDayExpanded: boolean,
  dayHasServiceHours: boolean,
  shiftCountInArea: number,
  employeeBlockReason: PlanningDayAssignBlockReason | null,
  serviceHours: readonly AreaServiceHourRef[],
  simplePlanning: boolean
): boolean {
  if (!areaId || isPastCalendarDate(dateISO)) return false;
  if (employeeBlockReason === "absent") return false;

  if (dayHasServiceHours) {
    if (shiftCountInArea > 0) return true;
    if (employeeBlockReason === "no_availability") return false;
  }

  return canShowAreaDayAssignContextMenu(
    areaId,
    dateISO,
    true,
    isDayExpanded,
    serviceHours,
    shiftCountInArea,
    simplePlanning
  );
}

/** Linksklick Schichtkarte → Bulk-Modal (Vergangenheit erlaubt, wenn Bereich/Tag aktiv). */
export function canOpenBulkShiftFromShiftCard(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: readonly AreaServiceHourRef[],
  shiftCountInArea: number
): boolean {
  if (!isAreaActive || !isDayActive) return false;
  if (isAreaOpenOnDate(serviceHours, areaId, dateISO)) return true;
  return shiftCountInArea > 0;
}
