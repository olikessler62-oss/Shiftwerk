export const LOCALES = ["de", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const defaultLocale: Locale = "de";

export const LOCALE_COOKIE = "schichtwerk-locale";

export function isValidLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

export const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};
