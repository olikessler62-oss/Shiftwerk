import { formatDayHeader } from "@/lib/planning-utils";

export const DAY_COLUMN_NARROW_PADDING_X_PX = 10;

type DayHeaderLineStyle = "weekday" | "label" | "holiday";

/** Deterministische Breite — analog area-column-width, ohne Canvas (SSR-safe). */
function measureDayHeaderLine(
  text: string,
  style: DayHeaderLineStyle
): number {
  if (!text) return 0;

  const emScale =
    style === "weekday" ? 0.75 / 0.875 : style === "holiday" ? 0.625 / 0.875 : 1;
  const weightScale = style === "label" ? 0.97 : 1;

  let width = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    let charWidth: number;
    if (code > 0x024f) {
      charWidth = 8.75;
    } else if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      charWidth = 8.3;
    } else {
      charWidth = 7.65;
    }
    width += charWidth * emScale * weightScale;
  }
  return width;
}

/** Breiteste Header-Zeile (Wochentag, Datum, ggf. Feiertag) + Padding. */
export function resolveNarrowDayColumnWidthPx(
  dateISO: string,
  intlLocale: string,
  holidayName: string | null | undefined,
  paddingPx = DAY_COLUMN_NARROW_PADDING_X_PX
): number {
  const { weekday, label } = formatDayHeader(dateISO, intlLocale);
  const contentWidth = Math.max(
    measureDayHeaderLine(weekday, "weekday"),
    measureDayHeaderLine(label, "label"),
    holidayName ? measureDayHeaderLine(holidayName, "holiday") : 0
  );
  return Math.ceil(paddingPx + contentWidth);
}

export function resolveNarrowDayColumnWidthsPx(
  dates: readonly string[],
  holidayNamesByDate: Readonly<Record<string, string | undefined>>,
  intlLocale: string,
  paddingPx = DAY_COLUMN_NARROW_PADDING_X_PX
): number[] {
  return dates.map((date) =>
    resolveNarrowDayColumnWidthPx(
      date,
      intlLocale,
      holidayNamesByDate[date],
      paddingPx
    )
  );
}

export function narrowDayColumnGridTrack(widthPx: number): string {
  return `minmax(${widthPx}px, ${widthPx}px)`;
}
