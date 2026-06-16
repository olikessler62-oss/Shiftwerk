"use client";

import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatStaffingEntriesTooltipContent,
  formatStaffingEntryTooltipContent,
} from "@/lib/bulk-staffing-header";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  measureStaffingHeaderText,
  resolveStaffingHeaderDisplay,
  type StaffingHeaderDisplay,
  type StaffingHeaderSegment,
} from "@/lib/tag-area-header-staffing-display";
import { useTranslations } from "@/i18n/locale-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type Props = {
  entries: TagAreaHeaderStaffingEntry[];
  /** Vergangener Kalendertag — dunklere Grün-/Rot-Töne. */
  dimmed?: boolean;
  /** Eingeklappter Kalendertag — Bedarf nur als „!“ (Tooltip mit Volltext). */
  dayCollapsed?: boolean;
};

const EMPTY_DISPLAY: StaffingHeaderDisplay = { mode: "empty" };

const STAFFING_LABEL_INTERACTIVE_CLASS =
  "cursor-default rounded px-1 py-px transition-colors duration-150";

function staffingLabelClass(
  variant: "default" | "understaffed" | "met",
  dimmed: boolean
): string {
  if (variant === "understaffed") {
    return cn(
      STAFFING_LABEL_INTERACTIVE_CLASS,
      dimmed
        ? "text-red-900 hover:bg-red-900/10 hover:text-red-800"
        : "text-red-600 hover:bg-red-600/12 hover:text-red-500"
    );
  }
  return cn(
    STAFFING_LABEL_INTERACTIVE_CLASS,
    dimmed
      ? "text-neutral-500 hover:bg-neutral-500/10 hover:text-neutral-600"
      : "text-neutral-600 hover:bg-neutral-500/10 hover:text-neutral-700"
  );
}

function StaffingTooltipContent({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <>
      <p className="mb-1.5 border-b border-border/60 pb-1.5 text-xs font-semibold text-foreground">
        {title}
      </p>
      <span className="block whitespace-pre-line">{body}</span>
    </>
  );
}

function StaffingOverlaySegment({
  segment,
  className,
}: {
  segment: StaffingHeaderSegment;
  className?: string;
}) {
  if (!segment.timeText) {
    return (
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-[11px] font-medium leading-none tabular-nums",
          className
        )}
      >
        {segment.countText}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap leading-none",
        className
      )}
    >
      <span className="text-[10px] font-medium">{segment.timeText}:</span>
      <span className="text-[11px] font-medium tabular-nums">{segment.countText}</span>
    </span>
  );
}

function StaffingOverlaySegmentGroup({
  segments,
  joinWith,
  className,
}: {
  segments: StaffingHeaderSegment[];
  joinWith: "pipe" | "space";
  className?: string;
}) {
  const divider = joinWith === "pipe" ? "|" : " ";

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center",
        joinWith === "pipe" ? "gap-0" : "gap-1",
        className
      )}
    >
      {segments.map((segment, index) => (
        <Fragment key={segment.serviceHourId}>
          {index > 0 ? (
            <span
              className={cn(
                "shrink-0 leading-none text-muted",
                joinWith === "pipe" ? "text-[10px]" : "text-[11px]"
              )}
              aria-hidden
            >
              {divider}
            </span>
          ) : null}
          <StaffingOverlaySegment segment={segment} />
        </Fragment>
      ))}
    </span>
  );
}

export function TagAreaHeaderStaffingOverlay({
  entries,
  dimmed = false,
  dayCollapsed = false,
}: Props) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentOverflows, setContentOverflows] = useState(false);

  const formatQualLine = useCallback(
    (name: string, assigned: number, required: number) =>
      t("dashboard.bulkShiftStaffingTooltipLine", {
        name,
        assigned,
        required,
      }),
    [t]
  );

  const entryByServiceHourId = useMemo(
    () => new Map(entries.map((entry) => [entry.serviceHourId, entry])),
    [entries]
  );

  const staffingTooltipTitle = t("locations.panelStaffing");

  const allEntriesTooltip = useMemo(
    () => (
      <StaffingTooltipContent
        title={staffingTooltipTitle}
        body={formatStaffingEntriesTooltipContent(entries, formatQualLine)}
      />
    ),
    [entries, formatQualLine, staffingTooltipTitle]
  );

  const entryTooltip = useCallback(
    (serviceHourId: string) => {
      const entry = entryByServiceHourId.get(serviceHourId);
      if (!entry) return undefined;
      return (
        <StaffingTooltipContent
          title={staffingTooltipTitle}
          body={formatStaffingEntryTooltipContent(entry, formatQualLine)}
        />
      );
    },
    [entryByServiceHourId, formatQualLine, staffingTooltipTitle]
  );

  const entryKey = useMemo(
    () =>
      entries
        .map(
          (entry) =>
            `${entry.serviceHourId}:${entry.assigned}/${entry.required}:${entry.shiftTemplateLabel ?? ""}:${entry.calendarTimeLabel ?? entry.timeLabel ?? entry.label}:${entry.qualifications?.map((qualification) => `${qualification.name}:${qualification.assigned}/${qualification.required}`).join(",") ?? ""}`
        )
        .join("|"),
    [entries]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth() {
      if (!container) return;
      setContainerWidth(container.clientWidth);
    }

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [entryKey]);

  const display = useMemo((): StaffingHeaderDisplay => {
    if (entries.length === 0) return EMPTY_DISPLAY;
    const effectiveWidth =
      containerWidth > 0 && Number.isFinite(containerWidth) ? containerWidth : 0;
    return resolveStaffingHeaderDisplay(
      entries,
      effectiveWidth,
      measureStaffingHeaderText
    );
  }, [entries, entryKey, containerWidth]);

  const hasUnderstaffed = useMemo(
    () => entries.some((entry) => entry.assigned < entry.required),
    [entries]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || display.mode === "indicator" || display.mode === "empty") {
      setContentOverflows(false);
      return;
    }

    function updateOverflow() {
      if (!container || !content) return;
      const horizontalOverflow = content.scrollWidth > container.clientWidth + 1;
      const childOverflow = Array.from(content.querySelectorAll("*")).some(
        (node) =>
          node instanceof HTMLElement &&
          (node.scrollWidth > node.clientWidth + 1 ||
            node.scrollHeight > node.clientHeight + 1)
      );
      setContentOverflows(horizontalOverflow || childOverflow);
    }

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    observer.observe(content);
    for (const child of content.querySelectorAll("*")) {
      if (child instanceof HTMLElement) observer.observe(child);
    }
    return () => observer.disconnect();
  }, [display, entryKey, containerWidth]);

  const showIndicator =
    dayCollapsed || display.mode === "indicator" || contentOverflows;
  const indicatorAllMet =
    display.mode === "indicator" ? display.allMet : !hasUnderstaffed;

  if (entries.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5"
    >
      {showIndicator ? (
        <Tooltip content={allEntriesTooltip}>
          <span
            className={cn(
              "shrink-0 text-[10px] font-bold leading-none",
              staffingLabelClass(
                indicatorAllMet ? "met" : "understaffed",
                dimmed
              )
            )}
          >
            !
          </span>
        </Tooltip>
      ) : (
        <div
          ref={contentRef}
          className="flex min-w-0 max-w-full items-center justify-center overflow-hidden"
        >
          {display.mode === "text" ? (
            <Tooltip content={allEntriesTooltip}>
              <StaffingOverlaySegmentGroup
                segments={display.segments}
                joinWith={display.joinWith}
                className={staffingLabelClass(
                  display.understaffed ? "understaffed" : "met",
                  dimmed
                )}
              />
            </Tooltip>
          ) : null}

          {display.mode === "segments" ? (
            <div className="flex min-w-0 items-center justify-center gap-0 overflow-hidden">
              {display.segments.map((segment, segmentIndex) => (
                <Fragment key={segment.serviceHourId}>
                  {segmentIndex > 0 ? (
                    <span
                      className="shrink-0 text-[10px] leading-none text-muted"
                      aria-hidden
                    >
                      |
                    </span>
                  ) : null}
                  <Tooltip content={entryTooltip(segment.serviceHourId)}>
                    <StaffingOverlaySegment
                      segment={segment}
                      className={staffingLabelClass(
                        segment.understaffed ? "understaffed" : "met",
                        dimmed
                      )}
                    />
                  </Tooltip>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
