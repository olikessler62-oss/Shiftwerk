"use client";

import { cn } from "@/lib/cn";
import { formatStaffingCount, STAFFING_FILL_GAUGE_SIZE_PX } from "@/lib/tag-area-header-staffing-display";

export { STAFFING_FILL_GAUGE_SIZE_PX };
const STROKE_WIDTH = 2.5;

type Props = {
  assigned: number;
  required: number;
  label?: string | null;
  understaffed?: boolean;
  className?: string;
};

/** Kreisförmiger Bedarfs-Füllstand: Ring proportional zu assigned/required, Zähler in der Mitte. */
export function StaffingFillGauge({
  assigned,
  required,
  label,
  understaffed = false,
  className,
}: Props) {
  const ratio =
    required > 0 ? Math.min(1, assigned / required) : assigned > 0 ? 1 : 0;
  const radius = (STAFFING_FILL_GAUGE_SIZE_PX - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const center = STAFFING_FILL_GAUGE_SIZE_PX / 2;

  const progressColor = understaffed ? "#dc2626" : "#16a34a";
  const trackColor = understaffed ? "#dc2626" : "#334155";
  const countText = formatStaffingCount(assigned, required);

  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-px px-0.5", className)}>
      <div
        className="relative shrink-0"
        style={{
          width: STAFFING_FILL_GAUGE_SIZE_PX,
          height: STAFFING_FILL_GAUGE_SIZE_PX,
        }}
        role="img"
        aria-label={label ? `${label} ${countText}` : countText}
      >
        <svg
          width={STAFFING_FILL_GAUGE_SIZE_PX}
          height={STAFFING_FILL_GAUGE_SIZE_PX}
          className="block -rotate-90"
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE_WIDTH}
          />
          {ratio > 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={progressColor}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          ) : null}
        </svg>
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold tabular-nums leading-none",
            understaffed ? "text-red-600" : "text-foreground"
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
