import type { ProfileCompensationCacheEntry } from "@/components/settings/profile-compensation-panel-modal";
import type {
  ProfileCompensationSurcharge,
  ProfileHourlyRate,
} from "@schichtwerk/types";
import { sortProfileHourlyRatesByValidFrom } from "@/lib/profile-hourly-rate-display";
import { sortProfileCompensationSurchargesByValidFromDesc } from "@/lib/profile-surcharge-display";
import { toEffectiveProfileCompensationSurcharge } from "@/lib/profile-surcharge-display";

export function buildProfileCompensationCacheEntry(
  profileId: string,
  allRates: readonly ProfileHourlyRate[],
  allSurcharges: readonly ProfileCompensationSurcharge[],
  serverToday: string
): ProfileCompensationCacheEntry {
  const rates = sortProfileHourlyRatesByValidFrom(
    allRates.filter((rate) => rate.profile_id === profileId)
  );
  const surchargeEntries = sortProfileCompensationSurchargesByValidFromDesc(
    allSurcharges.filter((entry) => entry.profile_id === profileId)
  );

  const currentRate =
    [...rates]
      .reverse()
      .find(
        (rate) =>
          rate.valid_from <= serverToday &&
          (rate.valid_to === null || rate.valid_to >= serverToday)
      ) ?? null;

  const currentSurchargesByType = new Map<
    string,
    ReturnType<typeof toEffectiveProfileCompensationSurcharge>
  >();
  for (const entry of surchargeEntries) {
    if (entry.valid_from > serverToday) continue;
    if (entry.valid_to !== null && entry.valid_to < serverToday) continue;
    if (currentSurchargesByType.has(entry.surcharge_type_id)) continue;
    currentSurchargesByType.set(
      entry.surcharge_type_id,
      toEffectiveProfileCompensationSurcharge(entry)
    );
  }

  return {
    currentRate,
    rates,
    surchargeEntries,
    currentSurcharges: [...currentSurchargesByType.values()],
    serverToday,
  };
}
