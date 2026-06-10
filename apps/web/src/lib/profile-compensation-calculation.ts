import { isGermanPublicHoliday } from "@/lib/german-public-holidays";
import type {
  CompensationSurchargeTrigger,
  CompensationSurchargeUnit,
  EffectiveProfileCompensationSurcharge,
} from "@schichtwerk/types";

export function surchargeTriggerMatchesDate(
  trigger: CompensationSurchargeTrigger,
  isoDate: string
): boolean {
  switch (trigger) {
    case "public_holiday":
      return isGermanPublicHoliday(isoDate);
    default:
      return false;
  }
}

export function resolveSurchargeAmount(
  amount: number | null,
  typeDefaultAmount: number
): number {
  return amount ?? typeDefaultAmount;
}

export function calculateSurchargeAdditionPerHour(
  baseHourlyRate: number,
  amount: number,
  unit: CompensationSurchargeUnit
): number {
  if (unit === "eur_per_hour") {
    return amount;
  }
  return Math.round(((baseHourlyRate * amount) / 100) * 100) / 100;
}

export function calculateEffectiveHourlyRate(input: {
  baseHourlyRate: number;
  shiftDate: string;
  surcharges: EffectiveProfileCompensationSurcharge[];
}): number {
  const applicable = input.surcharges.filter((entry) =>
    surchargeTriggerMatchesDate(entry.trigger, input.shiftDate)
  );
  const additions = applicable.map((entry) =>
    calculateSurchargeAdditionPerHour(
      input.baseHourlyRate,
      entry.amount,
      entry.unit
    )
  );
  const total =
    Math.round((input.baseHourlyRate + additions.reduce((a, b) => a + b, 0)) * 100) /
    100;
  return total;
}

export function formatSurchargeAmountLabel(
  amount: number,
  unit: CompensationSurchargeUnit,
  locale: "de" | "en"
): string {
  const formatted = new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (unit === "percent_of_base") {
    return `${formatted} %`;
  }
  return `${formatted} €/h`;
}
