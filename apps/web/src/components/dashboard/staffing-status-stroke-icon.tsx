import { cn } from "@/lib/cn";
import type { DashboardAreaAmpelLevel } from "@/lib/dashboard-ext-panel-data";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";

const ICON_SIZE_CLASS = "h-5 w-5 shrink-0";

const STROKE_COLOR: Record<DashboardAreaAmpelLevel, string> = {
  met: "text-green-600",
  partial: STAFFING_OCHER_TEXT_CLASS,
  critical: "text-red-600",
  no_demand: "text-slate-400",
  overstaffed_only: "text-blue-600",
};

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CX = 12;
const CY = 12;
const R = 9;

export function staffingStatusStrokeAriaLabel(
  level: DashboardAreaAmpelLevel
): string {
  const labels: Record<DashboardAreaAmpelLevel, string> = {
    met: "Vollständig besetzt",
    no_demand: "Kein Bedarf",
    partial: "Teilweise besetzt",
    critical: "Kritisch – offen",
    overstaffed_only: "Überbesetzt",
  };
  return labels[level];
}

function StrokeIconBody({ level }: { level: DashboardAreaAmpelLevel }) {
  switch (level) {
    case "met":
      return (
        <>
          <circle cx={CX} cy={CY} r={R} />
          <path d="m8.25 12.25 2.25 2.25 5.25-5.5" />
        </>
      );
    case "partial":
      return (
        <>
          <circle cx={CX} cy={CY} r={R} opacity={0.22} />
          <path d="M12 3a9 9 0 1 1-4.24 15.55" />
        </>
      );
    case "critical":
      return (
        <>
          <circle cx={CX} cy={CY} r={R} />
          <path d="m15.25 8.75-6.5 6.5M8.75 8.75l6.5 6.5" />
        </>
      );
    case "no_demand":
      return (
        <>
          <circle cx={CX} cy={CY} r={R} strokeDasharray="3.25 2.75" opacity={0.75} />
          <path d="M8.5 12h7" />
        </>
      );
    case "overstaffed_only":
      return (
        <>
          <circle cx={CX} cy={CY} r={R} />
          <path d="M12 8.75v6.5M8.75 12h6.5" />
        </>
      );
  }
}

export function StaffingStatusStrokeIcon({
  level,
  muted,
  className,
}: {
  level: DashboardAreaAmpelLevel;
  muted?: boolean;
  className?: string;
}) {
  return (
    <svg
      {...SVG_PROPS}
      className={cn(
        ICON_SIZE_CLASS,
        STROKE_COLOR[level],
        muted && "opacity-40",
        className
      )}
      aria-label={staffingStatusStrokeAriaLabel(level)}
    >
      <StrokeIconBody level={level} />
    </svg>
  );
}
