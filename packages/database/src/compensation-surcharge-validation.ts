import type {
  CompensationSurchargeTrigger,
  CompensationSurchargeType,
  CompensationSurchargeUnit,
} from "@schichtwerk/types";

export const COMPENSATION_SURCHARGE_TRIGGERS = [
  "public_holiday",
] as const satisfies readonly CompensationSurchargeTrigger[];

export const COMPENSATION_SURCHARGE_UNITS = [
  "eur_per_hour",
  "percent_of_base",
] as const satisfies readonly CompensationSurchargeUnit[];

export type CompensationSurchargeTypeUniquenessInput = {
  name: string;
  excludeId?: string;
};

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase("de-DE");
}

export function isCompensationSurchargeTrigger(
  value: string
): value is CompensationSurchargeTrigger {
  return (COMPENSATION_SURCHARGE_TRIGGERS as readonly string[]).includes(value);
}

export function isCompensationSurchargeUnit(
  value: string
): value is CompensationSurchargeUnit {
  return (COMPENSATION_SURCHARGE_UNITS as readonly string[]).includes(value);
}

export function parseSurchargeAmount(
  raw: string,
  unit: CompensationSurchargeUnit
): { ok: true; amount: number } | { ok: false; error: string } {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) {
    return { ok: false, error: "Bitte einen Betrag eingeben." };
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Ungültiger Betrag." };
  }
  if (unit === "percent_of_base" && amount > 1000) {
    return { ok: false, error: "Prozentwert ist zu hoch." };
  }
  const rounded = Math.round(amount * 100) / 100;
  return { ok: true, amount: rounded };
}

export function validateCompensationSurchargeTypeUniqueness(
  existing: CompensationSurchargeType[],
  input: CompensationSurchargeTypeUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const key = nameKey(input.name);
  const duplicate = existing.find(
    (entry) =>
      nameKey(entry.name) === key &&
      (!input.excludeId || entry.id !== input.excludeId)
  );
  if (duplicate) {
    return {
      ok: false,
      error: "Es gibt bereits einen Sonderzuschlag mit dieser Bezeichnung.",
    };
  }
  return { ok: true };
}

export function validateNewProfileCompensationSurcharge(input: {
  valid_from: string;
  currentOpenValidFrom?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (
    input.currentOpenValidFrom &&
    input.valid_from <= input.currentOpenValidFrom
  ) {
    return {
      ok: false,
      error: "Das Gültig-ab-Datum muss nach dem aktuellen Eintrag liegen.",
    };
  }
  return { ok: true };
}
