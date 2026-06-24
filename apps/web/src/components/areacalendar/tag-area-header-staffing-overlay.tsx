"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  formatStaffingEntriesTooltipContent,
  formatStaffingEntryTooltipContent,
} from "@/lib/bulk-staffing-header";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  resolveStaffingHeaderDisplay,
  resolveStaffingFillGaugeVariant,
  isTagAreaHeaderStaffingAssignmentMismatch,
  isTagAreaHeaderStaffingOverstaffed,
  isTagAreaHeaderStaffingUnderstaffed,
  type StaffingHeaderDisplay,
} from "@/lib/tag-area-header-staffing-display";
import { StaffingFillGauge } from "@/components/areacalendar/staffing-fill-gauge";
import { useTranslations } from "@/i18n/locale-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type Props = {
  entries: TagAreaHeaderStaffingEntry[];
  /** Eingeklappter Kalendertag — Bedarf nur als „!“ (Tooltip mit Volltext). */
  dayCollapsed?: boolean;
  /** Bedarfs-Cluster für seitliche Servicezeiten-Hit-Zonen (links/rechts). */
  interactiveClusterRef?: RefObject<HTMLElement | null>;
  onStaffingHeaderMenu?: (event: React.MouseEvent) => void;
  staffingHeaderMenuOpen?: boolean;
  className?: string;
};

const EMPTY_DISPLAY: StaffingHeaderDisplay = { mode: "empty" };

function StaffingTooltipContent({
  title,
  body,
  footnote,
}: {
  title: string;
  body: string;
  footnote?: string;
}) {
  return (
    <>
      <p className="mb-1.5 border-b border-border/60 pb-1.5 text-xs font-semibold text-foreground">
        {title}
      </p>
      <span className="block whitespace-pre-line">{body}</span>
      {footnote ? (
        <p className="mt-1.5 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </>
  );
}

export function TagAreaHeaderStaffingOverlay({
  entries,
  dayCollapsed = false,
  interactiveClusterRef,
  onStaffingHeaderMenu,
  staffingHeaderMenuOpen = false,
  className,
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
  const overstaffedGaugeFootnote = t("areaCalendar.staffingOverstaffedGaugeFootnote");

  const hasOverstaffed = useMemo(
    () => isTagAreaHeaderStaffingOverstaffed(entries),
    [entries]
  );

  const hasAssignmentMismatch = useMemo(
    () => isTagAreaHeaderStaffingAssignmentMismatch(entries),
    [entries]
  );

  const hasUnderstaffed = useMemo(
    () => isTagAreaHeaderStaffingUnderstaffed(entries),
    [entries]
  );

  const showPureOverstaffedFootnote =
    hasOverstaffed && !hasUnderstaffed && !hasAssignmentMismatch;

  const allEntriesTooltip = useMemo(
    () => (
      <StaffingTooltipContent
        title={staffingTooltipTitle}
        body={formatStaffingEntriesTooltipContent(entries, formatQualLine)}
        footnote={
          showPureOverstaffedFootnote ? overstaffedGaugeFootnote : undefined
        }
      />
    ),
    [
      entries,
      formatQualLine,
      overstaffedGaugeFootnote,
      showPureOverstaffedFootnote,
      staffingTooltipTitle,
    ]
  );

  const entryTooltip = useCallback(
    (serviceHourId: string, showOverstaffedFootnote: boolean) => {
      const entry = entryByServiceHourId.get(serviceHourId);
      if (!entry) return undefined;
      return (
        <StaffingTooltipContent
          title={staffingTooltipTitle}
          body={formatStaffingEntryTooltipContent(entry, formatQualLine)}
          footnote={
            showOverstaffedFootnote ? overstaffedGaugeFootnote : undefined
          }
        />
      );
    },
    [entryByServiceHourId, formatQualLine, overstaffedGaugeFootnote, staffingTooltipTitle]
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
      containerWidth > 0 && Number.isFinite(containerWidth)
        ? containerWidth
        : Number.POSITIVE_INFINITY;
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
      setContentOverflows(horizontalOverflow);
    }

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [display, entryKey, containerWidth]);

  const showIndicator =
    dayCollapsed || display.mode === "indicator" || contentOverflows;

  const indicatorAlertClass = hasUnderstaffed || hasAssignmentMismatch
    ? "text-red-600"
    : hasOverstaffed
      ? "text-[#CA8A04]"
      : "text-neutral-600";

  const assignInteractiveClusterRef = useCallback(
    (node: HTMLElement | null) => {
      if (interactiveClusterRef) {
        interactiveClusterRef.current = node;
      }
    },
    [interactiveClusterRef]
  );

  const openStaffingHeaderMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!onStaffingHeaderMenu) return;
      event.preventDefault();
      event.stopPropagation();
      onStaffingHeaderMenu(event);
    },
    [onStaffingHeaderMenu]
  );

  const menuTriggerProps = onStaffingHeaderMenu
    ? {
        onClick: openStaffingHeaderMenu,
        onContextMenu: openStaffingHeaderMenu,
      }
    : undefined;

  const setGaugeClusterRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      assignInteractiveClusterRef(node);
    },
    [assignInteractiveClusterRef]
  );

  if (entries.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-none flex h-full w-full min-w-0 items-stretch justify-center overflow-hidden px-0.5",
        className
      )}
    >
      {showIndicator ? (
        <span
          ref={assignInteractiveClusterRef}
          className="pointer-events-auto relative flex h-full w-full min-w-0 self-stretch"
        >
          <Tooltip
            content={allEntriesTooltip}
            suppressOpen={staffingHeaderMenuOpen}
            className="h-full w-full min-w-0"
          >
            <span
              {...menuTriggerProps}
              className={cn(
                "flex h-full w-full min-w-0 items-center justify-center",
                onStaffingHeaderMenu ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "shrink-0 text-base font-bold leading-none",
                  indicatorAlertClass
                )}
              >
                !
              </span>
            </span>
          </Tooltip>
        </span>
      ) : display.mode === "gauges" ? (
        <div
          ref={setGaugeClusterRef}
          className="pointer-events-none flex min-w-0 max-w-full shrink items-stretch justify-center gap-1 overflow-hidden"
        >
          {display.segments.map((segment) => {
            const variant = resolveStaffingFillGaugeVariant(segment);
            return (
              <span
                key={segment.serviceHourId}
                className="pointer-events-auto flex h-full min-w-0 shrink-0 self-stretch items-center justify-center"
              >
                <Tooltip
                  content={entryTooltip(
                    segment.serviceHourId,
                    variant === "overstaffed"
                  )}
                  suppressOpen={staffingHeaderMenuOpen}
                  className="pointer-events-auto"
                >
                  <span
                    {...menuTriggerProps}
                    className={onStaffingHeaderMenu ? "cursor-pointer" : undefined}
                  >
                    <StaffingFillGauge
                      assigned={segment.assigned}
                      required={segment.required}
                      label={segment.timeText}
                      variant={variant}
                    />
                  </span>
                </Tooltip>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
