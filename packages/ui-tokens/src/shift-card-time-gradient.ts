/** Tageszeit-Bänder für Schichtkarten-Hintergrund (Minuten 0–1440). */
import {
  buildShiftCardSurfaceGradientCss,
  isCssGradientColor,
} from "./shift-card-color-gradient";

export const SHIFT_CARD_TIME_BANDS = [
  { start: 0, end: 4 * 60, rgb: [192, 192, 192] as const }, // 00:00–04:00 Silber
  { start: 4 * 60, end: 10 * 60, rgb: [125, 211, 252] as const }, // 04:00–10:00 Hellblau
  { start: 9 * 60 + 30, end: 16 * 60 + 30, rgb: [253, 224, 71] as const }, // 09:30–16:30 Gelb
  { start: 16 * 60, end: 20 * 60, rgb: [248, 113, 113] as const }, // 16:00–20:00 Rot
  { start: 20 * 60, end: 24 * 60, rgb: [192, 192, 192] as const }, // 20:00–24:00 Silber
] as const;

export const SHIFT_CARD_TIME_GRADIENT_OPACITY = 0.4;
export const SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX = 6;

/**
 * UX-Experiment: Tageszeit-Farbverläufe auf Schichtkarten (Dashboard, Bereich-Kalender, Mobile).
 * `false` = weiße Karten; Status-Overlays (requested, canceled, …) bleiben aktiv.
 */
export const SHIFT_CARD_TIME_GRADIENT_ENABLED = false;

const SHIFT_CARD_PLAIN_WHITE_GRADIENT_CSS =
  "linear-gradient(to bottom, #ffffff 0%, #ffffff 100%)";

const MINUTES_PER_DAY = 24 * 60;

type Rgb = readonly [number, number, number];

export function parseClockTimeToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeMinute(minute: number): number {
  return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function activeBandColorsAtMinute(minute: number): Rgb[] {
  const m = normalizeMinute(minute);
  return SHIFT_CARD_TIME_BANDS.filter((band) => m >= band.start && m < band.end).map(
    (band) => band.rgb
  );
}

function averageRgb(colors: readonly Rgb[]): Rgb {
  if (colors.length === 0) return [255, 255, 255];
  const sum = colors.reduce(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b] as const,
    [0, 0, 0] as const
  );
  return [
    Math.round(sum[0] / colors.length),
    Math.round(sum[1] / colors.length),
    Math.round(sum[2] / colors.length),
  ] as const;
}

function colorAtMinute(minute: number): Rgb {
  return averageRgb(activeBandColorsAtMinute(minute));
}

function toRgba([r, g, b]: Rgb, alpha = SHIFT_CARD_TIME_GRADIENT_OPACITY): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveShiftMinuteRange(
  startTime: string,
  endTime: string
): { startMin: number; endMin: number } {
  const startMin = parseClockTimeToMinutes(startTime);
  let endMin = parseClockTimeToMinutes(endTime);
  if (endMin <= startMin) {
    endMin += MINUTES_PER_DAY;
  }
  return { startMin, endMin };
}

function collectTimelineBreakpoints(startMin: number, endMin: number): number[] {
  const breaks = new Set<number>([startMin, endMin]);
  const firstDay = Math.floor(startMin / MINUTES_PER_DAY);
  const lastDay = Math.floor((endMin - 1) / MINUTES_PER_DAY);

  for (let day = firstDay; day <= lastDay; day++) {
    const dayOffset = day * MINUTES_PER_DAY;
    for (const band of SHIFT_CARD_TIME_BANDS) {
      for (const edge of [band.start, band.end]) {
        const absolute = dayOffset + edge;
        if (absolute > startMin && absolute < endMin) {
          breaks.add(absolute);
        }
      }
    }
  }

  return [...breaks].sort((a, b) => a - b);
}

export type ShiftCardGradientStop = {
  /** Anteil 0–100 entlang der Schichtdauer. */
  positionPercent: number;
  color: Rgb;
  durationMinutes: number;
};

/** Anteilige Farbstops links→rechts entlang der Schichtzeit. */
export function buildShiftCardGradientStops(
  startTime: string,
  endTime: string
): ShiftCardGradientStop[] {
  const { startMin, endMin } = resolveShiftMinuteRange(startTime, endTime);
  const duration = endMin - startMin;
  if (duration <= 0) {
    const color = colorAtMinute(startMin);
    return [{ positionPercent: 0, color, durationMinutes: 0 }];
  }

  const breakpoints = collectTimelineBreakpoints(startMin, endMin);
  const stops: ShiftCardGradientStop[] = [];
  let elapsed = 0;

  for (let index = 0; index < breakpoints.length - 1; index++) {
    const segmentStart = breakpoints[index]!;
    const segmentEnd = breakpoints[index + 1]!;
    const segmentDuration = segmentEnd - segmentStart;
    const midpoint = segmentStart + segmentDuration / 2;
    const color = colorAtMinute(midpoint);
    const positionPercent = (elapsed / duration) * 100;

    stops.push({
      positionPercent,
      color,
      durationMinutes: segmentDuration,
    });

    elapsed += segmentDuration;
  }

  if (stops.length === 0) {
    return [{ positionPercent: 0, color: colorAtMinute(startMin), durationMinutes: duration }];
  }

  const last = stops[stops.length - 1]!;
  stops.push({
    positionPercent: 100,
    color: last.color,
    durationMinutes: 0,
  });

  return stops;
}

export function buildShiftCardTimeGradientCss(
  startTime: string,
  endTime: string,
  opacity = SHIFT_CARD_TIME_GRADIENT_OPACITY,
  employeeColor?: string
): string {
  if (!SHIFT_CARD_TIME_GRADIENT_ENABLED) {
    const color = employeeColor?.trim();
    if (color) {
      return buildShiftCardSurfaceGradientCss(color);
    }
    return SHIFT_CARD_PLAIN_WHITE_GRADIENT_CSS;
  }

  const stops = buildShiftCardGradientStops(startTime, endTime);
  if (stops.length === 1) {
    const color = toRgba(stops[0]!.color, opacity);
    return `linear-gradient(to right, ${color} 0%, ${color} 100%)`;
  }

  const parts = stops.map(
    (stop) => `${toRgba(stop.color, opacity)} ${stop.positionPercent.toFixed(4)}%`
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

export type ShiftCardLinearGradient = {
  colors: string[];
  locations: number[];
};

/** Farbstops für React Native `LinearGradient` (horizontal, links→rechts). */
export function buildShiftCardLinearGradient(
  startTime: string,
  endTime: string,
  opacity = SHIFT_CARD_TIME_GRADIENT_OPACITY,
  employeeColor?: string
): ShiftCardLinearGradient {
  if (!SHIFT_CARD_TIME_GRADIENT_ENABLED) {
    const color = employeeColor?.trim();
    if (color && !isCssGradientColor(color)) {
      const css = buildShiftCardSurfaceGradientCss(color);
      return { colors: [css, css], locations: [0, 1] };
    }
    return { colors: ["#ffffff", "#ffffff"], locations: [0, 1] };
  }

  const stops = buildShiftCardGradientStops(startTime, endTime);
  if (stops.length === 1) {
    const color = toRgba(stops[0]!.color, opacity);
    return { colors: [color, color], locations: [0, 1] };
  }

  return {
    colors: stops.map((stop) => toRgba(stop.color, opacity)),
    locations: stops.map((stop) => stop.positionPercent / 100),
  };
}

/** Farbverlauf für eine Hälfte einer Nachtschicht (Von-Tag / Bis-Tag). */
export function buildPlanningShiftSegmentGradientCss(
  part: "full" | "overnight-start" | "overnight-end",
  startTime: string,
  endTime: string,
  opacity = SHIFT_CARD_TIME_GRADIENT_OPACITY,
  employeeColor?: string
): string {
  if (part === "full") {
    return buildShiftCardTimeGradientCss(startTime, endTime, opacity, employeeColor);
  }
  if (part === "overnight-start") {
    return buildShiftCardTimeGradientCss(startTime, "23:59", opacity, employeeColor);
  }
  return buildShiftCardTimeGradientCss("00:00", endTime, opacity, employeeColor);
}
