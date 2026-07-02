import { cn } from "@/lib/cn";
import {
  formatPlanningLocationAreaLabel,
  shouldShowLocationInPlanningUi,
} from "@/lib/planning-location-ui";

type Props = {
  locationName: string | null | undefined;
  areaName: string;
  locationCount: number;
  className?: string;
};

/** Standort/Bereich — Standort wird bei Platzmangel zuerst abgeschnitten. */
export function PlanningLocationAreaTruncatedLabel({
  locationName,
  areaName,
  locationCount,
  className,
}: Props) {
  const showLocation =
    shouldShowLocationInPlanningUi(locationCount) && Boolean(locationName);

  if (!showLocation) {
    return (
      <span className={cn("min-w-0 truncate", className)} title={areaName}>
        {areaName}
      </span>
    );
  }

  const fullLabel = formatPlanningLocationAreaLabel(
    locationName!,
    areaName,
    locationCount
  );

  return (
    <span
      className={cn(
        "flex min-w-0 max-w-full items-baseline overflow-hidden",
        className
      )}
      title={fullLabel}
    >
      <span className="min-w-0 shrink-[3] truncate">{locationName}</span>
      <span className="shrink-0" aria-hidden>
        /
      </span>
      <span className="min-w-0 shrink truncate">{areaName}</span>
    </span>
  );
}
