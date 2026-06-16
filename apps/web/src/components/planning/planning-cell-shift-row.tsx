"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DASHBOARD_SHIFT_CARD_BOX_SHADOW } from "@/components/dashboard/dashboard-shift-card-view";
import { PlanningShiftCardConfirmationOverlay } from "@/components/planning/planning-shift-card-confirmation-overlay";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import {
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
} from "@/lib/planning-calendar-layout";
import {
  buildPlanningShiftSegmentGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import {
  planningExpandedShiftUniformKey,
  PLANNING_EXPANDED_SHIFT_CELL_GAP_PX,
} from "@/lib/planning-expanded-shift-layout";
import {
  PlanningExpandedShiftCardText,
  PlanningShiftCardTextArea,
} from "@/components/planning/planning-expanded-shift-card-text";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import { buildPlanningShiftSegmentCardContent, resolvePlanningShiftJobsLabel, type PlanningShiftJobContext } from "@/lib/planning-shift-card-display";
import {
  planningShiftSegmentMaxWidthPx,
  planningShiftSegmentShowsEmployeeStrip,
  planningShiftSegmentTouchesDayBorder,
  type PlanningShiftDisplaySegment,
} from "@/lib/planning-overnight-shift-display";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";

/** Unterhalb: nur Farbbalken ohne Text. */
const MIN_WIDTH_FOR_TIME_PX = 40;
/** Unterhalb: nur Uhrzeit, kein Schichtname. */
const MIN_WIDTH_FOR_TITLE_PX = 64;

function segmentUniformKey(segment: PlanningShiftDisplaySegment): string {
  const base = planningExpandedShiftUniformKey(segment.shift);
  return segment.part === "full" ? base : `${base}:${segment.part}`;
}

function segmentBorderRadiusClass(part: PlanningShiftDisplaySegment["part"]): string {
  if (part === "overnight-start") return "rounded-l rounded-r-none";
  if (part === "overnight-end") return "rounded-r rounded-l-none";
  return "rounded";
}

function resolveStripWidthPx(cardWidthPx: number): number {
  return cardWidthPx > 0 && cardWidthPx < MIN_WIDTH_FOR_TIME_PX
    ? Math.max(2, Math.min(4, cardWidthPx))
    : SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX;
}

type Props = {
  segments: PlanningShiftDisplaySegment[];
  employeeName: string;
  employeeColor: string;
  assignmentPresets: readonly DashboardAssignmentPreset[];
  pending: boolean;
  selectedShiftId: string | null;
  onShiftClick: (shiftId: string) => void;
  /** Linksklick auf freien Zellbereich neben Schichtkarten — neue Schicht. */
  onEmptyAreaClick?: () => void;
  emptyAreaDisabled?: boolean;
  emptyAreaSelected?: boolean;
  emptyAreaLabel?: string;
  /** Rechtsklick auf Schichtkarte (aufgeklappte aktuelle/zukünftige Tage). */
  onShiftContextMenu?: (shiftId: string, event: React.MouseEvent) => void;
  /** Breite rechts freilassen — nur aufgeklappte Tage (Tag-Grenze erkennbar). */
  trailingLayoutInsetPx?: number;
  /** Einheitliche Breite pro Schichtart am Tag (kleinste Fair-Share-Breite). */
  uniformShiftWidthPxByKey?: ReadonlyMap<string, number>;
  shiftJobContext: PlanningShiftJobContext;
};

export function PlanningCellShiftRow({
  segments,
  employeeName,
  employeeColor,
  assignmentPresets,
  pending,
  selectedShiftId,
  onShiftClick,
  onEmptyAreaClick,
  emptyAreaDisabled = false,
  emptyAreaSelected = false,
  emptyAreaLabel,
  onShiftContextMenu,
  trailingLayoutInsetPx = PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
  uniformShiftWidthPxByKey,
  shiftJobContext,
}: Props) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackWidthPerShiftPx, setFallbackWidthPerShiftPx] = useState(0);

  const usesUniformWidths =
    uniformShiftWidthPxByKey !== undefined && uniformShiftWidthPxByKey.size > 0;

  const touchesDayBorder = segments.some((segment) =>
    planningShiftSegmentTouchesDayBorder(segment.part)
  );
  const effectiveTrailingInsetPx = touchesDayBorder ? 0 : trailingLayoutInsetPx;

  useLayoutEffect(() => {
    if (usesUniformWidths) {
      setFallbackWidthPerShiftPx(0);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    function updateWidth() {
      if (!container) return;
      const count = segments.length;
      if (count === 0) {
        setFallbackWidthPerShiftPx(0);
        return;
      }
      const gaps = Math.max(0, count - 1) * PLANNING_EXPANDED_SHIFT_CELL_GAP_PX;
      const layoutWidthPx = Math.max(0, container.clientWidth - effectiveTrailingInsetPx);
      setFallbackWidthPerShiftPx(Math.max(0, (layoutWidthPx - gaps) / count));
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [segments.length, effectiveTrailingInsetPx, usesUniformWidths]);

  const segmentWidthsPx = useMemo(() => {
    const count = segments.length;
    if (count === 0) return new Map<string, number>();

    const gaps = Math.max(0, count - 1) * PLANNING_EXPANDED_SHIFT_CELL_GAP_PX;
    const layoutWidthPx = Math.max(
      0,
      (containerRef.current?.clientWidth ?? 0) - effectiveTrailingInsetPx
    );
    const localFairSharePx =
      fallbackWidthPerShiftPx > 0
        ? fallbackWidthPerShiftPx
        : layoutWidthPx > 0
          ? Math.max(0, (layoutWidthPx - gaps) / count)
          : 0;

    const widths = new Map<string, number>();
    for (const segment of segments) {
      const uniformKey = segmentUniformKey(segment);
      const uniformWidth = uniformShiftWidthPxByKey?.get(uniformKey);
      const baseWidthPx =
        uniformWidth !== undefined && uniformWidth > 0
          ? uniformWidth
          : localFairSharePx;
      widths.set(
        `${segment.shift.id}:${segment.part}`,
        Math.min(
          baseWidthPx,
          planningShiftSegmentMaxWidthPx(layoutWidthPx, segment.part)
        )
      );
    }
    return widths;
  }, [
    segments,
    uniformShiftWidthPxByKey,
    fallbackWidthPerShiftPx,
    effectiveTrailingInsetPx,
  ]);

  if (segments.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex w-full min-w-0 flex-1 items-stretch"
      style={{
        minHeight: PLANNING_CELL_HEIGHT_PX,
        gap: PLANNING_EXPANDED_SHIFT_CELL_GAP_PX,
      }}
    >
      {segments.map((segment) => {
        const { shift, part } = segment;
        const segmentKey = `${shift.id}:${part}`;
        const isSelected = selectedShiftId === shift.id;
        const cardWidthPx = segmentWidthsPx.get(segmentKey) ?? 0;
        const showAnyText = cardWidthPx >= MIN_WIDTH_FOR_TIME_PX;
        const showTitle = cardWidthPx >= MIN_WIDTH_FOR_TITLE_PX;
        const stripWidthPx = resolveStripWidthPx(cardWidthPx);
        const confirmationStatusLine =
          shift.confirmationStatus &&
          shift.confirmationStatus !== "confirmed"
            ? t(shiftConfirmationStatusLabelKey(shift.confirmationStatus))
            : undefined;
        const showEmployeeStrip = planningShiftSegmentShowsEmployeeStrip(part);
        const jobsLabel = resolvePlanningShiftJobsLabel(shift, shiftJobContext);
        const jobsLine = jobsLabel.trim()
          ? t("common.shiftCardTooltipJob", { names: jobsLabel })
          : null;
        const cardContent = buildPlanningShiftSegmentCardContent(
          shift,
          assignmentPresets,
          part,
          {
            employeeName,
            confirmationStatusLine,
            jobsLabel,
            formatTemplateTooltipLine: (templateName) =>
              t("common.shiftCardTooltipShift", { name: templateName }),
            formatJobTooltipLine: (names) =>
              t("common.shiftCardTooltipJob", { names }),
          }
        );

        return (
          <Tooltip
            key={segmentKey}
            content={<ShiftCardTooltipContent data={cardContent.tooltip} />}
            className={cn(
              "inline-flex max-w-full min-w-0 shrink-0",
              part === "overnight-start" && "ml-auto"
            )}
            placement={{
              anchorLeftToTriggerCenter: true,
              gapPx: 2,
              side: "above",
            }}
          >
            <button
              type="button"
              disabled={pending}
              onClick={() => onShiftClick(shift.id)}
              onContextMenu={(event) => {
                if (!onShiftContextMenu) return;
                event.preventDefault();
                event.stopPropagation();
                onShiftContextMenu(shift.id, event);
              }}
              className={cn(
                "relative flex shrink-0 overflow-hidden text-left text-black transition hover:opacity-90 disabled:opacity-50",
                segmentBorderRadiusClass(part),
                isSelected && "ring-2 ring-primary ring-offset-1"
              )}
              style={{
                boxShadow: DASHBOARD_SHIFT_CARD_BOX_SHADOW,
                height: "100%",
                minHeight: PLANNING_CELL_HEIGHT_PX,
                width: cardWidthPx > 0 ? cardWidthPx : undefined,
              }}
              aria-label={cardContent.tooltipBody}
            >
              {showEmployeeStrip ? (
                <div
                  className={cn(
                    "shrink-0 self-stretch",
                    part !== "full" && "rounded-l"
                  )}
                  style={{
                    width: stripWidthPx,
                    backgroundColor: employeeColor,
                  }}
                  aria-hidden
                />
              ) : null}
              <PlanningShiftCardTextArea
                backgroundImage={buildPlanningShiftSegmentGradientCss(
                  part,
                  shift.startTime,
                  shift.endTime
                )}
              >
                {showAnyText ? (
                  <PlanningExpandedShiftCardText
                    templateName={cardContent.templateName}
                    timeLabel={cardContent.timeLabel}
                    jobsLine={jobsLine}
                    compact={!showTitle}
                  />
                ) : null}
                <PlanningShiftCardConfirmationOverlay
                  status={shift.confirmationStatus}
                />
              </PlanningShiftCardTextArea>
            </button>
          </Tooltip>
        );
      })}
      {onEmptyAreaClick ? (
        <button
          type="button"
          disabled={emptyAreaDisabled}
          onClick={onEmptyAreaClick}
          className={cn(
            "min-w-0 flex-1 self-stretch rounded-lg border-0 bg-transparent p-0 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-primary/5",
            emptyAreaSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
          )}
          style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
          aria-label={emptyAreaLabel}
        />
      ) : null}
    </div>
  );
}
