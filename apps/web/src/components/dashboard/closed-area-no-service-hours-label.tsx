"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { measureStaffingHeaderCountText } from "@/lib/tag-area-header-staffing-display";
import { cn } from "@/lib/cn";

/** Gleicher Zellen-Innenabstand wie im Planer (`PLANNING_CELL_PADDING_PX`). */
const CELL_PANEL_INSET_PX = 4;
const NO_SERVICE_LABEL_SAFETY_PX = 4;
const NO_SERVICE_LABEL_FONT =
  '400 12px Inter, ui-sans-serif, system-ui, sans-serif';

const NO_SERVICE_HOURS_CELL_PANEL_CLASS =
  "flex min-h-0 flex-1 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500";

function measureNoServiceHoursLabelText(text: string): number {
  if (typeof document === "undefined") return text.length * 6.5;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 6.5;
  context.font = NO_SERVICE_LABEL_FONT;
  return context.measureText(text).width;
}

type Props = {
  label: string;
  className?: string;
};

export function ClosedAreaNoServiceHoursLabel({ label, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateFits() {
      const { clientWidth, clientHeight } = container;
      if (clientWidth <= 0 || clientHeight <= 0) {
        setFits(false);
        return;
      }

      const insetTotal = CELL_PANEL_INSET_PX * 2;
      const innerWidth = clientWidth - insetTotal;
      const innerHeight = clientHeight - insetTotal;
      if (innerWidth <= 0 || innerHeight <= 0) {
        setFits(false);
        return;
      }

      const textWidth = measureNoServiceHoursLabelText(label);
      const requiredWidth = textWidth + NO_SERVICE_LABEL_SAFETY_PX;
      const requiredHeight = 12 + NO_SERVICE_LABEL_SAFETY_PX;
      setFits(innerWidth >= requiredWidth && innerHeight >= requiredHeight);
    }

    updateFits();
    const observer = new ResizeObserver(updateFits);
    observer.observe(container);
    return () => observer.disconnect();
  }, [label]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-none absolute inset-0 flex min-h-0 p-1",
        className
      )}
      aria-hidden={!fits}
    >
      {fits ? (
        <div className={cn(NO_SERVICE_HOURS_CELL_PANEL_CLASS, "px-1 text-center")}>
          {label}
        </div>
      ) : null}
    </div>
  );
}
