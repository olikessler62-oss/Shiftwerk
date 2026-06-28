import { shiftTimeFromTimestamp, parseISODate, toISODate } from "@/lib/dates";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import { mapSwapRequestsToCommunicationRows } from "@/lib/communication-hub-data";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { SchichtwerkDatabase } from "@/lib/db";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  Organization,
} from "@schichtwerk/types";

/** Schicht-Stati: ab heute, unabhängig von der sichtbaren Planungswoche. */
export const COMMUNICATION_HUB_SHIFT_HORIZON_YEARS = 2;

export function communicationHubShiftHorizonEnd(todayISO: string): string {
  const date = parseISODate(todayISO);
  date.setFullYear(date.getFullYear() + COMMUNICATION_HUB_SHIFT_HORIZON_YEARS);
  return toISODate(date);
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapAreaCalendarShiftRowsToPlanningShifts(
  shiftRows: Awaited<ReturnType<SchichtwerkDatabase["listAreaCalendarShifts"]>>,
  timeZone: string,
  areaShiftTemplates: readonly AreaShiftTemplateWithBreaks[] = []
): PlanningShift[] {
  const shifts: PlanningShift[] = [];

  for (const row of shiftRows) {
    const template = relation(row.area_shift_templates);
    const startFromTs = row.starts_at
      ? shiftTimeFromTimestamp(row.starts_at, timeZone)
      : template?.start_time?.slice(0, 5) ?? "00:00";
    const endFromTs = row.ends_at
      ? shiftTimeFromTimestamp(row.ends_at, timeZone)
      : template?.end_time?.slice(0, 5) ?? "00:00";
    const areaTemplate =
      !template && row.location_area_id
        ? findAreaShiftTemplateByTimes(
            row.location_area_id,
            startFromTs,
            endFromTs,
            areaShiftTemplates
          )
        : null;

    const confirmationFields = mapAreaCalendarShiftRowConfirmationFields(row);

    shifts.push({
      id: row.id,
      employee_id: row.employee_id,
      shift_date: row.shift_date,
      shiftName: template?.name ?? areaTemplate?.name ?? "",
      color: template?.color ?? areaTemplate?.color ?? "#64748b",
      startTime: startFromTs,
      endTime: endFromTs,
      location_area_id: row.location_area_id,
      area_shift_template_id:
        row.area_shift_template_id ?? areaTemplate?.id ?? null,
      confirmationStatus: confirmationFields.confirmationStatus,
      requestedAt: confirmationFields.requestedAt,
      confirmationStatusUpdatedAt: confirmationFields.confirmationStatusUpdatedAt,
      displayState: confirmationFields.displayState,
    });
  }

  return shifts;
}

export type CommunicationHubScopeBundle = {
  locationShifts: PlanningShift[];
  swapRequests: CommunicationSwapRequestRow[];
  cancelActors: Record<string, "employee" | "manager">;
  absences: AbsenceRequest[];
};

const EMPTY_COMMUNICATION_HUB_SCOPE: CommunicationHubScopeBundle = {
  locationShifts: [],
  swapRequests: [],
  cancelActors: {},
  absences: [],
};

export async function loadCommunicationHubScopeData(input: {
  db: SchichtwerkDatabase;
  orgId: string;
  organization: Organization;
  locationId: string | null;
  timeZone: string;
  todayISO: string;
  areaShiftTemplates?: readonly AreaShiftTemplateWithBreaks[];
}): Promise<CommunicationHubScopeBundle> {
  const {
    db,
    orgId,
    organization,
    locationId,
    timeZone,
    todayISO,
    areaShiftTemplates = [],
  } = input;

  if (!locationId || !organization.shift_confirmation_enabled) {
    return EMPTY_COMMUNICATION_HUB_SCOPE;
  }

  const to = communicationHubShiftHorizonEnd(todayISO);

  const [shiftRows, swapRequestRows, absences] = await Promise.all([
    db.listAreaCalendarShifts(orgId, todayISO, to, locationId),
    db.listOrganizationSwapRequests(orgId, {
      statuses: ["pending"],
      locationId,
      from: todayISO,
    }),
    db.listOrganizationAbsences(orgId, {
      statuses: ["approved"],
      overlappingFrom: todayISO,
    }),
  ]);

  const locationShifts = mapAreaCalendarShiftRowsToPlanningShifts(
    shiftRows,
    timeZone,
    areaShiftTemplates
  );

  const canceledShiftIds = locationShifts
    .filter((shift) => shift.confirmationStatus === "canceled")
    .filter((shift) => !shift.displayState?.openCancellation?.cancelledBy)
    .map((shift) => shift.id);

  const cancelActorEntries = await db.listShiftCancelActors(
    orgId,
    canceledShiftIds
  );

  return {
    locationShifts,
    swapRequests: mapSwapRequestsToCommunicationRows(swapRequestRows, timeZone),
    cancelActors: Object.fromEntries(cancelActorEntries),
    absences,
  };
}
