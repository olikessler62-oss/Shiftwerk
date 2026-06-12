import {
  loadCompliancePreset,
  loadCompliancePresetForOrganization,
  listCompliancePresets,
} from "./presets";
import type { CountryCompliance } from "./types";

/** Preset-basiert — Edge- und Browser-tauglich (ohne Dateisystem). */
export function loadCompliance(idOrCountryCode: string): CountryCompliance {
  return loadCompliancePreset(idOrCountryCode);
}

export function listComplianceCountries(): CountryCompliance[] {
  return listCompliancePresets();
}

export function loadComplianceForOrganization(
  countryCode: string | null | undefined
): CountryCompliance {
  return loadCompliancePresetForOrganization(countryCode);
}

export { getRule, rulesForEnforcementPoint } from "./helpers";
