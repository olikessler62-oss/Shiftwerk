import { isPastCalendarDate } from "@/lib/dates";
import {
  areaHasEffectiveServiceHoursOnDate,
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
  if (areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, dateISO)) {
    return true;
  }
  return shiftCountInArea > 0;
}

/** Bestätigung vor erstem Einsatz an einem Planungstag ohne Servicezeit (Dashboard, heute/Zukunft). */
export function canPromptNoServiceHoursShiftAssignForDay(
  dateISO: string,
  areaId: string,
  shiftCountInCell: number,
  serviceHours: readonly AreaServiceHourRef[]
): boolean {
  if (!areaId || isPastCalendarDate(dateISO)) return false;
  if (areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, dateISO)) {
    return false;
  }
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
  if (areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, dateISO)) {
    return false;
  }
  return shiftCountInArea === 0;
}

/**
 * Tag gilt für Zuweisung als aktiv: Checkbox oder erster Einsatz ohne Servicezeit
 * (Bereichskalender — auch zugeklappte Spalte).
 */
export function isAreaCalendarAssignDayActive(
  dateISO: string,
  isDayChecked: boolean,
  areaId: string,
  shiftCountInArea: number,
  serviceHours: readonly AreaServiceHourRef[]
): boolean {
  if (isDayChecked) return true;
  if (isPastCalendarDate(dateISO)) return false;
  if (shiftCountInArea > 0) return false;
  return !areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, dateISO);
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
  isDayChecked: boolean,
  shiftCountInArea: number,
  employeeBlockReason: PlanningDayAssignBlockReason | null,
  serviceHours: readonly AreaServiceHourRef[],
  simplePlanning: boolean
): boolean {
  if (!areaId || isPastCalendarDate(dateISO)) return false;
  if (employeeBlockReason === "absent") return false;

  const isAssignDayActive = isAreaCalendarAssignDayActive(
    dateISO,
    isDayChecked,
    areaId,
    shiftCountInArea,
    serviceHours
  );

  const areaHasEffectiveService = areaHasEffectiveServiceHoursOnDate(
    serviceHours,
    areaId,
    dateISO
  );

  if (areaHasEffectiveService) {
    if (shiftCountInArea > 0) return true;
    if (employeeBlockReason === "no_availability") return false;
  }

  return canShowAreaDayAssignContextMenu(
    areaId,
    dateISO,
    true,
    isAssignDayActive,
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
  if (areaHasEffectiveServiceHoursOnDate(serviceHours, areaId, dateISO)) {
    return true;
  }
  return shiftCountInArea > 0;
}
