"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  formatStaffingEntriesTooltipSections,
  formatStaffingEntryTooltipSection,
  formatStaffingAssignmentTooltipBlocks,
  type StaffingAssignmentTooltipBlock,
  type StaffingTooltipSection,
} from "@/lib/bulk-staffing-header";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  resolveStaffingHeaderDisplay,
  resolveStaffingFillGaugeVariant,
  isTagAreaHeaderStaffingAssignmentMismatch,
  isTagAreaHeaderStaffingOverstaffed,
  isTagAreaHeaderStaffingPlannedCoverage,
  isTagAreaHeaderStaffingUnderstaffed,
  type StaffingHeaderDisplay,
} from "@/lib/tag-area-header-staffing-display";
import { StaffingFillGauge } from "@/components/areacalendar/staffing-fill-gauge";
import { useTranslations } from "@/i18n/locale-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";

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

function AssignmentTooltipSection({
  heading,
  blocks,
}: {
  heading: string;
  blocks: readonly StaffingAssignmentTooltipBlock[];
}) {
  if (blocks.length === 0) return null;

  return (
    <div className="mt-2.5 border-t border-border/60 pt-2">
      <p className="mb-1.5 font-semibold text-foreground">{heading}</p>
      <ul className="space-y-2">
        {blocks.map((block, blockIndex) => (
          <li key={`${block.titleLine}:${blockIndex}`}>
            <p className="font-medium text-foreground">{block.titleLine}</p>
            <p className="text-muted-foreground">{block.descriptionLine}</p>
            {block.noteLine ? (
              <p className="text-muted-foreground">{block.noteLine}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffingTooltipContent({
  title,
  sections,
  conflictBlocks,
  hintBlocks,
  conflictsHeading,
  hintsHeading,
}: {
  title: string;
  sections: StaffingTooltipSection[];
  conflictBlocks?: readonly StaffingAssignmentTooltipBlock[];
  hintBlocks?: readonly StaffingAssignmentTooltipBlock[];
  conflictsHeading: string;
  hintsHeading: string;
}) {
  return (
    <div className="max-w-xs text-xs leading-snug">
      <p className="mb-2 border-b border-border/60 pb-1.5 font-semibold text-foreground">
        {title}
      </p>
      <div className="space-y-2.5">
        {sections.map((section, sectionIndex) => (
          <div
            key={`${section.periodLine}:${sectionIndex}`}
            className={
              sectionIndex > 0 ? "border-t border-border/40 pt-2.5" : undefined
            }
          >
            <p className="font-medium text-foreground">{section.periodLine}</p>
            <ul className="mt-1 space-y-0.5">
              {section.coverageLines.map((line, lineIndex) => (
                <li
                  key={`${line}:${lineIndex}`}
                  className="tabular-nums text-muted-foreground"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <AssignmentTooltipSection
        heading={conflictsHeading}
        blocks={conflictBlocks ?? []}
      />
      <AssignmentTooltipSection heading={hintsHeading} blocks={hintBlocks ?? []} />
    </div>
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

  const formatCoverage = useMemo(
    () => ({
      confirmed: (
        assigned: number,
        required: number,
        name: string,
        shiftTime: string
      ) =>
        t("areaCalendar.staffingTooltipQualConfirmed", {
          assigned,
          required,
          name,
          shiftTime,
        }),
      unconfirmed: (
        assigned: number,
        required: number,
        name: string,
        shiftTime: string
      ) =>
        t("areaCalendar.staffingTooltipQualUnconfirmed", {
          assigned,
          required,
          name,
          shiftTime,
        }),
      planned: (
        assigned: number,
        required: number,
        name: string,
        shiftTime: string
      ) =>
        t("areaCalendar.staffingTooltipQualPlanned", {
          assigned,
          required,
          name,
          shiftTime,
        }),
      vacant: (count: number, required: number, name: string, shiftTime: string) =>
        t("areaCalendar.staffingTooltipQualVacant", {
          count,
          required,
          name,
          shiftTime,
        }),
      totalConfirmed: (assigned: number, required: number, shiftTime: string) =>
        t("areaCalendar.staffingTooltipTotalConfirmed", {
          assigned,
          required,
          shiftTime,
        }),
      totalUnconfirmed: (
        assigned: number,
        required: number,
        shiftTime: string
      ) =>
        t("areaCalendar.staffingTooltipTotalUnconfirmed", {
          assigned,
          required,
          shiftTime,
        }),
      totalPlanned: (assigned: number, required: number, shiftTime: string) =>
        t("areaCalendar.staffingTooltipTotalPlanned", {
          assigned,
          required,
          shiftTime,
        }),
      totalVacant: (count: number, required: number, shiftTime: string) =>
        t("areaCalendar.staffingTooltipTotalVacant", {
          count,
          required,
          shiftTime,
        }),
    }),
    [t]
  );

  const entryByServiceHourId = useMemo(
    () => new Map(entries.map((entry) => [entry.serviceHourId, entry])),
    [entries]
  );

  const staffingTooltipTitle = t("locations.panelStaffing");
  const conflictsHeading = t("areaCalendar.staffingTooltipConflictsHeading");
  const hintsHeading = t("areaCalendar.staffingTooltipHintsHeading");

  const formatAssignmentBlocks = useCallback(
    (targetEntries: TagAreaHeaderStaffingEntry[]) =>
      formatStaffingAssignmentTooltipBlocks(targetEntries, (key, params) =>
        t(key, params)
      ),
    [t]
  );

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

  const allEntriesAssignmentBlocks = useMemo(
    () => formatAssignmentBlocks(entries),
    [entries, formatAssignmentBlocks]
  );

  const allEntriesTooltipSections = useMemo(
    () => formatStaffingEntriesTooltipSections(entries, formatCoverage),
    [entries, formatCoverage]
  );

  const allEntriesTooltip = useMemo(
    () => (
      <StaffingTooltipContent
        title={staffingTooltipTitle}
        sections={allEntriesTooltipSections}
        conflictsHeading={conflictsHeading}
        hintsHeading={hintsHeading}
        conflictBlocks={allEntriesAssignmentBlocks.conflicts}
        hintBlocks={allEntriesAssignmentBlocks.hints}
      />
    ),
    [
      allEntriesTooltipSections,
      allEntriesAssignmentBlocks,
      conflictsHeading,
      hintsHeading,
      staffingTooltipTitle,
    ]
  );

  const entryTooltip = useCallback(
    (serviceHourId: string) => {
      const entry = entryByServiceHourId.get(serviceHourId);
      if (!entry) return undefined;
      const { conflicts, hints } = formatAssignmentBlocks([entry]);
      return (
        <StaffingTooltipContent
          title={staffingTooltipTitle}
          sections={[formatStaffingEntryTooltipSection(entry, formatCoverage)]}
          conflictsHeading={conflictsHeading}
          hintsHeading={hintsHeading}
          conflictBlocks={conflicts}
          hintBlocks={hints}
        />
      );
    },
    [
      entryByServiceHourId,
      formatCoverage,
      formatAssignmentBlocks,
      conflictsHeading,
      hintsHeading,
      staffingTooltipTitle,
    ]
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

  const hasPlannedCoverage = useMemo(
    () => isTagAreaHeaderStaffingPlannedCoverage(entries),
    [entries]
  );

  const indicatorAlertClass =
    hasAssignmentMismatch || hasOverstaffed
      ? STAFFING_OCHER_TEXT_CLASS
      : hasUnderstaffed
        ? "text-red-600"
        : hasPlannedCoverage
          ? STAFFING_OCHER_TEXT_CLASS
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
