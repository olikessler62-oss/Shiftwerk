import type {
  ConfirmationDecision,
  ConfirmationRespondItem,
  ShiftConfirmationStatus,
} from "@schichtwerk/types";

export const EMPLOYEE_RESPONDABLE_CONFIRMATION_STATUSES = [
  "requested",
  "pending",
] as const satisfies readonly ShiftConfirmationStatus[];

export type EmployeeRespondableConfirmationStatus =
  (typeof EMPLOYEE_RESPONDABLE_CONFIRMATION_STATUSES)[number];

export function isEmployeeRespondableConfirmationStatus(
  status: ShiftConfirmationStatus | undefined | null
): status is EmployeeRespondableConfirmationStatus {
  return status === "requested" || status === "pending";
}

export function validateConfirmationRespondItems(
  items: readonly ConfirmationRespondItem[]
): { ok: true } | { ok: false; error: string } {
  if (!items.length) {
    return { ok: false, error: "Keine Antworten angegeben." };
  }

  const seenShiftIds = new Set<string>();
  for (const item of items) {
    const shiftId = item.shiftId?.trim();
    if (!shiftId) {
      return { ok: false, error: "Ungültige Schicht-ID." };
    }
    if (seenShiftIds.has(shiftId)) {
      return { ok: false, error: "Doppelte Schicht-ID im Request." };
    }
    seenShiftIds.add(shiftId);
    if (item.decision !== "confirm" && item.decision !== "reject") {
      return { ok: false, error: "Ungültige Entscheidung." };
    }
  }

  return { ok: true };
}

export type ShiftOpenForEmployeeResponse = {
  id: string;
  employee_id: string;
  confirmation_status: ShiftConfirmationStatus;
};

export function assertRespondItemsAllowed(
  items: readonly ConfirmationRespondItem[],
  openShiftsById: ReadonlyMap<string, ShiftOpenForEmployeeResponse>,
  employeeId: string
): { ok: true } | { ok: false; error: string } {
  for (const item of items) {
    const shift = openShiftsById.get(item.shiftId);
    if (!shift) {
      return {
        ok: false,
        error: "Schicht nicht gefunden oder nicht mehr offen.",
      };
    }
    if (shift.employee_id !== employeeId) {
      return { ok: false, error: "Schicht gehört nicht zum Mitarbeiter." };
    }
    if (!isEmployeeRespondableConfirmationStatus(shift.confirmation_status)) {
      return {
        ok: false,
        error: "Schicht kann nicht beantwortet werden.",
      };
    }
  }

  return { ok: true };
}

export function decisionToConfirmationStatus(
  decision: ConfirmationDecision
): "confirmed" | "rejected" {
  return decision === "confirm" ? "confirmed" : "rejected";
}

export function buildManagerResponseSummaryNotification(input: {
  employeeName: string;
  decisions: readonly ConfirmationDecision[];
  shiftIds: readonly string[];
}): {
  type: "employee_response_summary";
  title: string;
  body: string;
  allConfirmed: boolean;
  payload: Record<string, unknown>;
} {
  const hasReject = input.decisions.some((decision) => decision === "reject");
  const allConfirmed =
    input.decisions.length > 0 &&
    !hasReject &&
    input.decisions.every((decision) => decision === "confirm");

  const title = hasReject
    ? `Rückmeldung mit Ablehnungen: ${input.employeeName}`
    : `Einplanung bestätigt: ${input.employeeName}`;
  const body = hasReject
    ? `${input.employeeName} hat die Einplanung inkl. Ablehnungen beantwortet.`
    : `${input.employeeName} hat die Einplanung vollständig bestätigt.`;

  return {
    type: "employee_response_summary",
    title,
    body,
    allConfirmed,
    payload: {
      employee_name: input.employeeName,
      shift_ids: [...input.shiftIds],
      all_confirmed: allConfirmed,
      has_rejections: hasReject,
    },
  };
}
