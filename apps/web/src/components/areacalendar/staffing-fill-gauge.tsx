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
  overstaffed?: boolean;
  className?: string;
};

/** Badge-Mitte auf der Oberkante der Personalbedarf-Zeile (Datum/Header-Grenze). */
export const STAFFING_OVERSTAFFED_BADGE_ANCHOR_CLASS =
  "absolute right-0 top-0 z-[50] -translate-y-1/2";

/** Gelber Kreis mit Ausrufezeichen (Überbesetzung). */
export function StaffingOverstaffedBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const dimension = size === "md" ? "h-5 w-5 text-[11px]" : "h-3.5 w-3.5 text-[9px]";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#FFC107] font-bold leading-none text-black ring-1 ring-black/75",
        dimension,
        className
      )}
      aria-hidden
    >
      !
    </span>
  );
}

/** Kreisförmiger Bedarfs-Füllstand: Ring proportional zu assigned/required, Zähler in der Mitte. */
export function StaffingFillGauge({
  assigned,
  required,
  label,
  understaffed = false,
  overstaffed = false,
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
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-px px-0.5",
        overstaffed && "overflow-visible",
        className
      )}
    >
      <div
        className={cn("relative shrink-0", overstaffed && "overflow-visible")}
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
            "pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-[8px] font-bold tabular-nums leading-none",
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
