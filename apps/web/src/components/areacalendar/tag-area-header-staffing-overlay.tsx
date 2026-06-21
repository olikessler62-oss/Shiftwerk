"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  formatStaffingEntriesTooltipContent,
  formatStaffingEntryTooltipContent,
} from "@/lib/bulk-staffing-header";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  resolveStaffingHeaderDisplay,
  isTagAreaHeaderStaffingAssignmentMismatch,
  isTagAreaHeaderStaffingHeaderAlertBadge,
  isTagAreaHeaderStaffingOverstaffed,
  type StaffingHeaderDisplay,
} from "@/lib/tag-area-header-staffing-display";
import {
  StaffingFillGauge,
  StaffingOverstaffedBadge,
  STAFFING_OVERSTAFFED_BADGE_ANCHOR_CLASS,
} from "@/components/areacalendar/staffing-fill-gauge";
import { useTranslations } from "@/i18n/locale-provider";
import { Tooltip, type TooltipPlacement } from "@/components/ui/tooltip";
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

const STAFFING_HEADER_ALERT_BADGE_ANCHOR_CENTER_CLASS =
  "left-1/2 right-auto -translate-x-1/2";

const STAFFING_HEADER_ALERT_BADGE_TOOLTIP_PLACEMENT: TooltipPlacement = {
  side: "above",
  gapPx: 26,
};

function StaffingHeaderAlertBadgeTooltip({
  content,
  dataAttribute,
  size = "sm",
  anchorClassName,
  suppressOpen = false,
}: {
  content: string;
  dataAttribute: string;
  size?: "sm" | "md";
  anchorClassName?: string;
  suppressOpen?: boolean;
}) {
  return (
    <Tooltip
      content={content}
      suppressOpen={suppressOpen}
      placement={STAFFING_HEADER_ALERT_BADGE_TOOLTIP_PLACEMENT}
      className="pointer-events-auto z-[51]"
    >
      <span
        data-staffing-header-alert-badge={dataAttribute}
        className={cn(
          STAFFING_OVERSTAFFED_BADGE_ANCHOR_CLASS,
          "pointer-events-auto cursor-default",
          anchorClassName
        )}
      >
        <StaffingOverstaffedBadge size={size} />
      </span>
    </Tooltip>
  );
}

function StaffingOverstaffedBadgeTooltip({
  size = "sm",
  anchorClassName,
  suppressOpen = false,
}: {
  size?: "sm" | "md";
  anchorClassName?: string;
  suppressOpen?: boolean;
}) {
  const t = useTranslations();

  return (
    <StaffingHeaderAlertBadgeTooltip
      content={t("areaCalendar.staffingOverstaffedBadgeTooltip")}
      dataAttribute="overstaffed"
      size={size}
      anchorClassName={anchorClassName}
      suppressOpen={suppressOpen}
    />
  );
}

function StaffingAssignmentMismatchBadgeTooltip({
  size = "sm",
  anchorClassName,
  suppressOpen = false,
}: {
  size?: "sm" | "md";
  anchorClassName?: string;
  suppressOpen?: boolean;
}) {
  const t = useTranslations();

  return (
    <StaffingHeaderAlertBadgeTooltip
      content={t("areaCalendar.staffingAssignmentMismatchBadgeTooltip")}
      dataAttribute="assignment-mismatch"
      size={size}
      anchorClassName={anchorClassName}
      suppressOpen={suppressOpen}
    />
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
  const overstaffedBadgeSuppressOpen = staffingHeaderMenuOpen;

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
      setContentOverflows(horizontalOverflow);
    }

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [display, entryKey, containerWidth]);

  const hasOverstaffed = useMemo(
    () => isTagAreaHeaderStaffingOverstaffed(entries),
    [entries]
  );

  const hasAssignmentMismatch = useMemo(
    () => isTagAreaHeaderStaffingAssignmentMismatch(entries),
    [entries]
  );

  const hasHeaderAlertBadge = useMemo(
    () => isTagAreaHeaderStaffingHeaderAlertBadge(entries),
    [entries]
  );

  const showIndicator =
    dayCollapsed || display.mode === "indicator" || contentOverflows;

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
        "pointer-events-none flex h-full w-full min-w-0 items-stretch justify-center px-0.5",
        hasHeaderAlertBadge && "relative z-[50] overflow-visible",
        !hasHeaderAlertBadge && "overflow-hidden",
        className
      )}
    >
      {showIndicator ? (
        <span
          ref={assignInteractiveClusterRef}
          className="pointer-events-auto relative flex h-full w-full min-w-0 self-stretch"
        >
          {hasAssignmentMismatch ? (
            <StaffingAssignmentMismatchBadgeTooltip
              size="md"
              anchorClassName={STAFFING_HEADER_ALERT_BADGE_ANCHOR_CENTER_CLASS}
              suppressOpen={overstaffedBadgeSuppressOpen}
            />
          ) : hasOverstaffed ? (
            <StaffingOverstaffedBadgeTooltip
              size="md"
              anchorClassName={STAFFING_HEADER_ALERT_BADGE_ANCHOR_CENTER_CLASS}
              suppressOpen={overstaffedBadgeSuppressOpen}
            />
          ) : null}
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
                  "shrink-0 text-base font-bold leading-none text-neutral-600",
                  hasHeaderAlertBadge && "invisible"
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
          className={cn(
            "pointer-events-none flex min-w-0 max-w-full shrink items-stretch justify-center gap-1",
            hasHeaderAlertBadge ? "overflow-visible" : "overflow-hidden"
          )}
        >
          {display.segments.map((segment) => (
            <span
              key={segment.serviceHourId}
              className={cn(
                "pointer-events-auto relative flex h-full min-w-0 shrink-0 self-stretch items-center justify-center",
                (segment.assignmentMismatch || segment.overstaffed) &&
                  "overflow-visible"
              )}
            >
              {segment.assignmentMismatch ? (
                <StaffingAssignmentMismatchBadgeTooltip
                  anchorClassName={STAFFING_HEADER_ALERT_BADGE_ANCHOR_CENTER_CLASS}
                  suppressOpen={overstaffedBadgeSuppressOpen}
                />
              ) : segment.overstaffed ? (
                <StaffingOverstaffedBadgeTooltip
                  anchorClassName={STAFFING_HEADER_ALERT_BADGE_ANCHOR_CENTER_CLASS}
                  suppressOpen={overstaffedBadgeSuppressOpen}
                />
              ) : null}
              <Tooltip
                content={entryTooltip(segment.serviceHourId)}
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
                    understaffed={segment.understaffed}
                    overstaffed={
                      segment.overstaffed || segment.assignmentMismatch
                    }
                  />
                </span>
              </Tooltip>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
