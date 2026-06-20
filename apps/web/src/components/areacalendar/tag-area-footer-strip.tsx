"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { TagAreaFooterCostTooltipPart } from "@/lib/tag-area-footer-stats";

type Props = {
  label: string;
  shortLinePrefix: string;
  shortLineCostAmount: string;
  hoursTooltipLine: string;
  costTooltipParts: readonly TagAreaFooterCostTooltipPart[];
  className?: string;
  /** Eingeklappter Tag — nur „!“ mit Tooltip (Volltext). */
  dayCollapsed?: boolean;
};

function TagAreaFooterCostTooltipLines({
  parts,
}: {
  parts: readonly TagAreaFooterCostTooltipPart[];
}) {
  return (
    <>
      {parts.map((part, index) => (
        <div key={`${part.label}-${index}`}>
          {part.label}{" "}
          <span className="font-bold">{part.amount}</span>
        </div>
      ))}
    </>
  );
}

function buildFooterTooltipContent(
  hoursTooltipLine: string,
  costTooltipParts: readonly TagAreaFooterCostTooltipPart[]
): ReactNode {
  if (costTooltipParts.length === 0) {
    return hoursTooltipLine;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div>{hoursTooltipLine}</div>
      <TagAreaFooterCostTooltipLines parts={costTooltipParts} />
    </div>
  );
}

/** Tag-Bereich-Footer: Gesamtstunden und Gesamtkosten. */
export function TagAreaFooterStrip({
  label,
  shortLinePrefix,
  shortLineCostAmount,
  hoursTooltipLine,
  costTooltipParts,
  className,
  dayCollapsed = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [contentOverflows, setContentOverflows] = useState(false);

  const tooltipContent = buildFooterTooltipContent(
    hoursTooltipLine,
    costTooltipParts
  );

  const visibleLabel =
    shortLineCostAmount.trim().length > 0 ? (
      <>
        {shortLinePrefix}
        <span className="font-bold">{shortLineCostAmount}</span>
      </>
    ) : (
      label
    );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || dayCollapsed) {
      setContentOverflows(false);
      return;
    }

    function updateOverflow() {
      if (!container || !content) return;
      setContentOverflows(content.scrollWidth > container.clientWidth + 1);
    }

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [label, shortLinePrefix, shortLineCostAmount, dayCollapsed]);

  if (!label.trim()) return null;

  const showIndicator = dayCollapsed || contentOverflows;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5",
        className
      )}
    >
      <Tooltip content={tooltipContent}>
        {showIndicator ? (
          <span className="shrink-0 cursor-default text-[10px] font-bold leading-none text-neutral-600">
            !
          </span>
        ) : (
          <span
            ref={contentRef}
            className="min-w-0 max-w-full cursor-default truncate text-[11px] font-medium leading-none text-neutral-600"
          >
            {visibleLabel}
          </span>
        )}
      </Tooltip>
    </div>
  );
}
