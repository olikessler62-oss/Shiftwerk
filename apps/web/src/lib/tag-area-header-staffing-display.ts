import type {
  StaffingQualificationCoverage,
  TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import { resolveCalendarStaffingTimeLabel } from "@/lib/location-staffing-client";

export const STAFFING_FILL_GAUGE_SIZE_PX = 24;

export type StaffingFillGaugeVariant =
  | "understaffed"
  | "planned"
  | "met"
  | "overstaffed";

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
  /** Geplant, aber noch nicht bestätigt — würde Bedarf decken. */
  plannedCoverage: boolean;
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
  | { mode: "indicator"; allMet: boolean; hasOverstaffed: boolean; hasPlannedCoverage: boolean };

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
  entry: TagAreaHeaderStaffingEntry,
  coverage: "confirmed" | "projected" = "confirmed"
): boolean {
  const qualifications =
    (coverage === "projected"
      ? entry.projectedQualifications ?? entry.qualifications
      : entry.qualifications
    )?.filter((qualification) => qualification.required > 0) ?? [];
  const assigned =
    coverage === "projected"
      ? (entry.projectedAssigned ?? entry.assigned)
      : entry.assigned;
  if (
    qualifications.some(
      (qualification) => qualification.assigned > qualification.required
    )
  ) {
    return true;
  }
  return entry.required > 0 && assigned > entry.required;
}

function staffingCoverageUnderstaffed(
  assigned: number,
  required: number,
  qualifications?: StaffingQualificationCoverage[]
): boolean {
  const qualRows =
    qualifications?.filter((qualification) => qualification.required > 0) ?? [];
  if (qualRows.length > 0) {
    return qualRows.some(
      (qualification) => qualification.assigned < qualification.required
    );
  }
  return required > 0 && assigned < required;
}

function staffingCoverageAssignmentMismatch(
  assigned: number,
  required: number,
  qualifications?: StaffingQualificationCoverage[]
): boolean {
  return (
    staffingCoverageUnderstaffed(assigned, required, qualifications) &&
    required > 0 &&
    assigned >= required
  );
}

function confirmedCoverageForEntry(entry: TagAreaHeaderStaffingEntry): {
  assigned: number;
  qualifications?: StaffingQualificationCoverage[];
} {
  return {
    assigned: entry.assigned,
    qualifications: entry.qualifications,
  };
}

function projectedCoverageForEntry(entry: TagAreaHeaderStaffingEntry): {
  assigned: number;
  qualifications?: StaffingQualificationCoverage[];
} {
  return {
    assigned: entry.projectedAssigned ?? entry.assigned,
    qualifications: entry.projectedQualifications ?? entry.qualifications,
  };
}

/** Mindestens eine Funktion im Fenster nicht gedeckt (projiziert = echter Engpass). */
export function isTagAreaHeaderStaffingEntryUnderstaffed(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  const projected = projectedCoverageForEntry(entry);
  return staffingCoverageUnderstaffed(
    projected.assigned,
    entry.required,
    projected.qualifications
  );
}

function isTagAreaHeaderStaffingEntryConfirmedUnderstaffed(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  const confirmed = confirmedCoverageForEntry(entry);
  return staffingCoverageUnderstaffed(
    confirmed.assigned,
    entry.required,
    confirmed.qualifications
  );
}

export function isTagAreaHeaderStaffingUnderstaffed(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some(isTagAreaHeaderStaffingEntryUnderstaffed);
}

/** Unterbesetzt (bestätigt), aber Schichtanzahl im Fenster deckt Gesamtbedarf (falsche Funktionen). */
export function isTagAreaHeaderStaffingEntryAssignmentMismatch(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  const confirmed = confirmedCoverageForEntry(entry);
  return staffingCoverageAssignmentMismatch(
    confirmed.assigned,
    entry.required,
    confirmed.qualifications
  );
}

/** Geplant würde Bedarf decken, bestätigt noch nicht vollständig. */
export function isTagAreaHeaderStaffingEntryPlannedCoverage(
  entry: TagAreaHeaderStaffingEntry
): boolean {
  if (entry.required <= 0) return false;
  if (isTagAreaHeaderStaffingEntryUnderstaffed(entry)) return false;
  if (isTagAreaHeaderStaffingEntryOverstaffed(entry)) return false;

  const projected = projectedCoverageForEntry(entry);
  if (
    staffingCoverageAssignmentMismatch(
      projected.assigned,
      entry.required,
      projected.qualifications
    )
  ) {
    return false;
  }

  return (
    isTagAreaHeaderStaffingEntryConfirmedUnderstaffed(entry) ||
    isTagAreaHeaderStaffingEntryAssignmentMismatch(entry)
  );
}

export function isTagAreaHeaderStaffingPlannedCoverage(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return entries.some(isTagAreaHeaderStaffingEntryPlannedCoverage);
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

export function resolveStaffingFillGaugeVariant(
  segment: Pick<
    StaffingHeaderSegment,
    | "understaffed"
    | "overstaffed"
    | "assignmentMismatch"
    | "plannedCoverage"
  >
): StaffingFillGaugeVariant {
  if (segment.assignmentMismatch || segment.overstaffed) {
    return "overstaffed";
  }
  if (segment.understaffed) {
    return "understaffed";
  }
  if (segment.plannedCoverage) {
    return "planned";
  }
  return "met";
}

/** Überbesetzung oder falsche Funktionen — früher Badge auf der Datum/Bedarf-Grenze. */
export function isTagAreaHeaderStaffingHeaderAlertBadge(
  entries: readonly TagAreaHeaderStaffingEntry[]
): boolean {
  return (
    isTagAreaHeaderStaffingOverstaffed(entries) ||
    isTagAreaHeaderStaffingAssignmentMismatch(entries)
  );
}

/** Schichtanzahl im Fenster vs. Gesamtbedarf — tatsächliche (projizierte) Anzahl, nicht auf Bedarf kappen. */
export function gaugeCountsForTagAreaHeaderStaffingEntry(
  entry: TagAreaHeaderStaffingEntry
): { assigned: number; required: number } {
  const required = entry.required;
  const projected = entry.projectedAssigned ?? entry.assigned;
  if (isTagAreaHeaderStaffingEntryPlannedCoverage(entry)) {
    return { assigned: projected, required };
  }
  if (
    isTagAreaHeaderStaffingEntryOverstaffed(entry, "projected") &&
    projected > entry.assigned
  ) {
    return { assigned: projected, required };
  }
  return { assigned: entry.assigned, required };
}

function overlayTimeLabel(entry: TagAreaHeaderStaffingEntry): string {
  return resolveCalendarStaffingTimeLabel(entry);
}

function segmentFromEntry(
  entry: TagAreaHeaderStaffingEntry,
  timeText: string | null
): StaffingHeaderSegment {
  const { assigned, required } = gaugeCountsForTagAreaHeaderStaffingEntry(entry);
  const countText = formatStaffingCount(assigned, required);
  const understaffed = isTagAreaHeaderStaffingEntryUnderstaffed(entry);
  const overstaffed = isTagAreaHeaderStaffingEntryOverstaffed(entry);
  const assignmentMismatch = isTagAreaHeaderStaffingEntryAssignmentMismatch(entry);
  const plannedCoverage = isTagAreaHeaderStaffingEntryPlannedCoverage(entry);
  return {
    serviceHourId: entry.serviceHourId,
    timeText,
    countText,
    measureText: timeText ? `${timeText}: ${countText}` : countText,
    understaffed,
    overstaffed,
    assignmentMismatch,
    plannedCoverage,
    assigned,
    required,
  };
}

function segmentWithTime(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return segmentFromEntry(entry, overlayTimeLabel(entry));
}

function segmentCountsOnly(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return segmentFromEntry(entry, null);
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
  const hasPlannedCoverage = isTagAreaHeaderStaffingPlannedCoverage(entries);

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

  return {
    mode: "indicator",
    allMet: !hasUnderstaffed && !hasPlannedCoverage,
    hasOverstaffed,
    hasPlannedCoverage,
  };
}
