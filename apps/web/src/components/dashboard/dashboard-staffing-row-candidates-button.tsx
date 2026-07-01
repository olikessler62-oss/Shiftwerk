"use client";

import { cn } from "@/lib/cn";
import {
  DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS,
  StaffingConflictIcon,
  StaffingOpenPointsIcon,
  StaffingVacancyIcon,
} from "@/components/dashboard/dashboard-staffing-row-action-icons";
import { DASHBOARD_STAFFING_VACANCY_SILHOUETTE_CLASS } from "@/lib/dashboard-panel-styles";

export type DashboardStaffingRowActionVariant =
  | "candidates"
  | "staffingIssues"
  | "windowIssues";

type Props = {
  variant: DashboardStaffingRowActionVariant;
  ariaLabel: string;
  onClick?: () => void;
  className?: string;
};

function StaffingRowActionIcon({
  variant,
}: {
  variant: DashboardStaffingRowActionVariant;
}) {
  switch (variant) {
    case "staffingIssues":
      return <StaffingConflictIcon />;
    case "windowIssues":
      return <StaffingOpenPointsIcon />;
    case "candidates":
    default:
      return <StaffingVacancyIcon />;
  }
}

export function DashboardStaffingRowCandidatesButton({
  variant,
  ariaLabel,
  onClick,
  className,
}: Props) {
  return (
    <button
      type="button"
      className={cn(
        DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS,
        "cursor-pointer rounded-md transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
        variant === "candidates"
          ? cn(DASHBOARD_STAFFING_VACANCY_SILHOUETTE_CLASS, "hover:opacity-80")
          : "text-foreground/80 hover:text-foreground",
        className
      )}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.();
      }}
    >
      <StaffingRowActionIcon variant={variant} />
    </button>
  );
}
