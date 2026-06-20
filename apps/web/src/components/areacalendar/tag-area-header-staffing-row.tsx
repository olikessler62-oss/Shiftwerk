"use client";

import { TagAreaHeaderStaffingOverlay } from "@/components/areacalendar/tag-area-header-staffing-overlay";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type StaffingRowProps = {
  entries: TagAreaHeaderStaffingEntry[];
  /** Schichten ohne Servicezeit — Bedarf-Overlay ersetzen. */
  noServiceHoursLabel?: string;
  /** Tooltip für Randbereiche links/rechts der Bedarfsanzeige (Servicezeiten). */
  headerTooltip?: ReactNode;
  /** Zugeklappter Tag — Bedarf als „!“, ohne Servicezeit als „×“. */
  dayCollapsed?: boolean;
  className?: string;
};

type SideInsets = {
  left: number;
  right: number;
};

function TagAreaServiceHoursSideTooltip({
  content,
  side,
  widthPx,
}: {
  content: ReactNode;
  side: "left" | "right";
  widthPx: number;
}) {
  if (widthPx <= 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-y-0 z-[5]",
        side === "left" ? "left-0" : "right-0"
      )}
      style={{ width: widthPx }}
    >
      <Tooltip content={content} className="flex h-full w-full min-h-0 min-w-0">
        <span className="block h-full w-full cursor-default" aria-hidden />
      </Tooltip>
    </div>
  );
}

/** Personalbedarf-Zeile mit getrennten Tooltips für Bedarf und Servicezeiten. */
export function TagAreaHeaderStaffingRow({
  entries,
  noServiceHoursLabel,
  headerTooltip,
  dayCollapsed = false,
  className,
}: StaffingRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<HTMLElement | null>(null);
  const sideInsetsRef = useRef<SideInsets | null>(null);
  const [sideInsets, setSideInsets] = useState<SideInsets | null>(null);

  const showStaffingOverlay = !noServiceHoursLabel && entries.length > 0;
  const showServiceHoursSideTooltips =
    Boolean(headerTooltip) && showStaffingOverlay;

  const updateSideInsets = useCallback(() => {
    if (!showServiceHoursSideTooltips) return;

    const rowEl = rowRef.current;
    const clusterEl = clusterRef.current;
    if (!rowEl || !clusterEl) return;

    const rowRect = rowEl.getBoundingClientRect();
    const clusterRect = clusterEl.getBoundingClientRect();
    const next: SideInsets = {
      left: Math.max(0, Math.round(clusterRect.left - rowRect.left)),
      right: Math.max(0, Math.round(rowRect.right - clusterRect.right)),
    };

    const prev = sideInsetsRef.current;
    if (prev && prev.left === next.left && prev.right === next.right) return;

    sideInsetsRef.current = next;
    setSideInsets(next);
  }, [showServiceHoursSideTooltips]);

  useLayoutEffect(() => {
    if (!showServiceHoursSideTooltips) {
      if (sideInsetsRef.current !== null) {
        sideInsetsRef.current = null;
        setSideInsets(null);
      }
      return;
    }

    updateSideInsets();

    const row = rowRef.current;
    const cluster = clusterRef.current;

    let raf = 0;
    if (!cluster) {
      raf = requestAnimationFrame(updateSideInsets);
    }

    if (!row) {
      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }

    const observer = new ResizeObserver(updateSideInsets);
    observer.observe(row);
    if (cluster) observer.observe(cluster);
    window.addEventListener("resize", updateSideInsets);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", updateSideInsets);
    };
  }, [
    showServiceHoursSideTooltips,
    entries,
    dayCollapsed,
    updateSideInsets,
  ]);

  return (
    <div
      ref={rowRef}
      className={cn("relative flex h-full w-full min-w-0", className)}
    >
      {showServiceHoursSideTooltips ? (
        <>
          <TagAreaServiceHoursSideTooltip
            content={headerTooltip}
            side="left"
            widthPx={sideInsets?.left ?? 0}
          />
          <TagAreaServiceHoursSideTooltip
            content={headerTooltip}
            side="right"
            widthPx={sideInsets?.right ?? 0}
          />
        </>
      ) : null}
      <div
        className={cn(
          "relative z-10 flex h-full w-full min-w-0 items-center justify-center px-1",
          showServiceHoursSideTooltips && "pointer-events-none"
        )}
      >
        {noServiceHoursLabel ? (
          dayCollapsed ? (
            headerTooltip ? (
              <Tooltip content={headerTooltip} className="pointer-events-auto shrink-0">
                <span
                  className="shrink-0 cursor-default text-2xl font-bold leading-none text-black"
                  aria-label={noServiceHoursLabel}
                >
                  ×
                </span>
              </Tooltip>
            ) : (
              <span
                className="shrink-0 text-2xl font-bold leading-none text-black"
                aria-label={noServiceHoursLabel}
              >
                ×
              </span>
            )
          ) : headerTooltip ? (
            <Tooltip content={headerTooltip} className="pointer-events-auto shrink-0">
              <span className="shrink-0 cursor-default whitespace-nowrap rounded px-1 py-px text-[11px] font-medium leading-none text-black">
                {noServiceHoursLabel}
              </span>
            </Tooltip>
          ) : (
            <span className="shrink-0 whitespace-nowrap rounded px-1 py-px text-[11px] font-medium leading-none text-black">
              {noServiceHoursLabel}
            </span>
          )
        ) : showStaffingOverlay ? (
          <TagAreaHeaderStaffingOverlay
            key={entries
              .map(
                (entry) =>
                  `${entry.serviceHourId}:${entry.assigned}/${entry.required}`
              )
              .join("|")}
            entries={entries}
            dayCollapsed={dayCollapsed}
            interactiveClusterRef={clusterRef}
          />
        ) : null}
      </div>
    </div>
  );
}
