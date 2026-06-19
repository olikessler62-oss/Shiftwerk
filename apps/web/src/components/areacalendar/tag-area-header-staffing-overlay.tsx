"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatStaffingEntriesTooltipContent,
  formatStaffingEntryTooltipContent,
} from "@/lib/bulk-staffing-header";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  resolveStaffingHeaderDisplay,
  type StaffingHeaderDisplay,
} from "@/lib/tag-area-header-staffing-display";
import { StaffingFillGauge } from "@/components/areacalendar/staffing-fill-gauge";
import { useTranslations } from "@/i18n/locale-provider";
import { Tooltip } from "@/components/ui/tooltip";

type Props = {
  entries: TagAreaHeaderStaffingEntry[];
  /** Eingeklappter Kalendertag — Bedarf nur als „!“ (Tooltip mit Volltext). */
  dayCollapsed?: boolean;
};

const EMPTY_DISPLAY: StaffingHeaderDisplay = { mode: "empty" };

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

export function TagAreaHeaderStaffingOverlay({
  entries,
  dayCollapsed = false,
}: Props) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentOverflows, setContentOverflows] = useState(false);

  const formatQualLine = useCallback(
    (name: string, assigned: number, required: number) =>
      t("areaCalendar.bulkShiftStaffingTooltipLine", {
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
    return resolveStaffingHeaderDisplay(entries, effectiveWidth);
  }, [entries, entryKey, containerWidth]);

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

  if (entries.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5"
    >
      {showIndicator ? (
        <Tooltip content={allEntriesTooltip}>
          <span className="shrink-0 text-base font-bold leading-none text-neutral-600">
            !
          </span>
        </Tooltip>
      ) : display.mode === "gauges" ? (
        <div
          ref={contentRef}
          className="flex min-w-0 max-w-full items-end justify-center gap-1 overflow-hidden"
        >
          {display.segments.map((segment) => (
            <Tooltip key={segment.serviceHourId} content={entryTooltip(segment.serviceHourId)}>
              <StaffingFillGauge
                assigned={segment.assigned}
                required={segment.required}
                label={segment.timeText}
                understaffed={segment.understaffed}
              />
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
