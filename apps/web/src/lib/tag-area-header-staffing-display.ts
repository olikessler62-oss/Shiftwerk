import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { resolveCalendarStaffingTimeLabel } from "@/lib/location-staffing-client";

export type StaffingHeaderDisplayLevel =
  | "full-schicht"
  | "short"
  | "counts-only"
  | "understaffed-only"
  | "indicator";

export type StaffingHeaderSegment = {
  serviceHourId: string;
  /** Zeit ohne Wochentag; null wenn nur Anzahl angezeigt wird. */
  timeText: string | null;
  countText: string;
  /** Kombiniert für Breitenmessung. */
  measureText: string;
  understaffed: boolean;
};

export type StaffingHeaderDisplay =
  | { mode: "empty" }
  | {
      mode: "segments";
      level: "full-schicht" | "short" | "counts-only";
      segments: StaffingHeaderSegment[];
      separator: "pipe";
    }
  | {
      mode: "text";
      level: "counts-only" | "understaffed-only";
      segments: StaffingHeaderSegment[];
      joinWith: "pipe" | "space";
      understaffed: boolean;
    }
  | { mode: "indicator"; allMet: boolean };

const STAFFING_HEADER_FONT =
  '500 10px Inter, ui-sans-serif, system-ui, sans-serif';

const STAFFING_HEADER_COUNT_FONT =
  '500 11px Inter, ui-sans-serif, system-ui, sans-serif';

export function formatStaffingCount(
  assigned: number,
  required: number
): string {
  return `${assigned}/${required}`;
}

function overlayTimeLabel(entry: TagAreaHeaderStaffingEntry): string {
  return resolveCalendarStaffingTimeLabel(entry);
}

function segmentWithTime(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  const timeText = overlayTimeLabel(entry);
  const countText = formatStaffingCount(entry.assigned, entry.required);
  return {
    serviceHourId: entry.serviceHourId,
    timeText,
    countText,
    measureText: `${timeText}: ${countText}`,
    understaffed: entry.assigned < entry.required,
  };
}

function segmentCountsOnly(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  const countText = formatStaffingCount(entry.assigned, entry.required);
  return {
    serviceHourId: entry.serviceHourId,
    timeText: null,
    countText,
    measureText: countText,
    understaffed: entry.assigned < entry.required,
  };
}

/** Flex-Layout misst Abstände zwischen Segmenten — Pipes ohne Zwischenraum. */
const SEGMENT_FLEX_GAP_PX = 4;
const STAFFING_PIPE_FLEX_GAP_PX = 0;
/** px-1 links/rechts je interaktivem Segment im segments-Modus. */
const STAFFING_SEGMENT_LABEL_PADDING_PX = 8;
/** px-1 links/rechts an der Gruppe im text-Modus. */
const STAFFING_GROUP_LABEL_PADDING_PX = 8;

function measureSegmentContent(
  segment: StaffingHeaderSegment,
  measure: (text: string) => number
): number {
  if (!segment.timeText) {
    return measureStaffingHeaderCountText(segment.countText);
  }
  return (
    measure(`${segment.timeText}:`) +
    SEGMENT_FLEX_GAP_PX +
    measureStaffingHeaderCountText(segment.countText)
  );
}

function measureRenderedSegments(
  segments: StaffingHeaderSegment[],
  measure: (text: string) => number
): number {
  if (segments.length === 0) return 0;

  const textWidth = segments.reduce(
    (sum, segment) => sum + measureSegmentContent(segment, measure),
    0
  );

  const pipeCount = segments.length - 1;
  const pipeWidth = pipeCount * measure("|");
  const gapCount = Math.max(0, segments.length + pipeCount - 1);
  const segmentPadding = segments.length * STAFFING_SEGMENT_LABEL_PADDING_PX;
  return (
    textWidth + pipeWidth + gapCount * STAFFING_PIPE_FLEX_GAP_PX + segmentPadding
  );
}

/** Entspricht StaffingOverlaySegmentGroup (nur Anzahlen, ein Tooltip). */
function measureTextModeGroup(
  segments: StaffingHeaderSegment[],
  joinWith: "pipe" | "space",
  measure: (text: string) => number
): number {
  if (segments.length === 0) return 0;

  const textWidth = segments.reduce(
    (sum, segment) => sum + measureStaffingHeaderCountText(segment.countText),
    0
  );

  const dividerCount = segments.length - 1;
  let dividerWidth = 0;
  if (dividerCount > 0) {
    dividerWidth =
      joinWith === "pipe"
        ? dividerCount * measure("|")
        : dividerCount * measureStaffingHeaderCountText(" ");
  }

  const gapCount = Math.max(0, segments.length + dividerCount - 1);
  const flexGapPx = joinWith === "pipe" ? STAFFING_PIPE_FLEX_GAP_PX : SEGMENT_FLEX_GAP_PX;
  return (
    textWidth +
    dividerWidth +
    gapCount * flexGapPx +
    STAFFING_GROUP_LABEL_PADDING_PX
  );
}

export function measureStaffingHeaderCountText(text: string): number {
  if (typeof document === "undefined") return text.length * 6.5;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 6.5;
  context.font = STAFFING_HEADER_COUNT_FONT;
  return context.measureText(text).width;
}

export function measureStaffingHeaderText(text: string): number {
  if (typeof document === "undefined") return text.length * 6;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 6;
  context.font = STAFFING_HEADER_FONT;
  return context.measureText(text).width;
}

/** Sicherheitsabzug für Padding/Abweichungen Canvas vs. gerendert. */
const STAFFING_HEADER_WIDTH_SAFETY_PX = 4;

export function resolveStaffingHeaderDisplay(
  entries: readonly TagAreaHeaderStaffingEntry[],
  availableWidth: number,
  measure: (text: string) => number = measureStaffingHeaderText
): StaffingHeaderDisplay {
  if (entries.length === 0) return { mode: "empty" };

  const width = Math.max(0, availableWidth - STAFFING_HEADER_WIDTH_SAFETY_PX);
  const hasUnderstaffed = entries.some(
    (entry) => entry.assigned < entry.required
  );

  const fullSegments = entries.map((entry) => segmentWithTime(entry));
  if (measureRenderedSegments(fullSegments, measure) <= width) {
    return {
      mode: "segments",
      level: "full-schicht",
      segments: fullSegments,
      separator: "pipe",
    };
  }

  const shortSegments = entries.map((entry) => segmentWithTime(entry));
  if (measureRenderedSegments(shortSegments, measure) <= width) {
    return {
      mode: "segments",
      level: "short",
      segments: shortSegments,
      separator: "pipe",
    };
  }

  const countSegments = entries.map((entry) => segmentCountsOnly(entry));
  if (measureRenderedSegments(countSegments, measure) <= width) {
    return {
      mode: "segments",
      level: "counts-only",
      segments: countSegments,
      separator: "pipe",
    };
  }

  if (measureTextModeGroup(countSegments, "pipe", measure) <= width) {
    return {
      mode: "text",
      level: "counts-only",
      segments: countSegments,
      joinWith: "pipe",
      understaffed: hasUnderstaffed,
    };
  }

  const understaffedSegments = entries
    .filter((entry) => entry.assigned < entry.required)
    .map((entry) => segmentCountsOnly(entry));

  if (understaffedSegments.length === 0) {
    return { mode: "indicator", allMet: true };
  }

  if (measureTextModeGroup(understaffedSegments, "space", measure) <= width) {
    return {
      mode: "text",
      level: "understaffed-only",
      segments: understaffedSegments,
      joinWith: "space",
      understaffed: true,
    };
  }

  return { mode: "indicator", allMet: false };
}
