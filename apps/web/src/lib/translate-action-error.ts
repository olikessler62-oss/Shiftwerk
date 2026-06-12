import type { Translator } from "@schichtwerk/i18n/translate";

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
};

const QUALIFICATION_MISSING_PREFIX =
  "Personal erfüllt die erforderliche Qualifikation nicht (";

export function translateActionError(message: string, t: Translator): string {
  if (message.startsWith("organization.errors.")) {
    return t(message);
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
