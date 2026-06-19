import type { ProfileHourlyRate } from "@schichtwerk/types";
import { dayAfter, dayBefore } from "@schichtwerk/database";

export type HourlyRateEditBounds = {
  minValidFrom?: string;
  maxValidFrom?: string;
};

export function sortProfileHourlyRatesByValidFrom(
  rates: ProfileHourlyRate[]
): ProfileHourlyRate[] {
  return [...rates].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
}

export function sortProfileHourlyRatesByValidFromDesc(
  rates: ProfileHourlyRate[]
): ProfileHourlyRate[] {
  return [...rates].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
}

export function resolveHourlyRateEditBounds(
  rates: ProfileHourlyRate[],
  editingRateId: string
): HourlyRateEditBounds {
  const sorted = sortProfileHourlyRatesByValidFrom(rates);
  const index = sorted.findIndex((rate) => rate.id === editingRateId);
  if (index < 0) return {};

  const predecessor = index > 0 ? sorted[index - 1] : null;
  const successor = index < sorted.length - 1 ? sorted[index + 1] : null;

  return {
    minValidFrom: predecessor ? dayAfter(predecessor.valid_from) : undefined,
    maxValidFrom: successor ? dayBefore(successor.valid_from) : undefined,
  };
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
