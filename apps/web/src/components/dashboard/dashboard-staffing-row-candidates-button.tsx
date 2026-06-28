"use client";

import { cn } from "@/lib/cn";
import {
  StaffingConflictIcon,
  StaffingOpenPointsIcon,
  StaffingVacancyIcon,
} from "@/components/dashboard/dashboard-staffing-row-action-icons";

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
        "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
        variant === "candidates"
          ? "text-muted hover:text-foreground"
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
