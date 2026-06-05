import type { Locale } from "@schichtwerk/i18n";

const INTL_LOCALE: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
};

export function toIntlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}
