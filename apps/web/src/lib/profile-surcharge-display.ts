import type {
  CompensationSurchargeTrigger,
  CompensationSurchargeUnit,
  EffectiveProfileCompensationSurcharge,
  ProfileCompensationSurcharge,
} from "@schichtwerk/types";
import { formatSurchargeAmountLabel } from "./profile-compensation-calculation";

export function resolveProfileSurchargeAmount(
  entry: Pick<ProfileCompensationSurcharge, "amount" | "type_default_amount">
): number {
  return entry.amount ?? entry.type_default_amount;
}

export function resolveProfileSurchargeUnit(
  entry: Pick<ProfileCompensationSurcharge, "unit" | "type_default_unit">
): CompensationSurchargeUnit {
  return entry.unit ?? entry.type_default_unit;
}

export function toEffectiveProfileCompensationSurcharge(
  entry: ProfileCompensationSurcharge
): EffectiveProfileCompensationSurcharge {
  return {
    id: entry.id,
    surcharge_type_id: entry.surcharge_type_id,
    name: entry.surcharge_type_name,
    trigger: entry.trigger,
    amount: resolveProfileSurchargeAmount(entry),
    unit: resolveProfileSurchargeUnit(entry),
  };
}

export function formatProfileSurchargeLabel(
  entry: Pick<
    ProfileCompensationSurcharge,
    | "surcharge_type_name"
    | "amount"
    | "type_default_amount"
    | "unit"
    | "type_default_unit"
  >,
  locale: "de" | "en"
): string {
  const amount = resolveProfileSurchargeAmount(entry);
  return `${entry.surcharge_type_name} +${formatSurchargeAmountLabel(amount, resolveProfileSurchargeUnit(entry), locale)}`;
}

export function formatEffectiveSurchargeSummary(
  surcharges: EffectiveProfileCompensationSurcharge[],
  locale: "de" | "en"
): string {
  return surcharges
    .map((entry) =>
      `${entry.name} +${formatSurchargeAmountLabel(entry.amount, entry.unit, locale)}`
    )
    .join(", ");
}

export function formatSurchargeTriggerLabel(
  trigger: CompensationSurchargeTrigger,
  t: (key: string) => string
): string {
  switch (trigger) {
    case "public_holiday":
      return t("surcharges.triggerPublicHoliday");
    case "sunday":
      return t("surcharges.triggerSunday");
    default:
      return trigger;
  }
}

export function formatSurchargeUnitLabel(
  unit: CompensationSurchargeUnit,
  t: (key: string) => string
): string {
  switch (unit) {
    case "eur_per_hour":
      return t("surcharges.unitEurPerHour");
    case "percent_of_base":
      return t("surcharges.unitPercentOfBase");
    default:
      return unit;
  }
}

export function formatSurchargeAmountFieldLabel(
  unit: CompensationSurchargeUnit,
  t: (key: string) => string
): string {
  switch (unit) {
    case "percent_of_base":
      return t("surcharges.amountPercent");
    case "eur_per_hour":
      return t("surcharges.amountEurPerHour");
    default:
      return t("surcharges.amount");
  }
}
