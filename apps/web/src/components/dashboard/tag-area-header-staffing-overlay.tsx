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
  tone?: "default" | "past" | "inactive";
};

const EMPTY_DISPLAY: StaffingHeaderDisplay = { mode: "empty" };

const PAST_STAFFING_TEXT_CLASS = "text-red-900";
const INACTIVE_STAFFING_TEXT_CLASS = "text-muted";

function staffingTextClass(
  tone: "default" | "past" | "inactive",
  variant: "default" | "understaffed" | "met"
): string {
  if (tone === "inactive") return INACTIVE_STAFFING_TEXT_CLASS;
  if (tone === "past") return PAST_STAFFING_TEXT_CLASS;
  if (variant === "understaffed") return "text-red-600";
  return "text-green-600";
}

export function TagAreaHeaderStaffingOverlay({
  entries,
  shiftTypeNameById,
  tone = "default",
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
    if (entries.length === 0) {
      setDisplay(EMPTY_DISPLAY);
      return;
    }

    setDisplay(
      resolveStaffingHeaderDisplay(
        entries,
        shiftTypeNameById,
        Number.POSITIVE_INFINITY
      )
    );
  }, [entries, entryKey, shiftTypeNameById]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || entries.length === 0) return;

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

  if (entries.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5"
    >
      {display.mode === "indicator" ? (
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold leading-none",
            staffingTextClass(
              tone,
              display.allMet ? "met" : "understaffed"
            )
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
            staffingTextClass(
              tone,
              display.understaffed ? "understaffed" : "met"
            )
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
                  className={cn(
                    "shrink-0 text-[10px] leading-none",
                    tone === "inactive" || tone === "past"
                      ? staffingTextClass(tone, "default")
                      : "text-muted"
                  )}
                  aria-hidden
                >
                  |
                </span>
              ) : null}
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap text-[10px] font-medium leading-none tabular-nums",
                  staffingTextClass(
                    tone,
                    segment.understaffed ? "understaffed" : "met"
                  )
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
