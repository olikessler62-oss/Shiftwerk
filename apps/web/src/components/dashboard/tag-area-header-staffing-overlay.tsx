"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  measureStaffingHeaderText,
  resolveStaffingHeaderDisplay,
  type StaffingHeaderDisplay,
} from "@/lib/tag-area-header-staffing-display";
import { cn } from "@/lib/cn";

type Props = {
  entries: TagAreaHeaderStaffingEntry[];
  shiftTypeNameById: ReadonlyMap<string, string>;
};

const EMPTY_DISPLAY: StaffingHeaderDisplay = { mode: "empty" };

export function TagAreaHeaderStaffingOverlay({
  entries,
  shiftTypeNameById,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState<StaffingHeaderDisplay>(() =>
    entries.length > 0
      ? resolveStaffingHeaderDisplay(
          entries,
          shiftTypeNameById,
          Number.POSITIVE_INFINITY
        )
      : EMPTY_DISPLAY
  );

  const entryKey = useMemo(
    () =>
      entries
        .map(
          (entry) =>
            `${entry.shiftTypeId}:${entry.assigned}/${entry.required}:${entry.label}`
        )
        .join("|"),
    [entries]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || entries.length === 0) {
      setDisplay(EMPTY_DISPLAY);
      return;
    }

    function updateDisplay() {
      if (!container) return;
      setDisplay(
        resolveStaffingHeaderDisplay(
          entries,
          shiftTypeNameById,
          container.clientWidth,
          measureStaffingHeaderText
        )
      );
    }

    updateDisplay();

    const observer = new ResizeObserver(updateDisplay);
    observer.observe(container);
    return () => observer.disconnect();
  }, [entries, entryKey, shiftTypeNameById]);

  if (entries.length === 0 || display.mode === "empty") return null;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5"
    >
      {display.mode === "indicator" ? (
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold leading-none",
            display.allMet ? "text-green-600" : "text-red-600"
          )}
          title="Personalbedarf"
        >
          !
        </span>
      ) : null}

      {display.mode === "text" ? (
        <span
          className={cn(
            "shrink-0 whitespace-nowrap text-[10px] font-medium leading-none tabular-nums",
            display.understaffed ? "text-red-600" : "text-green-600"
          )}
        >
          {display.text}
        </span>
      ) : null}

      {display.mode === "segments" ? (
        <div className="flex min-w-0 items-center justify-center gap-1 overflow-hidden">
          {display.segments.map((segment, segmentIndex) => (
            <Fragment key={segment.shiftTypeId}>
              {segmentIndex > 0 ? (
                <span
                  className="shrink-0 text-[10px] leading-none text-muted"
                  aria-hidden
                >
                  |
                </span>
              ) : null}
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap text-[10px] font-medium leading-none tabular-nums",
                  segment.understaffed ? "text-red-600" : "text-green-600"
                )}
              >
                {segment.text}
              </span>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
