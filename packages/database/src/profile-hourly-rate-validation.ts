const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseHourlyRateAmount(
  raw: string
): { ok: true; amount: number } | { ok: false; error: string } {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) {
    return { ok: false, error: "Bitte einen Stundensatz eingeben." };
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Ungültiger Stundensatz." };
  }
  const rounded = Math.round(amount * 100) / 100;
  return { ok: true, amount: rounded };
}

export function parseValidFromDate(
  raw: string
): { ok: true; valid_from: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!ISO_DATE_RE.test(value)) {
    return { ok: false, error: "Bitte ein gültiges Datum eingeben." };
  }
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "Bitte ein gültiges Datum eingeben." };
  }
  return { ok: true, valid_from: value };
}

export function validateNewHourlyRate(input: {
  amount: number;
  valid_from: string;
  currentOpenValidFrom?: string | null;
}):
  | { ok: true }
  | { ok: false; error: string } {
  if (input.currentOpenValidFrom && input.valid_from <= input.currentOpenValidFrom) {
    return {
      ok: false,
      error: "Das Gültig-ab-Datum muss nach dem aktuellen Satz liegen.",
    };
  }
  return { ok: true };
}

/** Entgelt ist änderbar/löschbar, wenn Gültig-ab >= Referenzdatum (serverseitig). */
export function isMutableHourlyRate(
  validFrom: string,
  referenceDate: string
): boolean {
  return validFrom >= referenceDate;
}

export function validateMutableHourlyRateValidFrom(
  valid_from: string,
  referenceDate: string
): { ok: true } | { ok: false; error: string } {
  if (!isMutableHourlyRate(valid_from, referenceDate)) {
    return {
      ok: false,
      error:
        "Nur Entgelte mit Gültig-ab ab heute können geändert oder gelöscht werden.",
    };
  }
  return { ok: true };
}
