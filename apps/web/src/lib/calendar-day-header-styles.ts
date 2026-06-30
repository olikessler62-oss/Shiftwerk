/** Gemeinsame Tag-Header-Styles für Dashboard-Kalender und Planer. */

export const CALENDAR_DAY_HEADER_ROW_HEIGHT = "49px";
export const CALENDAR_DAY_HEADER_ROW_HEIGHT_PX = 49;

export const CALENDAR_DAY_HEADER_MUTED_CLASS = "bg-calendar-muted-header";
export const CALENDAR_DAY_HEADER_ACTIVE_CLASS = "bg-calendar-active-header";
/** Personalbedarf-Zeile (Füllstandsanzeigen) — Mittelgrau, abgesetzt vom Schichtbereich. */
export const CALENDAR_STAFFING_HEADER_CLASS = "bg-calendar-staffing-header";

export const CALENDAR_TODAY_DAY_HEADER_BADGE_CLASS =
  "rounded-sm bg-[#7892ce] px-1.5 py-0 text-white shadow-sm";

/** Wochentag-Label für den aktuellen Tag (kompakte Tabellen, z. B. Dashboard-Bereichskarten). */
export const CALENDAR_TODAY_WEEKDAY_TEXT_CLASS =
  "font-semibold text-[color-mix(in_srgb,var(--brand-neon-cyan)_72%,var(--brand-bright))]";

export const CALENDAR_HOLIDAY_DAY_HEADER_LABEL_CLASS =
  "w-full max-w-full shrink-0 truncate px-0.5 text-center text-[10px] font-medium leading-tight text-blue-600 -mt-px";

/** Feiertag in linkenbündigen Tag-Headern unter dem Datum (z. B. Dashboard-Wochenkarten). */
export const CALENDAR_HOLIDAY_DAY_HEADER_LABEL_LEFT_CLASS =
  "max-w-full shrink-0 truncate text-left text-[10px] font-medium leading-tight text-blue-600 -mt-px";

/** Feiertag inline neben Datum (gleiche Zeile, z. B. Bereichskarten-Header). */
export const CALENDAR_HOLIDAY_DAY_HEADER_LABEL_INLINE_CLASS =
  "max-w-full shrink-0 truncate text-[10px] font-medium leading-tight text-blue-600";

export const CALENDAR_DAY_HEADER_CELL_CLASS =
  "relative flex min-h-0 flex-col items-center gap-px overflow-hidden px-1.5 pt-[3px] text-center";
