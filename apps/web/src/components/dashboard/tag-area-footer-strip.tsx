"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  hoursTooltipLine: string;
  costTooltipLine: string;
  className?: string;
};

/** Tag-Bereich-Footer: Gesamtstunden und Gesamtkosten. */
export function TagAreaFooterStrip({
  label,
  hoursTooltipLine,
  costTooltipLine,
  className,
}: Props) {
  if (!label.trim()) return null;

  const tooltipContent = `${hoursTooltipLine}\n${costTooltipLine}`;

  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5",
        className
      )}
    >
      <Tooltip content={tooltipContent}>
        <span className="min-w-0 max-w-full cursor-default truncate text-[11px] font-medium leading-none text-neutral-600">
          {label}
        </span>
      </Tooltip>
    </div>
  );
}
