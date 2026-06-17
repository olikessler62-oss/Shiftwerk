"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  hoursTooltipLine: string;
  costTooltipLine: string;
  className?: string;
  /** Eingeklappter Tag — nur „!“ mit Tooltip (Volltext). */
  dayCollapsed?: boolean;
};

/** Tag-Bereich-Footer: Gesamtstunden und Gesamtkosten. */
export function TagAreaFooterStrip({
  label,
  hoursTooltipLine,
  costTooltipLine,
  className,
  dayCollapsed = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [contentOverflows, setContentOverflows] = useState(false);

  const tooltipContent = costTooltipLine.trim()
    ? `${hoursTooltipLine}\n${costTooltipLine}`
    : hoursTooltipLine;

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
  }, [label, dayCollapsed]);

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
            {label}
          </span>
        )}
      </Tooltip>
    </div>
  );
}
