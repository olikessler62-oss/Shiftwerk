import type { Organization } from "@schichtwerk/types";

/** Voreinstellung: 3 Stunden nach Bestätigungsanfrage. */
export const DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES = 180;

export type OrganizationShiftConfirmationPendingInput = Pick<
  Organization,
  "shift_confirmation_pending_after_minutes"
>;

/** 30-Minuten-Schritte von 00:30 bis 24:00. */
export const SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_MINUTES = Array.from(
  { length: 48 },
  (_, index) => (index + 1) * 30
) as readonly number[];

export function resolveOrganizationShiftConfirmationPendingAfterMinutes(
  organization: OrganizationShiftConfirmationPendingInput | null | undefined
): number {
  const value = organization?.shift_confirmation_pending_after_minutes;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES;
}

export function formatShiftConfirmationPendingAfterDuration(
  totalMinutes: number
): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function parseShiftConfirmationPendingAfterDuration(
  value: string
): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || mins >= 60) {
    return null;
  }
  const total = hours * 60 + mins;
  if (total <= 0 || total > 1440 || total % 30 !== 0) return null;
  return total;
}

export function isValidShiftConfirmationPendingAfterMinutes(
  minutes: number
): boolean {
  return (
    Number.isFinite(minutes) &&
    minutes > 0 &&
    minutes <= 1440 &&
    minutes % 30 === 0
  );
}
