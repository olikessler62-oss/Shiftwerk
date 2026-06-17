"use client";

import { cn } from "@/lib/cn";

type Props = {
  title: string;
  availableLabel: string;
  noAvailabilityLabel: string;
  absentLabel: string;
  className?: string;
};

function LegendPlus({ label }: { label: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-xs text-muted last:mb-0">
      <span
        className="flex h-2.5 w-2.5 shrink-0 items-center justify-center text-[20px] font-medium leading-none text-foreground"
        aria-hidden
      >
        +
      </span>
      {label}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-xs text-muted last:mb-0">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

export function PlanningAvailabilityLegendSidebar({
  title,
  availableLabel,
  noAvailabilityLabel,
  absentLabel,
  className,
}: Props) {
  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <LegendPlus label={availableLabel} />
      <LegendDot color="#94a3b8" label={noAvailabilityLabel} />
      <LegendDot color="#f43f5e" label={absentLabel} />
    </section>
  );
}
