"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { measureStaffingHeaderCountText } from "@/lib/tag-area-header-staffing-display";
import { cn } from "@/lib/cn";

const STAFFING_LABEL_LINE_HEIGHT_PX = 11;
const NO_SERVICE_LABEL_SAFETY_PX = 4;

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

      const textWidth = measureStaffingHeaderCountText(label);
      const requiredWidth = textWidth + NO_SERVICE_LABEL_SAFETY_PX;
      const requiredHeight = STAFFING_LABEL_LINE_HEIGHT_PX + NO_SERVICE_LABEL_SAFETY_PX;
      setFits(
        clientWidth >= requiredWidth && clientHeight >= requiredHeight
      );
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
        "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden",
        className
      )}
      aria-hidden={!fits}
    >
      {fits ? (
        <span className="px-1 text-center text-[11px] font-medium leading-none text-muted">
          {label}
        </span>
      ) : null}
    </div>
  );
}
