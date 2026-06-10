import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

export type StaffingHeaderDisplayLevel =
  | "full-schicht"
  | "short"
  | "abbrev"
  | "understaffed-only"
  | "indicator";

export type StaffingHeaderSegment = {
  serviceHourId: string;
  text: string;
  understaffed: boolean;
};

export type StaffingHeaderDisplay =
  | { mode: "empty" }
  | {
      mode: "segments";
      level: "full-schicht" | "short";
      segments: StaffingHeaderSegment[];
      separator: "pipe";
    }
  | {
      mode: "text";
      level: "abbrev" | "understaffed-only";
      text: string;
      understaffed: boolean;
    }
  | { mode: "indicator"; allMet: boolean };

const STAFFING_HEADER_FONT =
  '500 10px Inter, ui-sans-serif, system-ui, sans-serif';

export function formatStaffingCount(
  assigned: number,
  required: number
): string {
  return `${assigned}/${required}`;
}

function abbrevLetter(label: string): string {
  const trimmed = label.trim();
  const match = trimmed.match(/\d{1,2}:\d{2}/);
  if (match) return match[0]!.slice(0, 2);
  return (trimmed.charAt(0) || "?").toUpperCase();
}

function segmentFull(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return {
    serviceHourId: entry.serviceHourId,
    text: `${entry.label} ${formatStaffingCount(entry.assigned, entry.required)}`,
    understaffed: entry.assigned < entry.required,
  };
}

function segmentShort(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return {
    serviceHourId: entry.serviceHourId,
    text: `${entry.label} ${formatStaffingCount(entry.assigned, entry.required)}`,
    understaffed: entry.assigned < entry.required,
  };
}

function segmentAbbrev(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return {
    serviceHourId: entry.serviceHourId,
    text: `${abbrevLetter(entry.label)}${formatStaffingCount(entry.assigned, entry.required)}`,
    understaffed: entry.assigned < entry.required,
  };
}

function joinSegments(
  segments: StaffingHeaderSegment[],
  separator: "pipe" | "space"
): string {
  const divider = separator === "pipe" ? " | " : " ";
  return segments.map((segment) => segment.text).join(divider);
}

/** Flex-Layout misst Pipes + gap-1 separat — für segments-Modus. */
const SEGMENT_FLEX_GAP_PX = 4;

function measureRenderedSegments(
  segments: StaffingHeaderSegment[],
  measure: (text: string) => number
): number {
  if (segments.length === 0) return 0;
  const textWidth = segments.reduce(
    (sum, segment) => sum + measure(segment.text),
    0
  );
  const pipeCount = segments.length - 1;
  const pipeWidth = pipeCount * measure("|");
  const gapCount = Math.max(0, segments.length + pipeCount - 1);
  return textWidth + pipeWidth + gapCount * SEGMENT_FLEX_GAP_PX;
}

export function measureStaffingHeaderText(text: string): number {
  if (typeof document === "undefined") return text.length * 6;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 6;
  context.font = STAFFING_HEADER_FONT;
  return context.measureText(text).width;
}

export function resolveStaffingHeaderDisplay(
  entries: readonly TagAreaHeaderStaffingEntry[],
  availableWidth: number,
  measure: (text: string) => number = measureStaffingHeaderText
): StaffingHeaderDisplay {
  if (entries.length === 0) return { mode: "empty" };

  const width = Math.max(0, availableWidth - 2);
  const hasUnderstaffed = entries.some(
    (entry) => entry.assigned < entry.required
  );

  const fullSegments = entries.map((entry) => segmentFull(entry));
  if (measureRenderedSegments(fullSegments, measure) <= width) {
    return {
      mode: "segments",
      level: "full-schicht",
      segments: fullSegments,
      separator: "pipe",
    };
  }

  const shortSegments = entries.map((entry) => segmentShort(entry));
  if (measureRenderedSegments(shortSegments, measure) <= width) {
    return {
      mode: "segments",
      level: "short",
      segments: shortSegments,
      separator: "pipe",
    };
  }

  const abbrevSegments = entries.map((entry) => segmentAbbrev(entry));
  const abbrevText = joinSegments(abbrevSegments, "pipe");
  if (measure(abbrevText) <= width) {
    return {
      mode: "text",
      level: "abbrev",
      text: abbrevText,
      understaffed: hasUnderstaffed,
    };
  }

  const understaffedSegments = entries
    .filter((entry) => entry.assigned < entry.required)
    .map((entry) => segmentAbbrev(entry));

  if (understaffedSegments.length === 0) {
    return { mode: "indicator", allMet: true };
  }

  const understaffedText = joinSegments(understaffedSegments, "space");
  if (measure(understaffedText) <= width) {
    return {
      mode: "text",
      level: "understaffed-only",
      text: understaffedText,
      understaffed: true,
    };
  }

  return { mode: "indicator", allMet: false };
}
