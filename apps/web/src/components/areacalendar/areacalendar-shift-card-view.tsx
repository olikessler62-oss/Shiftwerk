"use client";

import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import {
  AREA_CALENDAR_SHIFT_CARD_EXTRA_HEIGHT_PX,
  AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  areaCalendarShiftCardListItemHeightPx,
  SHIFT_CARD_EXTRA_HEIGHT_PX,
} from "@/lib/shift-card-row-layout";
import {
  buildShiftCardDisplayContent,
  resolveJobLabelsForEmployee,
  formatShiftCardTooltipPlainText,
  type ShiftCardDisplayContent,
  type ShiftCardDensity,
} from "@/lib/shift-card-display-content";
import type { ShiftCardDisplayState, ShiftConfirmationStatus } from "@schichtwerk/types";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui";
import { DashboardShiftCardConfirmationOverlay } from "@/components/dashboard/dashboard-shift-card-confirmation-overlay";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import { useTranslations } from "@/i18n/locale-provider";
import { useShiftConfirmationPendingAfterMinutes } from "@/lib/org-features-provider";
import { cn } from "@/lib/cn";
import {
  buildEmployeeShiftHighlightBoxShadow,
  employeeShiftHighlightOverlayStyle,
  preventPointerTextSelection,
  SHIFT_CARD_INTERACTIVE_CLASS,
} from "@/lib/calendar-interaction-ui";
import {
  shiftConfirmationShowsOverlay,
  SHIFT_CARD_UNRESOLVED_OPACITY,
  shiftConfirmationShowsUnresolvedCardStyle,
  shiftConfirmationTooltipStatusLabelKey,
} from "@/lib/shift-confirmation-display";
import { resolveShiftCardConfirmationStatusForCalendar } from "@/lib/shift-card-calendar-confirmation-status";
import { hasPendingEmployeeCancellation } from "@schichtwerk/database";
import { ShiftPendingCancellationOverlay } from "@/components/dashboard/shift-pending-cancellation-overlay";
import { isPastShiftDate } from "@/lib/planning-readonly";
import {
  canOpenShiftCardContextMenu,
  handleShiftCardContextMenuPointerEvent,
  planningShiftCardShowsPointerCursor,
} from "@/lib/shift-card-context-menu-actions";

export type AreaCalendarShiftCard = {
  id: string;
  shift_date: string;
  locationAreaId: string | null;
  areaShiftTemplateId: string | null;
  employeeId: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  employeeName: string;
  employeeColor: string | null;
  confirmationStatus?: ShiftConfirmationStatus;
  /** Gesetzt, wenn mindestens einmal Bestätigung angefragt wurde. */
  requestedAt?: string | null;
  /** Zeitpunkt des letzten Statuswechsels (für Tab „Bestätigt“). */
  confirmationStatusUpdatedAt?: string | null;
  /** Abgeleiteter Anzeige-Status aus lifecycle + shift_requests. */
  displayState?: ShiftCardDisplayState;
  /** Tätigkeit in dieser Schicht (aus Personalbedarf-Zuordnung). */
  jobName?: string | null;
};

const DASHBOARD_SHIFT_CARD_CLASS =
  "relative flex shrink-0 overflow-hidden rounded";

/** Kompakter Schatten — hebt weiße Karten vom leicht grauen Zellhintergrund ab. */
export const AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW =
  "0 1px 2px rgba(0, 0, 0, 0.32), 0 2px 4px rgba(0, 0, 0, 0.07), 0 0 0 1px rgba(0, 0, 0, 0.12)";

const AREA_CALENDAR_SHIFT_CARD_MARKER_MIN_HEIGHT_PX =
  16 + SHIFT_CARD_EXTRA_HEIGHT_PX + AREA_CALENDAR_SHIFT_CARD_EXTRA_HEIGHT_PX;

const DASHBOARD_SHIFT_CARD_CONTENT_CLASS =
  "flex min-w-0 flex-1 bg-white px-1.5 py-0.5 text-black";

const DASHBOARD_SHIFT_CARD_EMPLOYEE_FALLBACK_COLOR = "#94a3b8";

type Props = {
  shift: AreaCalendarShiftCard;
  display: ShiftCardDisplayContent;
  widthPx?: number;
  marginLeftPx?: number;
  density: ShiftCardDensity;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  /** Kalendertag der Zelle — für Cursor auf vergangenen Tagen. */
  cellDateISO?: string;
  confirmationStatusLabel?: string;
  employeeHighlighted?: boolean;
};

function ShiftCardTextRows({
  display,
  density,
  inlineStatusLabel,
}: {
  display: ShiftCardDisplayContent;
  density: ShiftCardDensity;
  inlineStatusLabel?: string;
}) {
  const secondaryLabel =
    display.templateName?.trim() || display.shiftLabel.trim();
  const employeeLine = display.lastName
    ? `${display.firstName} ${display.lastName}`
    : display.firstName;

  if (density === "marker") {
    return (
      <div className="flex min-w-0 flex-1 items-center overflow-hidden px-0.5">
        <span className="min-w-[1ch] max-w-full truncate text-[9px] font-bold leading-none">
          {display.firstName}
        </span>
      </div>
    );
  }

  if (density === "compact") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[11px]">
        <span className="min-w-[1ch] max-w-[45%] truncate font-bold leading-tight">
          {display.firstName}
        </span>
        <span className="min-w-[1ch] max-w-full truncate tabular-nums leading-tight">
          {secondaryLabel ? (
            <>
              <span className="font-bold">{secondaryLabel}</span>
              <span className="font-normal"> {display.timeLabel}</span>
            </>
          ) : (
            <span className="font-bold">{display.timeLabel}</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-px overflow-hidden">
      <div
        className="min-w-[1ch] max-w-full truncate text-[11px] font-bold leading-tight"
      >
        {employeeLine}
      </div>
      <div className="min-w-[1ch] max-w-full truncate text-[10px] leading-tight tabular-nums">
        {secondaryLabel ? (
          <>
            <span className="font-bold">{secondaryLabel}</span>
            <span className="font-normal"> {display.timeLabel}</span>
          </>
        ) : (
          <span className="font-bold">{display.timeLabel}</span>
        )}
      </div>
      {display.jobsLabel ? (
        <div className="-mt-0.5 min-w-[1ch] max-w-full truncate text-[10px] leading-tight">
          {display.jobsLabel}
        </div>
      ) : null}
      {inlineStatusLabel ? (
        <div className="min-w-[1ch] max-w-full truncate text-[10px] font-semibold leading-tight text-neutral-600">
          {inlineStatusLabel}
        </div>
      ) : null}
    </div>
  );
}

export function AreaCalendarShiftCardView({
  shift,
  display,
  widthPx,
  marginLeftPx,
  density,
  onClick,
  onContextMenu,
  cellDateISO,
  confirmationStatusLabel,
  employeeHighlighted = false,
}: Props) {
  const t = useTranslations();
  const pendingAfterMinutes = useShiftConfirmationPendingAfterMinutes();
  const employeeColor =
    shift.employeeColor?.trim() || DASHBOARD_SHIFT_CARD_EMPLOYEE_FALLBACK_COLOR;

  const cardHeightPx =
    density === "marker"
      ? AREA_CALENDAR_SHIFT_CARD_MARKER_MIN_HEIGHT_PX
      : AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX;

  const calendarConfirmationStatus = resolveShiftCardConfirmationStatusForCalendar(
    shift,
    cellDateISO,
    pendingAfterMinutes
  );

  const showUnresolvedCardStyle = shiftConfirmationShowsUnresolvedCardStyle(
    calendarConfirmationStatus
  );

  const confirmationStatus = calendarConfirmationStatus;
  const pendingEmployeeCancellation = hasPendingEmployeeCancellation(
    shift.displayState
  );

  const showConfirmationOverlay =
    !pendingEmployeeCancellation &&
    density !== "marker" &&
    confirmationStatus &&
    shiftConfirmationShowsOverlay(confirmationStatus);

  const inlineStatusLabel =
    showUnresolvedCardStyle && confirmationStatus
      ? t(shiftConfirmationTooltipStatusLabelKey(confirmationStatus))
      : undefined;

  const isPastShift = isPastShiftDate(cellDateISO ?? shift.shift_date);

  const tooltipData = confirmationStatus
    ? {
        ...display.tooltip,
        confirmationStatusLine: t(
          shiftConfirmationTooltipStatusLabelKey(confirmationStatus)
        ),
        confirmationStatus,
        isPastShift,
      }
    : confirmationStatusLabel
    ? {
        ...display.tooltip,
        confirmationStatusLine: confirmationStatusLabel,
        confirmationStatus: shift.confirmationStatus,
        isPastShift,
      }
    : {
        ...display.tooltip,
        isPastShift,
      };
  const tooltipPlainText = confirmationStatus || confirmationStatusLabel
    ? formatShiftCardTooltipPlainText(tooltipData, {
        formatStatusLine: (status) =>
          `${t("common.shiftCardTooltipStatusLabel")} ${status}`,
      })
    : display.tooltipBody;

  const cardBoxShadow = employeeHighlighted
    ? buildEmployeeShiftHighlightBoxShadow(
        AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW,
        employeeColor
      )
    : AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW;
  const showsPointerCursor =
    Boolean(onClick) &&
    planningShiftCardShowsPointerCursor(
      {
        shift_date: shift.shift_date,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
      },
      cellDateISO ?? shift.shift_date,
      isPastShiftDate,
      { pendingAfterMinutes }
    );

  return (
    <div
      className={cn(
        "max-w-full shrink-0 self-start",
        employeeHighlighted && "relative z-10 overflow-visible"
      )}
      style={{
        height: areaCalendarShiftCardListItemHeightPx(cardHeightPx),
        ...(widthPx !== undefined ? { width: widthPx } : undefined),
        ...(marginLeftPx !== undefined ? { marginLeft: marginLeftPx } : undefined),
      }}
    >
      <Tooltip
        content={<ShiftCardTooltipContent data={tooltipData} />}
        contentClassName={shiftCardTooltipContentClassName}
        className="inline-flex w-fit max-w-full"
        placement={{
          anchorLeftToTriggerCenter: true,
          gapPx: 2,
          side: "above",
        }}
      >
        <div
          className={cn("rounded", employeeHighlighted && "overflow-visible")}
          style={{
            boxShadow: cardBoxShadow,
            ...(widthPx !== undefined ? { width: widthPx } : undefined),
            height: cardHeightPx,
            minHeight: cardHeightPx,
            ...(showUnresolvedCardStyle
              ? { opacity: SHIFT_CARD_UNRESOLVED_OPACITY }
              : undefined),
          }}
        >
          <div
            data-areacalendar-shift-card
            role={showsPointerCursor ? "button" : undefined}
            tabIndex={showsPointerCursor ? 0 : undefined}
            onClick={(event) => {
              if (!showsPointerCursor) return;
              event.stopPropagation();
              onClick?.();
            }}
            onMouseDown={
              showsPointerCursor && onClick
                ? preventPointerTextSelection
                : undefined
            }
            onContextMenu={
              onContextMenu
                ? (event) => {
                    handleShiftCardContextMenuPointerEvent(
                      event,
                      canOpenShiftCardContextMenu(
                        shift.confirmationStatus,
                        shift.requestedAt,
                        {
                          shiftDate: shift.shift_date,
                          cellDate: cellDateISO ?? shift.shift_date,
                          isPastShiftDate,
                          displayState: shift.displayState,
                        }
                      ),
                      () => onContextMenu(event)
                    );
                  }
                : undefined
            }
            onKeyDown={
              showsPointerCursor
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onClick?.();
                    }
                  }
                : undefined
            }
            className={cn(
              DASHBOARD_SHIFT_CARD_CLASS,
              "h-full",
              SHIFT_CARD_INTERACTIVE_CLASS,
              widthPx === undefined && "w-full",
              showsPointerCursor ? "cursor-pointer" : onClick && "!cursor-default"
            )}
            style={{
              ...(widthPx !== undefined ? { width: widthPx } : undefined),
              height: cardHeightPx,
              minHeight: cardHeightPx,
            }}
          >
        <div
          className="shrink-0 self-stretch"
          style={{
            width: SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
            backgroundColor: employeeColor,
          }}
          aria-hidden
        />
        {density === "marker" ? (
          <div
            className={cn(
              DASHBOARD_SHIFT_CARD_CONTENT_CLASS,
              "relative items-center overflow-hidden"
            )}
            style={{
              backgroundImage: buildShiftCardTimeGradientCss(
                shift.startTime,
                shift.endTime
              ),
            }}
          >
            <ShiftCardTextRows
              display={display}
              density={density}
              inlineStatusLabel={inlineStatusLabel}
            />
          </div>
        ) : (
          <div
            className={cn(
              DASHBOARD_SHIFT_CARD_CONTENT_CLASS,
              "relative items-center gap-1.5"
            )}
            style={{
              backgroundImage: buildShiftCardTimeGradientCss(
                shift.startTime,
                shift.endTime
              ),
            }}
          >
            {employeeHighlighted ? (
              <div
                className="pointer-events-none absolute inset-0"
                style={employeeShiftHighlightOverlayStyle(employeeColor)}
                aria-hidden
              />
            ) : null}
            <ShiftCardTextRows
              display={display}
              density={density}
              inlineStatusLabel={inlineStatusLabel}
            />
            {pendingEmployeeCancellation ? (
              <ShiftPendingCancellationOverlay />
            ) : showConfirmationOverlay ? (
              <DashboardShiftCardConfirmationOverlay status={confirmationStatus} />
            ) : null}
          </div>
        )}
          </div>
        </div>
      </Tooltip>
    </div>
  );
}

export { buildShiftCardDisplayContent, resolveJobLabelsForEmployee };
