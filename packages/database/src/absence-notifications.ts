import type { AbsenceType, RequestStatus } from "@schichtwerk/types";

function formatDeDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

export function absenceTypeLabelDe(type: AbsenceType): string {
  switch (type) {
    case "sick":
      return "Krank";
    case "vacation":
      return "Urlaub";
    case "other":
      return "Sonstiges";
    default:
      return type;
  }
}

export function formatAbsenceEndLabel(input: {
  isOpenEnded: boolean;
  endDate: string | null;
}): string {
  if (input.isOpenEnded) return "Offen";
  if (input.endDate) return formatDeDate(input.endDate);
  return "—";
}

export function buildManagerAbsenceSubmittedNotification(input: {
  employeeName: string;
  employeeId: string;
  absenceId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string | null;
  isOpenEnded: boolean;
  status: RequestStatus;
}): {
  type: "absence_submitted";
  title: string;
  body: string;
  payload: Record<string, unknown>;
} {
  const typeLabel = absenceTypeLabelDe(input.type);
  const periodLabel = `${formatDeDate(input.startDate)} – ${formatAbsenceEndLabel({
    isOpenEnded: input.isOpenEnded,
    endDate: input.endDate,
  })}`;
  const statusHint =
    input.status === "pending" ? " (Ausstehend)" : "";

  return {
    type: "absence_submitted",
    title: `${typeLabel}: ${input.employeeName}`,
    body: `${input.employeeName} hat ${typeLabel.toLowerCase()} gemeldet (${periodLabel})${statusHint}.`,
    payload: {
      absence_id: input.absenceId,
      employee_id: input.employeeId,
      employee_name: input.employeeName,
      type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      is_open_ended: input.isOpenEnded,
      status: input.status,
    },
  };
}

export function buildEmployeeAbsenceReviewNotification(input: {
  absenceId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string | null;
  isOpenEnded: boolean;
  approved: boolean;
}): {
  templateKey: "absence.approved" | "absence.rejected";
  title: string;
  body: string;
  payload: Record<string, unknown>;
} {
  const typeLabel = absenceTypeLabelDe(input.type);
  const periodLabel = `${formatDeDate(input.startDate)} – ${formatAbsenceEndLabel({
    isOpenEnded: input.isOpenEnded,
    endDate: input.endDate,
  })}`;

  if (input.approved) {
    return {
      templateKey: "absence.approved",
      title: `${typeLabel} genehmigt`,
      body: `Deine ${typeLabel.toLowerCase()}-Meldung (${periodLabel}) wurde genehmigt.`,
      payload: {
        absence_id: input.absenceId,
        type: input.type,
        start_date: input.startDate,
        end_date: input.endDate,
        is_open_ended: input.isOpenEnded,
        status: "approved" as RequestStatus,
      },
    };
  }

  return {
    templateKey: "absence.rejected",
    title: `${typeLabel} abgelehnt`,
    body: `Deine ${typeLabel.toLowerCase()}-Meldung (${periodLabel}) wurde abgelehnt.`,
    payload: {
      absence_id: input.absenceId,
      type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      is_open_ended: input.isOpenEnded,
      status: "rejected" as RequestStatus,
    },
  };
}
