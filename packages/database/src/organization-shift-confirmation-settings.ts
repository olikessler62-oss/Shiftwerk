/** Voreinstellung: 3 Stunden nach Bestätigungsanfrage. */
export const DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES = 180;

export type OrganizationShiftConfirmationPendingInput = {
  shift_confirmation_pending_after_minutes?: number | null;
};

/** Kurze Fristen zum Testen; danach 30-Minuten-Schritte bis 24:00. */
const SHIFT_CONFIRMATION_PENDING_AFTER_SHORT_OPTIONS_MINUTES = [5, 10, 15] as const;

const SHIFT_CONFIRMATION_PENDING_AFTER_HALF_HOUR_OPTIONS_MINUTES = Array.from(
  { length: 48 },
  (_, index) => (index + 1) * 30
);

export const SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_MINUTES = [
  ...SHIFT_CONFIRMATION_PENDING_AFTER_SHORT_OPTIONS_MINUTES,
  ...SHIFT_CONFIRMATION_PENDING_AFTER_HALF_HOUR_OPTIONS_MINUTES,
] as readonly number[];

const SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_SET = new Set(
  SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_MINUTES
);

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
  if (total <= 0 || total > 1440) return null;
  return isValidShiftConfirmationPendingAfterMinutes(total) ? total : null;
}

export function isValidShiftConfirmationPendingAfterMinutes(
  minutes: number
): boolean {
  return (
    Number.isFinite(minutes) &&
    SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_SET.has(minutes)
  );
}
