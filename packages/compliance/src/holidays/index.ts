import {
  buildGermanHolidayNamesByDate,
  getGermanPublicHolidayName,
  isGermanPublicHoliday,
} from "./de";

export {
  buildGermanHolidayNamesByDate,
  getGermanPublicHolidayName,
  isGermanPublicHoliday,
};

export function isPublicHolidayForCountry(
  countryCode: string | null | undefined,
  isoDate: string
): boolean {
  const code = (countryCode ?? "DE").trim().toUpperCase();
  if (code === "DE") return isGermanPublicHoliday(isoDate);
  return false;
}

export function getPublicHolidayNameForCountry(
  countryCode: string | null | undefined,
  isoDate: string,
  locale: "de" | "en" = "de"
): string | null {
  const code = (countryCode ?? "DE").trim().toUpperCase();
  if (code === "DE") return getGermanPublicHolidayName(isoDate, locale);
  return null;
}

export function buildPublicHolidayNamesByDate(
  countryCode: string | null | undefined,
  dates: string[],
  locale: "de" | "en" = "de"
): Record<string, string> {
  const code = (countryCode ?? "DE").trim().toUpperCase();
  if (code === "DE") return buildGermanHolidayNamesByDate(dates, locale);
  return {};
}
