/** Kopfzeile (Datum + Wochentag) — entspricht D3_DAY_CARD_HEADER_SLOT_CLASS. */
const DAY_CARD_HEADER_MIN_REM = 4.25;

/** Innenabstand im Body (pt-4 + pb-4). */
const DAY_CARD_BODY_PADDING_REM = 2;

/** Zeilenhöhe je Einsatzort (h-5). */
const DAY_CARD_AREA_ROW_REM = 1.25;

/** Abstand zwischen Einsatzort-Zeilen (gap-y-2). */
const DAY_CARD_AREA_GAP_REM = 0.5;

/** Abstand Einsatzort-Liste → graue Footer-Linie (mt-3). */
const DAY_CARD_FOOTER_GAP_REM = 0.75;

/** Reserve für Footer (Bestätigungs-Chips, offene Slots). */
const DAY_CARD_EXTRA_BUFFER_REM = 2.125;

/** Mindesthöhe der Einsatzort-Liste im Body. */
export function dayCardAreaRowsMinHeightRem(areaCount: number): number {
  const count = Math.max(areaCount, 0);
  if (count === 0) return 1.25;
  return (
    count * DAY_CARD_AREA_ROW_REM + Math.max(0, count - 1) * DAY_CARD_AREA_GAP_REM
  );
}

/** Gesamt-Mindesthöhe einer Tag-Karte in der Wochenansicht. */
export function dayCardMinHeightRem(areaCount: number): number {
  return (
    DAY_CARD_HEADER_MIN_REM +
    DAY_CARD_BODY_PADDING_REM +
    dayCardAreaRowsMinHeightRem(areaCount) +
    DAY_CARD_FOOTER_GAP_REM +
    DAY_CARD_EXTRA_BUFFER_REM
  );
}
