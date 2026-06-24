"use client";

import { cn } from "@/lib/cn";
import {
  formatStaffingCount,
  STAFFING_FILL_GAUGE_SIZE_PX,
  type StaffingFillGaugeVariant,
} from "@/lib/tag-area-header-staffing-display";

export { STAFFING_FILL_GAUGE_SIZE_PX };
const STROKE_WIDTH = 2.5;

const STAFFING_FILL_GAUGE_RING_COLOR: Record<StaffingFillGaugeVariant, string> = {
  understaffed: "#dc2626",
  met: "#16a34a",
  overstaffed: "#CA8A04",
};

type Props = {
  assigned: number;
  required: number;
  label?: string | null;
  variant?: StaffingFillGaugeVariant;
  /** Größere Gauge für Dashboard-Ampel-Karten. */
  sizePx?: number;
  className?: string;
};

/** Kreisförmiger Bedarfs-Füllstand: voller Ring (rot/grün/gelb), Zähler in der Mitte. */
export function StaffingFillGauge({
  assigned,
  required,
  label,
  variant = "met",
  sizePx = STAFFING_FILL_GAUGE_SIZE_PX,
  className,
}: Props) {
  const radius = (sizePx - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = sizePx / 2;
  const countTextClass =
    sizePx >= 40
      ? "text-xs font-bold"
      : "text-[8px] font-bold";
  const ringColor = STAFFING_FILL_GAUGE_RING_COLOR[variant];
  const countText = formatStaffingCount(assigned, required);

  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-px px-0.5", className)}>
      <div
        className="relative shrink-0"
        style={{
          width: sizePx,
          height: sizePx,
        }}
        role="img"
        aria-label={label ? `${label} ${countText}` : countText}
      >
        <svg
          width={sizePx}
          height={sizePx}
          className="block -rotate-90"
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={circumference}
            strokeDashoffset={0}
          />
        </svg>
        <span
          className={cn(
            "pointer-events-none absolute inset-0 z-0 flex items-center justify-center tabular-nums leading-none",
            countTextClass,
            variant === "understaffed" && "text-red-600",
            variant === "overstaffed" && "text-black/80",
            variant === "met" && "text-foreground"
          )}
        >
          {countText}
        </span>
      </div>
      {label ? (
        <span
          className="max-w-[3.5rem] truncate text-center text-[9px] font-medium leading-none text-neutral-700"
          title={label}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
