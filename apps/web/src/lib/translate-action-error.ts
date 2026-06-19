import { SHIFT_CONFIRMATION_ASSIGN_GATE_ERROR } from "@schichtwerk/database";
import type { Translator } from "@schichtwerk/i18n/translate";
import {
  parseShiftDeleteBlockedStatus,
  shiftDeleteBlockedMessage,
} from "@/lib/shift-deletion-policy";

const SHIFT_ASSIGN_EXACT_KEYS: Record<string, string> = {
  "Personal ist an diesem Tag abwesend.": "shiftAssign.employeeAbsent",
  "Personal hat an diesem Wochentag keine Verfügbarkeit.":
    "shiftAssign.noWeekdayAvailability",
  "Schichtzeit liegt außerhalb der Verfügbarkeit des Personals.":
    "shiftAssign.shiftOutsideAvailability",
  "Personal erfüllt die erforderliche Qualifikation für diese Servicezeit nicht.":
    "shiftAssign.qualificationMissingGeneric",
  "Schicht liegt außerhalb der Servicezeiten.": "shiftAssign.outsideServiceHours",
  "Keine Servicezeiten für diesen Tag hinterlegt.":
    "shiftAssign.noServiceHoursForDay",
  "Vergangene Tage können nicht mehr geplant werden.":
    "shiftAssign.pastShiftDate",
  "Standort nicht gefunden": "shiftAssign.locationNotFound",
  "Bereich nicht gefunden": "shiftAssign.areaNotFound",
  "Personal nicht gefunden": "shiftAssign.employeeNotFound",
  "Ungültige Schichtzeiten.": "shiftAssign.invalidShiftTimes",
  "Speichern fehlgeschlagen": "shiftAssign.saveFailed",
  "Unbekannter Fehler": "shiftAssign.unknownError",
  "Überschneidung mit anderer Zeile im Batch.": "shiftAssign.batchRowOverlap",
  [SHIFT_CONFIRMATION_ASSIGN_GATE_ERROR]:
    "shiftConfirmation.gate.appNotRegistered",
};

const QUALIFICATION_MISSING_PREFIX =
  "Personal erfüllt die erforderliche Qualifikation nicht (";

const MIN_REST_PERIOD_PREFIX = "Mindestruhezeit von ";
const MIN_REST_PERIOD_SUFFIX =
  " Stunden zwischen Schichten nicht eingehalten.";

export function translateActionError(message: string, t: Translator): string {
  if (message.startsWith("organization.errors.")) {
    return t(message);
  }

  const blockedStatus = parseShiftDeleteBlockedStatus(message);
  if (blockedStatus) {
    return shiftDeleteBlockedMessage(blockedStatus, t);
  }

  const exactKey = SHIFT_ASSIGN_EXACT_KEYS[message];
  if (exactKey) return t(exactKey);

  if (message.startsWith(QUALIFICATION_MISSING_PREFIX) && message.endsWith(").")) {
    const names = message.slice(
      QUALIFICATION_MISSING_PREFIX.length,
      message.length - 2
    );
    return t("shiftAssign.qualificationMissing", { names });
  }

  if (
    message.startsWith(MIN_REST_PERIOD_PREFIX) &&
    message.includes(MIN_REST_PERIOD_SUFFIX)
  ) {
    const suffixIdx = message.indexOf(MIN_REST_PERIOD_SUFFIX);
    const hours = message.slice(
      MIN_REST_PERIOD_PREFIX.length,
      suffixIdx
    );
    const base = t("shiftAssign.minRestPeriod", { hours });
    const remainder = message.slice(suffixIdx + MIN_REST_PERIOD_SUFFIX.length);
    return remainder ? `${base}${remainder}` : base;
  }

  return message;
}

export const REGISTER_ERROR_CODES = [
  "registrationFailed",
  "organizationCreateFailed",
  "profileCreateFailed",
] as const;

export type RegisterErrorCode = (typeof REGISTER_ERROR_CODES)[number];

export function isRegisterErrorCode(value: string): value is RegisterErrorCode {
  return (REGISTER_ERROR_CODES as readonly string[]).includes(value);
}

export function translateRegisterError(
  error: string | undefined,
  t: Translator
): string | null {
  if (!error) return null;
  const decoded = decodeURIComponent(error);
  if (isRegisterErrorCode(decoded)) {
    return t(`register.errors.${decoded}`);
  }
  return decoded;
}

export function organizationPlanningModeErrorKey(
  code: "already_active" | "downgrade_not_allowed" | "invalid_change"
): string {
  switch (code) {
    case "already_active":
      return "organization.errors.planningModeAlreadyActive";
    case "downgrade_not_allowed":
      return "organization.errors.planningModeDowngradeNotAllowed";
    default:
      return "organization.errors.planningModeInvalidChange";
  }
}
