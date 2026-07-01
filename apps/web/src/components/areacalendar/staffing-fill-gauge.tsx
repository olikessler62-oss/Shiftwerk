"use client";

import { cn } from "@/lib/cn";
import {
  formatStaffingCount,
  STAFFING_FILL_GAUGE_SIZE_PX,
  type StaffingFillGaugeVariant,
} from "@/lib/tag-area-header-staffing-display";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";

export { STAFFING_FILL_GAUGE_SIZE_PX };

function staffingFillGaugeStrokeWidth(sizePx: number): number {
  if (sizePx <= 20) return 1.5;
  if (sizePx < 36) return 2;
  return 2.5;
}

function staffingFillGaugeCountTextClass(sizePx: number): string {
  if (sizePx >= 40) return "text-xs font-bold";
  if (sizePx <= 20) return "text-[10px] font-bold";
  return "text-[9px] font-bold";
}

const STAFFING_FILL_GAUGE_RING_COLOR: Record<StaffingFillGaugeVariant, string> = {
  understaffed: "#dc2626",
  planned: "#FFCC00",
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
  const strokeWidth = staffingFillGaugeStrokeWidth(sizePx);
  const radius = (sizePx - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = sizePx / 2;
  const countTextClass = staffingFillGaugeCountTextClass(sizePx);
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
            fill={variant === "planned" ? ringColor : "none"}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={variant === "planned" ? undefined : circumference}
            strokeDashoffset={0}
          />
        </svg>
        <span
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center tabular-nums leading-none",
            countTextClass,
            variant === "understaffed" && "text-red-600",
            (variant === "planned" || variant === "overstaffed") &&
              STAFFING_OCHER_TEXT_CLASS,
            variant === "met" && "text-foreground"
          )}
        >
          {countText}
        </span>
      </div>
      {label ? (
        <span
          className="block max-w-[3.5rem] truncate pb-px text-center text-[9px] font-medium leading-tight text-neutral-700"
          title={label}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
