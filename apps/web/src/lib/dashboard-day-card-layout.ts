import type { DashboardExtDaySnapshot } from "@/lib/dashboard-ext-panel-data";
import { resolveDashboardAreaStatusFooterLines } from "@/lib/dashboard-area-status-footer-lines";

/** Kopfzeile (Datum + Wochentag) — entspricht D3_DAY_CARD_HEADER_SLOT_CLASS. */
const DAY_CARD_HEADER_MIN_REM = 4.25;

/** Innenabstand im Body (pt-4 + pb-4). */
const DAY_CARD_BODY_PADDING_REM = 2;

/** Zeilenhöhe je Einsatzbereich (h-6). */
const DAY_CARD_AREA_ROW_REM = 1.5;

/** Abstand zwischen Einsatzbereich-Zeilen (gap-y-2). */
const DAY_CARD_AREA_GAP_REM = 0.5;

/** Abstand Einsatzbereich-Liste → graue Footer-Linie (mt-3). */
const DAY_CARD_FOOTER_GAP_REM = 0.75;

/** Reserve für Footer (Bestätigungs-Chips, offene Slots). */
const DAY_CARD_EXTRA_BUFFER_REM = 2.125;

/** Footer-Rand + Abstand (mt-3, pt-3). */
const DAY_CARD_FOOTER_BORDER_BLOCK_REM = 1.5;

/** Bereichsüberschrift im Footer (text-[11px] leading-none). */
const DAY_CARD_FOOTER_SECTION_HEADING_REM = 0.6875;

/** Abstand Überschrift → Statuszeilen (mt-0.5). */
const DAY_CARD_FOOTER_SECTION_LINES_OFFSET_REM = 0.125;

/** Eine Statuszeile (text-xs leading-none). */
const DAY_CARD_FOOTER_LINE_REM = 0.75;

/** Abstand zwischen Statuszeilen (gap-0.5). */
const DAY_CARD_FOOTER_LINE_GAP_REM = 0.125;

/** Abstand zwischen Footer-Bereichen (gap-1.5). */
const DAY_CARD_FOOTER_AREA_GAP_REM = 0.375;

/** Mindesthöhe der Einsatzbereich-Liste im Body. */
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

export function dayCardHasShiftContent(day: DashboardExtDaySnapshot): boolean {
  return day.hasServiceHours && day.shiftCount > 0;
}

function resolveDayCardFooterSections(
  day: DashboardExtDaySnapshot,
  shiftConfirmationEnabled: boolean
): { lines: readonly unknown[] }[] {
  return day.areas
    .map((area) => ({
      lines: resolveDashboardAreaStatusFooterLines({
        openSlots: area.openSlots,
        shiftConfirmationEnabled,
        shiftCount: area.shiftCount,
        confirmationCounts: area.confirmationCounts,
        swapRequestedCount: area.swapRequestedCount,
      }),
    }))
    .filter((section) => section.lines.length > 0);
}

/** Geschätzte Footer-Höhe aus sichtbaren Bereichs-Statuszeilen. */
export function dayCardFooterHeightRem(
  sections: readonly { lines: readonly unknown[] }[]
): number {
  if (sections.length === 0) return 0;

  let heightRem = DAY_CARD_FOOTER_BORDER_BLOCK_REM;

  for (let index = 0; index < sections.length; index += 1) {
    if (index > 0) {
      heightRem += DAY_CARD_FOOTER_AREA_GAP_REM;
    }

    heightRem += DAY_CARD_FOOTER_SECTION_HEADING_REM;

    const lineCount = sections[index].lines.length;
    if (lineCount > 0) {
      heightRem += DAY_CARD_FOOTER_SECTION_LINES_OFFSET_REM;
      heightRem +=
        lineCount * DAY_CARD_FOOTER_LINE_REM +
        Math.max(0, lineCount - 1) * DAY_CARD_FOOTER_LINE_GAP_REM;
    }
  }

  return heightRem;
}

/** Geschätzte Gesamthöhe einer Tag-Karte mit Schichten (inkl. Footer). */
export function dayCardEstimatedHeightRem(
  day: DashboardExtDaySnapshot,
  shiftConfirmationEnabled: boolean
): number {
  const footerSections = resolveDayCardFooterSections(day, shiftConfirmationEnabled);
  const footerHeightRem =
    footerSections.length > 0
      ? dayCardFooterHeightRem(footerSections)
      : DAY_CARD_EXTRA_BUFFER_REM;

  return (
    DAY_CARD_HEADER_MIN_REM +
    DAY_CARD_BODY_PADDING_REM +
    dayCardAreaRowsMinHeightRem(day.areas.length) +
    DAY_CARD_FOOTER_GAP_REM +
    footerHeightRem
  );
}

/**
 * Mindesthöhe für Tag-Karten ohne Servicezeiten oder ohne Schichten im Wochentray:
 * mindestens so hoch wie die kürzeste Karte mit Schichten in derselben Woche.
 */
export function weekTrayEmptyDayCardMinHeightRem(
  days: readonly DashboardExtDaySnapshot[],
  shiftConfirmationEnabled: boolean,
  fallbackAreaCount: number
): number {
  const shiftDayHeights = days
    .filter(dayCardHasShiftContent)
    .map((day) => dayCardEstimatedHeightRem(day, shiftConfirmationEnabled));

  if (shiftDayHeights.length === 0) {
    return dayCardMinHeightRem(fallbackAreaCount);
  }

  return Math.min(...shiftDayHeights);
}
