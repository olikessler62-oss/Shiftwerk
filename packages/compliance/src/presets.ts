import { COMPLIANCE_PRESETS, GERMANY_COMPLIANCE } from "./presets/germany";
import type { CountryCompliance } from "./types";

export { GERMANY_COMPLIANCE, COMPLIANCE_PRESETS };

const presetById = new Map<string, CountryCompliance>();
const presetByCountryCode = new Map<string, CountryCompliance>();

for (const compliance of COMPLIANCE_PRESETS) {
  presetById.set(compliance.meta.id.toLowerCase(), compliance);
  presetByCountryCode.set(compliance.meta.countryCode.toUpperCase(), compliance);
}

/** Lädt Compliance ohne Dateisystem (Browser / Edge). */
export function loadCompliancePreset(idOrCountryCode: string): CountryCompliance {
  const key = idOrCountryCode.trim();
  const byFileId = presetById.get(key.toLowerCase());
  if (byFileId) return byFileId;

  const byCode = presetByCountryCode.get(key.toUpperCase());
  if (byCode) return byCode;

  throw new Error(`Keine Compliance-Datei für „${idOrCountryCode}".`);
}

export function listCompliancePresets(): CountryCompliance[] {
  return [...COMPLIANCE_PRESETS];
}

export function loadCompliancePresetForOrganization(
  countryCode: string | null | undefined
): CountryCompliance {
  if (!countryCode?.trim()) return GERMANY_COMPLIANCE;
  try {
    return loadCompliancePreset(countryCode);
  } catch {
    return GERMANY_COMPLIANCE;
  }
}
