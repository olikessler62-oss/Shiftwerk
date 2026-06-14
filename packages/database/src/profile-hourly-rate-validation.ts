const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kalendertag ±1 ohne Abhängigkeit von der Server-Zeitzone. */
export function dayBefore(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

export function dayAfter(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc.toISOString().slice(0, 10);
}

function parseIsoDate(
  raw: string
): { ok: true; date: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!ISO_DATE_RE.test(value)) {
    return { ok: false, error: "Bitte ein gültiges Datum eingeben." };
  }
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "Bitte ein gültiges Datum eingeben." };
  }
  return { ok: true, date: value };
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
  const parsed = parseIsoDate(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, valid_from: parsed.date };
}

export function validateNewHourlyRate(input: {
  valid_from: string;
  existingValidFromDates: string[];
}): { ok: true } | { ok: false; error: string } {
  if (input.existingValidFromDates.includes(input.valid_from)) {
    return {
      ok: false,
      error: "Für dieses Gültig-ab-Datum existiert bereits ein Stundensatz.",
    };
  }
  return { ok: true };
}

export function validateHourlyRateValidFromPolicy(input: {
  valid_from: string;
  serverToday: string;
  allowRetroactive: boolean;
  initialValidFrom?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (input.valid_from >= input.serverToday) {
    return { ok: true };
  }
  if (input.allowRetroactive) {
    return { ok: true };
  }
  if (
    input.initialValidFrom &&
    input.valid_from === input.initialValidFrom
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      "Nachträgliche Entgelteinträge sind für diese Organisation deaktiviert. Gültig ab muss heute oder in der Zukunft liegen.",
  };
}

export function validateHourlyRateEdit(input: {
  valid_from: string;
  existingValidFromDates: string[];
  predecessorValidFrom?: string | null;
  successorValidFrom?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (input.existingValidFromDates.includes(input.valid_from)) {
    return {
      ok: false,
      error: "Für dieses Gültig-ab-Datum existiert bereits ein Stundensatz.",
    };
  }

  if (
    input.predecessorValidFrom &&
    input.valid_from <= input.predecessorValidFrom
  ) {
    return {
      ok: false,
      error: "Das Gültig-ab-Datum muss nach dem vorherigen Satz liegen.",
    };
  }

  if (input.successorValidFrom && input.valid_from >= input.successorValidFrom) {
    return {
      ok: false,
      error: "Das Gültig-ab-Datum muss vor dem nächsten Satz liegen.",
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
