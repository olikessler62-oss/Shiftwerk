import type { ProfileHourlyRate } from "@schichtwerk/types";

function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function minValidFromForRateChange(
  currentOpenValidFrom: string | null,
  serverToday: string
): string {
  if (!currentOpenValidFrom) return serverToday;
  const next = dayAfter(currentOpenValidFrom);
  return serverToday > next ? serverToday : next;
}

export function formatAmountForInput(amount: number, locale: string): string {
  const fixed = amount.toFixed(2);
  return locale === "en" ? fixed : fixed.replace(".", ",");
}

export function formatAmountLabel(
  amount: number,
  currency: string,
  locale: string
): string {
  return `${formatAmountForInput(amount, locale)} ${currency}`;
}

export function formatHourlyRateLabel(
  rate: ProfileHourlyRate,
  locale: "de" | "en"
): string {
  return formatAmountLabel(rate.amount, rate.currency, locale);
}

export function parseAmountInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function formatDateLabel(iso: string, locale: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "de-DE");
}
