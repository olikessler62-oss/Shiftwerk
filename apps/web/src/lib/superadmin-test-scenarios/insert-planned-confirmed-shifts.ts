import {
  buildShiftTimestamps,
  resolveAreaShiftTemplateIdByTimes,
  type SchichtwerkDatabase,
} from "@schichtwerk/database";
import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";

export type ScenarioPlannedShift = {
  employeeId: string;
  locationId: string;
  areaId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
};

export async function insertPlannedConfirmedShifts(
  db: SchichtwerkDatabase,
  organizationId: string,
  actorId: string,
  timeZone: string,
  planned: readonly ScenarioPlannedShift[]
): Promise<void> {
  const templatesByAreaId = new Map<string, AreaShiftTemplateWithBreaks[]>();

  for (const shift of planned) {
    let areaTemplates = templatesByAreaId.get(shift.areaId);
    if (!areaTemplates) {
      areaTemplates = await db.listAreaShiftTemplatesWithBreaksForArea(
        shift.areaId,
        shift.locationId
      );
      templatesByAreaId.set(shift.areaId, areaTemplates);
    }

    const areaShiftTemplateId = resolveAreaShiftTemplateIdByTimes(
      shift.areaId,
      shift.startTime,
      shift.endTime,
      areaTemplates
    );

    const timestamps = buildShiftTimestamps(
      shift.shiftDate,
      shift.startTime,
      shift.endTime,
      timeZone
    );

    await db.insertShift({
      organization_id: organizationId,
      employee_id: shift.employeeId,
      location_id: shift.locationId,
      location_area_id: shift.areaId,
      shift_date: shift.shiftDate,
      starts_at: timestamps.starts_at,
      ends_at: timestamps.ends_at,
      created_by: actorId,
      confirmation_status: "confirmed",
      confirmation_status_updated_at: new Date().toISOString(),
      ...(areaShiftTemplateId ? { area_shift_template_id: areaShiftTemplateId } : {}),
    });
  }
}
