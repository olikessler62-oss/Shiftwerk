import {
  shiftTypeNameWithSchicht,
  shortenShiftTypeDisplayName,
} from "@/lib/profile-availability-label";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

export type StaffingHeaderDisplayLevel =
  | "full-schicht"
  | "short"
  | "abbrev"
  | "understaffed-only"
  | "indicator";

export type StaffingHeaderSegment = {
  shiftTypeId: string;
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
  const short = shortenShiftTypeDisplayName(label).trim();
  return (short.charAt(0) || "?").toUpperCase();
}

function segmentFullSchicht(
  entry: TagAreaHeaderStaffingEntry,
  shiftTypeName: string
): StaffingHeaderSegment {
  return {
    shiftTypeId: entry.shiftTypeId,
    text: `${shiftTypeNameWithSchicht(shiftTypeName)} ${formatStaffingCount(entry.assigned, entry.required)}`,
    understaffed: entry.assigned < entry.required,
  };
}

function segmentShort(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return {
    shiftTypeId: entry.shiftTypeId,
    text: `${entry.label} ${formatStaffingCount(entry.assigned, entry.required)}`,
    understaffed: entry.assigned < entry.required,
  };
}

function segmentAbbrev(entry: TagAreaHeaderStaffingEntry): StaffingHeaderSegment {
  return {
    shiftTypeId: entry.shiftTypeId,
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
  shiftTypeNameById: ReadonlyMap<string, string>,
  availableWidth: number,
  measure: (text: string) => number = measureStaffingHeaderText
): StaffingHeaderDisplay {
  if (entries.length === 0) return { mode: "empty" };

  const width = Math.max(0, availableWidth - 2);
  const hasUnderstaffed = entries.some(
    (entry) => entry.assigned < entry.required
  );

  const fullSchichtSegments = entries.map((entry) =>
    segmentFullSchicht(
      entry,
      shiftTypeNameById.get(entry.shiftTypeId) ?? entry.label
    )
  );
  const fullSchichtText = joinSegments(fullSchichtSegments, "pipe");
  if (measure(fullSchichtText) <= width) {
    return {
      mode: "segments",
      level: "full-schicht",
      segments: fullSchichtSegments,
      separator: "pipe",
    };
  }

  const shortSegments = entries.map((entry) => segmentShort(entry));
  const shortText = joinSegments(shortSegments, "pipe");
  if (measure(shortText) <= width) {
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
