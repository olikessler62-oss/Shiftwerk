import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { resolveCalendarStaffingTimeLabel } from "@/lib/location-staffing-client";

export const STAFFING_FILL_GAUGE_SIZE_PX = 24;

export type StaffingHeaderDisplayLevel =
  | "full-schicht"
  | "counts-only"
  | "indicator";

export type StaffingHeaderSegment = {
  serviceHourId: string;
  /** Schichtname oder Uhrzeit unter dem Füllstand; null = nur Kreis. */
  timeText: string | null;
  countText: string;
  /** Kombiniert für Breitenmessung (Legacy / Tooltip). */
  measureText: string;
  understaffed: boolean;
  overstaffed: boolean;
  /** Genug Schichten, aber Funktionen passen nicht zum Bedarf. */
  assignmentMismatch: boolean;
  assigned: number;
  required: number;
};

export type StaffingHeaderDisplay =
  | { mode: "empty" }
  | {
      mode: "gauges";
      level: "full-schicht" | "counts-only";
      segments: StaffingHeaderSegment[];
    }
  | { mode: "indicator"; allMet: boolean; hasOverstaffed: boolean };

const STAFFING_GAUGE_LABEL_FONT =
  '500 9px Inter, ui-sans-serif, system-ui, sans-serif';

const STAFFING_GAUGE_COLUMN_GAP_PX = 4;
const STAFFING_GAUGE_COLUMN_HORIZONTAL_PADDING_PX = 4;

function measureStaffingHeaderTextWithFont(
  text: string,
  font: string,
  fallbackCharWidth: number
): number {
  if (typeof document === "undefined") return text.length * fallbackCharWidth;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * fallbackCharWidth;
  context.font = font;
  return context.measureText(text).width;
}

export function formatStaffingCount(
  assigned: number,
  required: number
): string {
  return `${assigned}/${required}`;
}

/** Mehr Einsätze als Bedarf (gesamt oder je Funktion im Fenster). */
export function isTagAreaHeaderStaffingEntryOverstaffed(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  if (
    entry.qualifications?.some(
      (qualification) =>
        qualification.required > 0 &&
        qualification.assigned > qualification.required
    )
  ) {
    return true;
  }
  return entry.required > 0 && entry.assigned > entry.required;
}

/** Mindestens eine Funktion im Fenster nicht gedeckt (wie Personalbedarf-Tabelle). */
export function isTagAreaHeaderStaffingEntryUnderstaffed(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  const qualifications =
    entry.qualifications?.filter((qualification) => qualification.required > 0) ??
    [];
  if (qualifications.length > 0) {
    return qualifications.some(
      (qualification) => qualification.assigned < qualification.required
    );
  }
  return entry.required > 0 && entry.assigned < entry.required;
}

export function isTagAreaHeaderStaffingUnderstaffed(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some(isTagAreaHeaderStaffingEntryUnderstaffed);
}

/** Unterbesetzt, aber Schichtanzahl im Fenster deckt Gesamtbedarf (falsche Funktionen). */
export function isTagAreaHeaderStaffingEntryAssignmentMismatch(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  return (
    isTagAreaHeaderStaffingEntryUnderstaffed(entry) &&
    entry.required > 0 &&
    entry.assigned >= entry.required
  );
}

export function isTagAreaHeaderStaffingAssignmentMismatch(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some(isTagAreaHeaderStaffingEntryAssignmentMismatch);
}

export function isTagAreaHeaderStaffingOverstaffed(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some(isTagAreaHeaderStaffingEntryOverstaffed);
}

/** Überbesetzung oder falsche Funktionen — Badge auf der Datum/Bedarf-Grenze. */
export function isTagAreaHeaderStaffingHeaderAlertBadge(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return (
    isTagAreaHeaderStaffingOverstaffed(entries) ||
    isTagAreaHeaderStaffingAssignmentMismatch(entries)
  );
}

/** Schichtanzahl im Fenster vs. Gesamtbedarf (nicht nur gemappte Funktions-Zählung). */
export function gaugeCountsForTagAreaHeaderStaffingEntry(
  entry: TagAreaHeaderStaffingEntry
): { assigned: number; required: number } {
  return { assigned: entry.assigned, required: entry.required };
}

function overlayTimeLabel(entry: TagAreaHeaderStaffingEntry): string {
  return resolveCalendarStaffingTimeLabel(entry);
}

function segmentWithTime(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  const timeText = overlayTimeLabel(entry);
  const { assigned, required } = gaugeCountsForTagAreaHeaderStaffingEntry(entry);
  const countText = formatStaffingCount(assigned, required);
  return {
    serviceHourId: entry.serviceHourId,
    timeText,
    countText,
    measureText: `${timeText}: ${countText}`,
    understaffed: isTagAreaHeaderStaffingEntryUnderstaffed(entry),
    overstaffed: isTagAreaHeaderStaffingEntryOverstaffed(entry),
    assignmentMismatch: isTagAreaHeaderStaffingEntryAssignmentMismatch(entry),
    assigned,
    required,
  };
}

function segmentCountsOnly(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  const { assigned, required } = gaugeCountsForTagAreaHeaderStaffingEntry(entry);
  const countText = formatStaffingCount(assigned, required);
  return {
    serviceHourId: entry.serviceHourId,
    timeText: null,
    countText,
    measureText: countText,
    understaffed: isTagAreaHeaderStaffingEntryUnderstaffed(entry),
    overstaffed: isTagAreaHeaderStaffingEntryOverstaffed(entry),
    assignmentMismatch: isTagAreaHeaderStaffingEntryAssignmentMismatch(entry),
    assigned,
    required,
  };
}

function measureGaugeLabel(text: string): number {
  return measureStaffingHeaderTextWithFont(text, STAFFING_GAUGE_LABEL_FONT, 5.5);
}

function measureGaugeColumn(label: string | null): number {
  if (!label) {
    return (
      STAFFING_FILL_GAUGE_SIZE_PX +
      STAFFING_GAUGE_COLUMN_HORIZONTAL_PADDING_PX * 2
    );
  }

  return (
    Math.max(STAFFING_FILL_GAUGE_SIZE_PX, measureGaugeLabel(label)) +
    STAFFING_GAUGE_COLUMN_HORIZONTAL_PADDING_PX * 2
  );
}

function measureGaugeRow(
  segments: StaffingHeaderSegment[],
  showLabels: boolean
): number {
  if (segments.length === 0) return 0;

  const columnWidths = segments.map((segment) =>
    measureGaugeColumn(showLabels ? segment.timeText : null)
  );
  const gapWidth = Math.max(0, segments.length - 1) * STAFFING_GAUGE_COLUMN_GAP_PX;
  return columnWidths.reduce((sum, width) => sum + width, 0) + gapWidth;
}

/** Sicherheitsabzug für Padding/Abweichungen Canvas vs. gerendert. */
const STAFFING_HEADER_WIDTH_SAFETY_PX = 4;

/** @deprecated Nur noch für Tests — Füllstandsanzeiger nutzen feste Spaltenbreite. */
export function measureStaffingHeaderCountText(text: string): number {
  return text.length * 7;
}

/** @deprecated Nur noch für Tests — Füllstandsanzeiger nutzen measureGaugeRow. */
export function measureStaffingHeaderText(text: string): number {
  return measureGaugeLabel(text);
}

export function resolveStaffingHeaderDisplay(
  entries: readonly TagAreaHeaderStaffingEntry[],
  availableWidth: number
): StaffingHeaderDisplay {
  if (entries.length === 0) return { mode: "empty" };

  const width = Math.max(0, availableWidth - STAFFING_HEADER_WIDTH_SAFETY_PX);
  const hasUnderstaffed = isTagAreaHeaderStaffingUnderstaffed(entries);
  const hasOverstaffed = isTagAreaHeaderStaffingOverstaffed(entries);

  const fullSegments = entries.map((entry) => segmentWithTime(entry));
  if (measureGaugeRow(fullSegments, true) <= width) {
    return {
      mode: "gauges",
      level: "full-schicht",
      segments: fullSegments,
    };
  }

  const countSegments = entries.map((entry) => segmentCountsOnly(entry));
  if (measureGaugeRow(countSegments, false) <= width) {
    return {
      mode: "gauges",
      level: "counts-only",
      segments: countSegments,
    };
  }

  return { mode: "indicator", allMet: !hasUnderstaffed, hasOverstaffed };
}
