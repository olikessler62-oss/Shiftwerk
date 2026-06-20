"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW } from "@/components/areacalendar/areacalendar-shift-card-view";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildEmployeeShiftHighlightBoxShadow,
  employeeShiftHighlightOverlayStyle,
  preventPointerTextSelection,
  SHIFT_CARD_INTERACTIVE_CLASS,
} from "@/lib/calendar-interaction-ui";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import {
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
} from "@/lib/planning-calendar-layout";
import {
  buildPlanningShiftSegmentGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import { PLANNING_EXPANDED_SHIFT_CELL_GAP_PX } from "@/lib/planning-expanded-shift-layout";
import {
  DashboardExpandedShiftCardText,
  DashboardShiftCardTextArea,
} from "@/components/dashboard/dashboard-expanded-shift-card-text";
import { DashboardShiftCardConfirmationOverlay } from "@/components/dashboard/dashboard-shift-card-confirmation-overlay";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import {
  buildPlanningShiftSegmentCardContent,
  resolvePlanningShiftJobsLabel,
  type PlanningShiftJobContext,
} from "@/lib/planning-shift-card-display";
import {
  planningShiftSegmentShowsEmployeeStrip,
  planningShiftSegmentTouchesDayBorder,
  type PlanningShiftDisplaySegment,
} from "@/lib/planning-overnight-shift-display";
import {
  shiftConfirmationTooltipStatusLabelKey,
} from "@/lib/shift-confirmation-display";
import { SHIFT_ABSENCE_CONFLICT_RING_CLASS } from "@/lib/shift-absence-conflict";
import { isPastShiftDate } from "@/lib/planning-readonly";
import {
  canOpenShiftCardContextMenu,
  handleShiftCardContextMenuPointerEvent,
  planningShiftCardShowsPointerCursor,
} from "@/lib/shift-card-context-menu-actions";

/** Unterhalb: nur Farbbalken ohne Text. */
const MIN_WIDTH_FOR_TIME_PX = 40;
/** Unterhalb: nur Uhrzeit, kein Schichtname. */
const MIN_WIDTH_FOR_TITLE_PX = 64;

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
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  pending: boolean;
  selectedShiftId: string | null;
  cellDate: string;
  onShiftClick: (shiftId: string) => void;
  /** Rechtsklick auf Schichtkarte (aufgeklappte aktuelle/zukünftige Tage). */
  onShiftContextMenu?: (shiftId: string, event: React.MouseEvent) => void;
  /** Breite rechts freilassen — nur aufgeklappte Tage (Tag-Grenze erkennbar). */
  trailingLayoutInsetPx?: number;
  shiftJobContext: PlanningShiftJobContext;
  employeeHighlighted?: boolean;
  absenceConflictShiftIds?: ReadonlySet<string>;
  swapRequestShiftIds?: ReadonlySet<string>;
  shiftConfirmationEnabled?: boolean;
};

export function DashboardCellShiftRow({
  segments,
  employeeName,
  employeeColor,
  assignmentPresets,
  pending,
  selectedShiftId,
  cellDate,
  onShiftClick,
  onShiftContextMenu,
  trailingLayoutInsetPx = PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
  shiftJobContext,
  employeeHighlighted = false,
  absenceConflictShiftIds,
  swapRequestShiftIds,
  shiftConfirmationEnabled = true,
}: Props) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);

  const touchesDayBorder = segments.some((segment) =>
    planningShiftSegmentTouchesDayBorder(segment.part)
  );
  const effectiveTrailingInsetPx = touchesDayBorder ? 0 : trailingLayoutInsetPx;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth() {
      if (!container) return;
      setContainerWidthPx(Math.max(0, container.clientWidth - effectiveTrailingInsetPx));
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [effectiveTrailingInsetPx, segments.length]);

  const widthPerSegmentPx = useMemo(() => {
    const count = segments.length;
    if (count === 0 || containerWidthPx <= 0) return 0;
    const gaps = Math.max(0, count - 1) * PLANNING_EXPANDED_SHIFT_CELL_GAP_PX;
    return Math.max(0, (containerWidthPx - gaps) / count);
  }, [containerWidthPx, segments.length]);

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
        const cardWidthPx = widthPerSegmentPx;
        const showAnyText = cardWidthPx >= MIN_WIDTH_FOR_TIME_PX;
        const showTitle = cardWidthPx >= MIN_WIDTH_FOR_TITLE_PX;
        const stripWidthPx = resolveStripWidthPx(cardWidthPx);
        const showEmployeeStrip = planningShiftSegmentShowsEmployeeStrip(part);
        const isPastShift = isPastShiftDate(cellDate);
        const confirmationStatusLine = shift.confirmationStatus
          ? t(shiftConfirmationTooltipStatusLabelKey(shift.confirmationStatus))
          : undefined;
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
            confirmationStatus: shift.confirmationStatus,
            jobsLabel,
            isPastShift,
            formatTemplateTooltipLine: (templateName) =>
              t("common.shiftCardTooltipShift", { name: templateName }),
            formatDeploymentTimeTooltipLine: () =>
              t("common.shiftCardTooltipDeploymentTimeLabel"),
            formatJobTooltipLine: (names) =>
              t("common.shiftCardTooltipJob", { names }),
            formatStatusTooltipLine: (status) =>
              `${t("common.shiftCardTooltipStatusLabel")} ${status}`,
          }
        );

        const cardBoxShadow = employeeHighlighted
          ? buildEmployeeShiftHighlightBoxShadow(
              AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW,
              employeeColor
            )
          : AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW;
        const showsPointerCursor = planningShiftCardShowsPointerCursor(
          {
            id: shift.id,
            shift_date: shift.shift_date,
            confirmationStatus: shift.confirmationStatus,
            requestedAt: shift.requestedAt,
            displayState: shift.displayState,
          },
          cellDate,
          isPastShiftDate,
          {
            shiftConfirmationEnabled,
            hasAbsenceConflict: absenceConflictShiftIds?.has(shift.id),
            hasSwapRequest: swapRequestShiftIds?.has(shift.id),
          }
        );

        return (
          <Tooltip
            key={segmentKey}
            content={<ShiftCardTooltipContent data={cardContent.tooltip} />}
            contentClassName={shiftCardTooltipContentClassName}
            className={cn(
              "inline-flex min-w-0 flex-1",
              part === "overnight-start" && "ml-auto",
              employeeHighlighted && "relative z-10 overflow-visible"
            )}
            placement={{
              anchorLeftToTriggerCenter: true,
              gapPx: 2,
              side: "above",
            }}
          >
            <div
              className={cn(
                "flex h-full min-h-0 w-full min-w-0 flex-1",
                segmentBorderRadiusClass(part)
              )}
              style={{
                boxShadow: cardBoxShadow,
                minHeight: PLANNING_CELL_HEIGHT_PX,
              }}
            >
              <button
                type="button"
                disabled={pending}
                onMouseDown={preventPointerTextSelection}
                onClick={() => onShiftClick(shift.id)}
                onContextMenu={(event) => {
                  if (!onShiftContextMenu) return;
                  handleShiftCardContextMenuPointerEvent(
                    event,
                    canOpenShiftCardContextMenu(
                      shift.confirmationStatus,
                      shift.requestedAt,
                      {
                        shiftDate: shift.shift_date,
                        cellDate,
                        isPastShiftDate,
                        displayState: shift.displayState,
                        hasAbsenceConflict: absenceConflictShiftIds?.has(shift.id),
                      }
                    ),
                    () => onShiftContextMenu(shift.id, event)
                  );
                }}
                className={cn(
                  "relative flex min-h-0 min-w-0 flex-1 overflow-hidden text-left text-black transition disabled:opacity-50",
                  SHIFT_CARD_INTERACTIVE_CLASS,
                  showsPointerCursor
                    ? "cursor-pointer hover:opacity-90"
                    : "!cursor-default",
                  segmentBorderRadiusClass(part),
                  isSelected && "ring-2 ring-primary ring-offset-1",
                  absenceConflictShiftIds?.has(shift.id) &&
                    !isSelected &&
                    SHIFT_ABSENCE_CONFLICT_RING_CLASS
                )}
                style={{
                  height: "100%",
                  minHeight: PLANNING_CELL_HEIGHT_PX,
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
              <DashboardShiftCardTextArea
                backgroundImage={buildPlanningShiftSegmentGradientCss(
                  part,
                  shift.startTime,
                  shift.endTime
                )}
              >
                {employeeHighlighted ? (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={employeeShiftHighlightOverlayStyle(employeeColor)}
                    aria-hidden
                  />
                ) : null}
                {showAnyText ? (
                  <DashboardExpandedShiftCardText
                    templateName={cardContent.templateName}
                    timeLabel={cardContent.timeLabel}
                    jobsLine={jobsLine}
                    compact={!showTitle}
                  />
                ) : null}
                <DashboardShiftCardConfirmationOverlay
                  status={shift.confirmationStatus}
                />
              </DashboardShiftCardTextArea>
              </button>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
