import { isPastCalendarDate } from "@/lib/dates";
import {
  isAreaOpenOnDate,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";

/** Kontextmenü / Linksklick: Servicezeit-Tag oder manuelle Einsätze ohne Servicezeit. */
export function canOpenAssignShiftContextMenu(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: AreaServiceHourRef[],
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
  serviceHours: AreaServiceHourRef[],
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
  serviceHours: AreaServiceHourRef[],
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

/** Linksklick Schichtkarte → Bulk-Modal (Vergangenheit erlaubt, wenn Bereich/Tag aktiv). */
export function canOpenBulkShiftFromShiftCard(
  areaId: string,
  dateISO: string,
  isAreaActive: boolean,
  isDayActive: boolean,
  serviceHours: AreaServiceHourRef[],
  shiftCountInArea: number
): boolean {
  if (!isAreaActive || !isDayActive) return false;
  if (isAreaOpenOnDate(serviceHours, areaId, dateISO)) return true;
  return shiftCountInArea > 0;
}
