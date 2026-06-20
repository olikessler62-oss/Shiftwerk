const MAX_WEEKLY_HOURS = 48;

export function parseProfileWeeklyHours(
  raw: string
): { ok: true; weekly_hours: number | null } | { ok: false; error: string } {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) {
    return { ok: true, weekly_hours: null };
  }

  const hours = Number(normalized);
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ok: false, error: "Ungültige Wochenstunden." };
  }
  if (hours > MAX_WEEKLY_HOURS) {
    return {
      ok: false,
      error: `Wochenstunden dürfen höchstens ${MAX_WEEKLY_HOURS} betragen.`,
    };
  }

  const rounded = Math.round(hours * 100) / 100;
  return { ok: true, weekly_hours: rounded };
}
