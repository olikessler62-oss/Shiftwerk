import {
  absenceRangeForShiftConflict,
  absenceRequestToRange,
  findOverlappingAbsence,
  organizationTodayISO,
  resolveOrganizationTimeZone,
  validateAbsenceDateOrder,
  validateOpenEndedSickOnly,
  type AbsenceRange,
  type SchichtwerkDatabase,
} from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType, Organization, RequestStatus } from "@schichtwerk/types";

export type MobileAbsenceItem = {
  id: string;
  type: AbsenceType;
  startDate: string;
  endDate: string | null;
  isOpenEnded: boolean;
  expectedEndDate: string | null;
  status: RequestStatus;
  notes: string | null;
  updatedAt: string;
};

export type MobileAbsenceListResponse = {
  absences: MobileAbsenceItem[];
};

export type CreateMobileAbsenceBody = {
  type: AbsenceType;
  startDate: string;
  endDate?: string | null;
  isOpenEnded: boolean;
  expectedEndDate?: string | null;
  notes?: string | null;
};

export type PatchMobileAbsenceBody =
  | { action: "cancel" }
  | { action: "closeSick"; endDate: string }
  | { action: "extend"; expectedEndDate: string | null };

export type MobileAbsenceMutationResult =
  | { ok: true; id: string; shiftConflictCount?: number; status: RequestStatus }
  | { ok: false; error: string; status: number };

const VALID_ABSENCE_TYPES: AbsenceType[] = ["sick", "vacation", "other"];

const OVERLAP_STATUSES: RequestStatus[] = ["approved", "pending"];

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_DATES: "Bitte Start- und Enddatum angeben.",
  END_BEFORE_START: "Das Enddatum liegt vor dem Startdatum.",
  OPEN_ENDED_NOT_SICK: "Offenes Ende ist nur bei Krankmeldungen möglich.",
  OVERLAP: "Es besteht bereits eine überlappende Abwesenheit in diesem Zeitraum.",
  NOT_FOUND: "Abwesenheit nicht gefunden.",
  NOT_OPEN_ENDED: "Diese Krankmeldung ist nicht offen.",
  NOT_PENDING: "Nur ausstehende Meldungen können zurückgezogen werden.",
  NOT_OWN: "Kein Zugriff auf diese Abwesenheit.",
  INVALID_TYPE: "Ungültiger Abwesenheitstyp.",
  INVALID_DATE: "Ungültiges Datum.",
  INVALID_ACTION: "Unbekannte Aktion.",
  NOT_APPROVED: "Nur genehmigte Krankmeldungen können geschlossen werden.",
  NOT_SICK: "Diese Aktion ist nur für Krankmeldungen möglich.",
};

function fail(errorCode: string, status = 400): MobileAbsenceMutationResult {
  return {
    ok: false,
    error: ERROR_MESSAGES[errorCode] ?? errorCode,
    status,
  };
}

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toMobileItem(absence: AbsenceRequest): MobileAbsenceItem {
  return {
    id: absence.id,
    type: absence.type,
    startDate: absence.start_date,
    endDate: absence.end_date,
    isOpenEnded: absence.is_open_ended,
    expectedEndDate: absence.expected_end_date,
    status: absence.status,
    notes: absence.notes,
    updatedAt: absence.updated_at,
  };
}

async function listOverlapBaseline(
  db: SchichtwerkDatabase,
  organizationId: string,
  employeeId: string
): Promise<AbsenceRange[]> {
  const absences = await db.listOrganizationAbsences(organizationId, {
    statuses: OVERLAP_STATUSES,
    employeeId,
  });
  return absences.map((entry) => absenceRequestToRange(entry));
}

async function countShiftConflictsForRange(
  db: SchichtwerkDatabase,
  organizationId: string,
  organization: Organization,
  range: AbsenceRange
): Promise<number> {
  const timeZone = resolveOrganizationTimeZone(organization);
  const referenceDate = organizationTodayISO(timeZone);
  const conflictRange = absenceRangeForShiftConflict(range, referenceDate);
  return db.countShiftsConflictingWithAbsenceRanges(organizationId, [conflictRange]);
}

function validateAbsenceDraft(input: {
  type: AbsenceType;
  employeeId: string;
  startDate: string;
  endDate: string | null;
  isOpenEnded: boolean;
  existing: AbsenceRange[];
  excludeId?: string;
}): string | null {
  if (!input.startDate) return "MISSING_DATES";

  const openEndedCheck = validateOpenEndedSickOnly(input.type, input.isOpenEnded);
  if (!openEndedCheck.ok) return "OPEN_ENDED_NOT_SICK";

  const dateOrder = validateAbsenceDateOrder(
    input.startDate,
    input.endDate,
    input.isOpenEnded
  );
  if (!dateOrder.ok) {
    return dateOrder.code === "missingEnd" ? "MISSING_DATES" : "END_BEFORE_START";
  }

  const candidate: AbsenceRange = {
    id: input.excludeId,
    employee_id: input.employeeId,
    start_date: input.startDate,
    end_date: input.isOpenEnded ? null : input.endDate,
    is_open_ended: input.isOpenEnded,
  };

  const overlap = findOverlappingAbsence(input.existing, candidate, input.excludeId);
  if (overlap) return "OVERLAP";

  return null;
}

export async function listMobileAbsences(
  db: SchichtwerkDatabase,
  organizationId: string,
  employeeId: string,
  filters?: { from?: string; to?: string }
): Promise<MobileAbsenceListResponse> {
  const absences = await db.listOrganizationAbsences(organizationId, {
    employeeId,
  });

  const filtered = absences.filter((entry) => {
    if (filters?.from && entry.start_date < filters.from) {
      const end = entry.end_date ?? "9999-12-31";
      if (end < filters.from) return false;
    }
    if (filters?.to && entry.start_date > filters.to) return false;
    return true;
  });

  return {
    absences: filtered.map(toMobileItem),
  };
}

export async function createMobileAbsence(
  db: SchichtwerkDatabase,
  organization: Organization,
  employeeId: string,
  body: CreateMobileAbsenceBody
): Promise<MobileAbsenceMutationResult> {
  if (!VALID_ABSENCE_TYPES.includes(body.type)) {
    return fail("INVALID_TYPE");
  }
  if (!isIsoDate(body.startDate)) {
    return fail("INVALID_DATE");
  }

  const isOpenEnded = body.type === "sick" ? body.isOpenEnded : false;
  const endDate = isOpenEnded ? null : normalizeOptionalDate(body.endDate ?? null);
  if (!isOpenEnded && (!endDate || !isIsoDate(endDate))) {
    return fail("MISSING_DATES");
  }
  const expectedEndDate =
    body.type === "sick" ? normalizeOptionalDate(body.expectedEndDate ?? null) : null;
  if (expectedEndDate && !isIsoDate(expectedEndDate)) {
    return fail("INVALID_DATE");
  }

  const baseline = await listOverlapBaseline(db, organization.id, employeeId);
  const validationError = validateAbsenceDraft({
    type: body.type,
    employeeId,
    startDate: body.startDate,
    endDate,
    isOpenEnded,
    existing: baseline,
  });
  if (validationError) {
    return fail(validationError);
  }

  const status: RequestStatus =
    body.type === "sick" && organization.auto_approve_sick_absence
      ? "approved"
      : "pending";

  const range: AbsenceRange = {
    employee_id: employeeId,
    start_date: body.startDate,
    end_date: isOpenEnded ? null : endDate,
    is_open_ended: isOpenEnded,
  };

  const shiftConflictCount = await countShiftConflictsForRange(
    db,
    organization.id,
    organization,
    range
  );

  const id = await db.insertAbsenceRequest({
    organization_id: organization.id,
    employee_id: employeeId,
    type: body.type,
    start_date: body.startDate,
    end_date: isOpenEnded ? null : endDate,
    is_open_ended: isOpenEnded,
    expected_end_date: expectedEndDate,
    status,
    notes: normalizeNotes(body.notes),
    reviewed_by: null,
    reported_by: employeeId,
  });

  return { ok: true, id, shiftConflictCount, status };
}

export async function patchMobileAbsence(
  db: SchichtwerkDatabase,
  organization: Organization,
  employeeId: string,
  absenceId: string,
  body: PatchMobileAbsenceBody
): Promise<MobileAbsenceMutationResult> {
  const absences = await db.listOrganizationAbsences(organization.id, {
    employeeId,
  });
  const absence = absences.find((entry) => entry.id === absenceId);
  if (!absence) {
    return fail("NOT_FOUND", 404);
  }

  if (body.action === "cancel") {
    if (absence.status !== "pending") {
      return fail("NOT_PENDING");
    }
    await db.updateAbsenceRequest(absenceId, organization.id, {
      employee_id: absence.employee_id,
      type: absence.type,
      start_date: absence.start_date,
      end_date: absence.end_date,
      is_open_ended: absence.is_open_ended,
      expected_end_date: absence.expected_end_date,
      status: "cancelled",
      notes: absence.notes,
      reviewed_by: absence.reviewed_by,
      reported_by: absence.reported_by,
    });
    return { ok: true, id: absenceId };
  }

  if (absence.type !== "sick") {
    return fail("NOT_SICK");
  }

  if (body.action === "closeSick") {
    if (absence.status !== "approved") {
      return fail("NOT_APPROVED");
    }
    if (!absence.is_open_ended) {
      return fail("NOT_OPEN_ENDED");
    }
    if (!isIsoDate(body.endDate)) {
      return fail("INVALID_DATE");
    }

    const dateOrder = validateAbsenceDateOrder(
      absence.start_date,
      body.endDate,
      false
    );
    if (!dateOrder.ok) {
      return fail("END_BEFORE_START");
    }

    await db.updateAbsenceRequest(absenceId, organization.id, {
      employee_id: absence.employee_id,
      type: absence.type,
      start_date: absence.start_date,
      end_date: body.endDate,
      is_open_ended: false,
      expected_end_date: absence.expected_end_date,
      status: "approved",
      notes: absence.notes,
      reviewed_by: absence.reviewed_by,
      reported_by: absence.reported_by,
    });
    return { ok: true, id: absenceId };
  }

  if (body.action === "extend") {
    if (absence.status !== "approved" && absence.status !== "pending") {
      return fail("NOT_APPROVED");
    }
    const expectedEndDate = normalizeOptionalDate(body.expectedEndDate);
    if (expectedEndDate && !isIsoDate(expectedEndDate)) {
      return fail("INVALID_DATE");
    }
    if (expectedEndDate && expectedEndDate < absence.start_date) {
      return fail("END_BEFORE_START");
    }

    await db.updateAbsenceRequest(absenceId, organization.id, {
      employee_id: absence.employee_id,
      type: absence.type,
      start_date: absence.start_date,
      end_date: absence.end_date,
      is_open_ended: absence.is_open_ended,
      expected_end_date: expectedEndDate,
      status: absence.status,
      notes: absence.notes,
      reviewed_by: absence.reviewed_by,
      reported_by: absence.reported_by,
    });
    return { ok: true, id: absenceId };
  }

  return fail("INVALID_ACTION");
}
