/** IANA-Zeitzone, wenn weder DB-Feld noch Land-Mapping greifen. */
export const DEFAULT_ORGANIZATION_TIME_ZONE = "Europe/Berlin";

/**
 * Standard-Zeitzone pro Land (ISO 3166-1 alpha-2).
 * Primärquelle bleibt `organizations.timezone`; dieses Mapping dient als Fallback.
 */
export const COUNTRY_DEFAULT_TIME_ZONES: Readonly<Record<string, string>> = {
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
  CH: "Europe/Zurich",
};

export type OrganizationTimeZoneInput = {
  timezone?: string | null;
  country_code?: string | null;
  shift_confirmation_pending_after_minutes?: number | null;
};

/** Ortszeitzone der Organisation für Schicht-Uhrzeiten (Speichern & Anzeige). */
export function resolveOrganizationTimeZone(
  organization: OrganizationTimeZoneInput | null | undefined
): string {
  const explicit = organization?.timezone?.trim();
  if (explicit) return explicit;

  const country = organization?.country_code?.trim().toUpperCase();
  if (country && COUNTRY_DEFAULT_TIME_ZONES[country]) {
    return COUNTRY_DEFAULT_TIME_ZONES[country];
  }

  return DEFAULT_ORGANIZATION_TIME_ZONE;
}

/** Kalendertag „heute“ in der Organisations-Zeitzone (YYYY-MM-DD). */
export function organizationTodayISO(
  timeZone: string,
  now: Date = new Date()
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
