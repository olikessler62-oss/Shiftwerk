import { isMutableHourlyRate } from "@schichtwerk/database";
import type {
  CompensationSurchargeTrigger,
  CompensationSurchargeUnit,
  EffectiveProfileCompensationSurcharge,
  ProfileCompensationSurcharge,
} from "@schichtwerk/types";
import { formatSurchargeAmountLabel } from "./profile-compensation-calculation";

type AssignableSurchargeEntry = {
  surcharge_type_id: string;
  valid_from: string;
  valid_to: string | null;
};

/** Typen, für die ein neuer Profil-Zuschlag angelegt werden kann (nicht nur bearbeitet). */
export function assignableCompensationSurchargeTypesForProfile<
  T extends { id: string },
  E extends AssignableSurchargeEntry,
>(params: {
  types: readonly T[];
  surchargeEntries: readonly E[];
  serverToday: string;
}): T[] {
  const { types, surchargeEntries, serverToday } = params;
  if (!serverToday) return [];

  const openEntryByTypeId = new Map<string, E>();
  for (const entry of surchargeEntries) {
    if (entry.valid_to === null) {
      openEntryByTypeId.set(entry.surcharge_type_id, entry);
    }
  }

  return types.filter((type) => {
    const openEntry = openEntryByTypeId.get(type.id);
    if (!openEntry) return true;
    return !isMutableHourlyRate(openEntry.valid_from, serverToday);
  });
}

export function assignableCompensationSurchargeTypesForEmployeeProfile<
  T extends { id: string },
  E extends AssignableSurchargeEntry & { profile_id: string },
>(params: {
  types: readonly T[];
  surchargeEntries: readonly E[];
  profileId: string;
  serverToday: string;
}): T[] {
  return assignableCompensationSurchargeTypesForProfile({
    types: params.types,
    surchargeEntries: params.surchargeEntries.filter(
      (entry) => entry.profile_id === params.profileId
    ),
    serverToday: params.serverToday,
  });
}

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

export function sortProfileCompensationSurchargesByValidFromDesc(
  entries: ProfileCompensationSurcharge[]
): ProfileCompensationSurcharge[] {
  return [...entries].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
}
