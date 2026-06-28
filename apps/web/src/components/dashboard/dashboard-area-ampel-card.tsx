"use client";

import Link from "next/link";
import { useState } from "react";
import { DashboardAreaStaffingIssuesModal } from "@/components/dashboard/dashboard-area-staffing-issues-modal";
import { DashboardStaffingRowCandidatesButton } from "@/components/dashboard/dashboard-staffing-row-candidates-button";
import {
  DashboardStaffingWindowIssuesModal,
} from "@/components/dashboard/dashboard-staffing-window-issues-modal";
import {
  DashboardStaffingRowCandidatesModal,
  type DashboardStaffingCandidatesPlanningContext,
} from "@/components/dashboard/dashboard-staffing-row-candidates-modal";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS, DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import type {
  DashboardAreaAmpelLevel,
  DashboardAreaWeekStats,
  DashboardStaffingIssue,
  DashboardStaffingWindowRow,
  DashboardStaffingWindowRowStatus,
} from "@/lib/dashboard-area-week-stats";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { shiftConfirmationConflictDotClass } from "@/lib/shift-confirmation-display";
import { formatTagAreaFooterMoney } from "@/lib/tag-area-footer-stats";
import { formatDurationHours } from "@/lib/shift-type-display";
import { isPastCalendarDate, toISODate } from "@/lib/dates";
import { CALENDAR_TODAY_WEEKDAY_TEXT_CLASS } from "@/lib/calendar-day-header-styles";
import {
  isAreaStaffingUncovered,
  isStaffingHeaderStatusClickable,
} from "@/lib/dashboard-area-header-actions";
import {
  findFirstRowWithConfirmationStatus,
  findFirstStaffingCandidatesRow,
  staffingRowShowsIssuesButton,
  type DashboardStaffingWindowIssuesContext,
} from "@/lib/dashboard-staffing-window-issues";
import { DASHBOARD_TEXT_LINK_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";

type Props = {
  stats: DashboardAreaWeekStats;
  staffingEnabled: boolean;
  areaCalendarHref: string;
  employeeCalendarHref: string;
  candidatesPlanning?: Omit<
    DashboardStaffingCandidatesPlanningContext,
    "areaId" | "areaName" | "areaCalendarHref"
  > | null;
  showCalendarFooterLinks?: boolean;
  isPastScope?: boolean;
  todayISO?: string;
  staffingScopeDateLabel?: string | null;
  shiftConfirmationEnabled?: boolean;
  windowIssuesContext?: Omit<
    DashboardStaffingWindowIssuesContext,
    "areaId" | "areaName" | "areaCalendarHref"
  > | null;
};

function ampelAccentStripeClass(level: DashboardAreaAmpelLevel): string {
  return isAreaStaffingUncovered(level) ? "bg-red-600" : "bg-emerald-600";
}

function staffingCountClassName(
  row: DashboardStaffingWindowRow,
  isPastDay: boolean,
  shiftConfirmationEnabled: boolean
): string {
  if (staffingRowShowsIssuesButton(row, shiftConfirmationEnabled)) {
    return isPastDay
      ? "font-semibold text-amber-950"
      : "font-semibold text-[#CA8A04]";
  }

  const status = row.status;
  if (isPastDay) {
    switch (status) {
      case "understaffed":
        return "font-semibold text-red-950";
      case "planned":
        return "font-semibold text-amber-950";
      case "overstaffed":
        return "font-semibold text-amber-950";
      case "met":
        return "font-semibold text-emerald-950";
    }
  }

  switch (status) {
    case "understaffed":
      return "font-semibold text-red-600";
    case "planned":
      return "font-semibold text-yellow-600";
    case "overstaffed":
      return "font-semibold text-amber-700";
    case "met":
      return "font-semibold text-emerald-700";
  }
}

function staffingHeaderAssignedClassName(
  assigned: number,
  required: number,
  assignmentMismatch = false
): string {
  if (assignmentMismatch && assigned >= required) return "text-[#CA8A04]";
  if (assigned < required) return "text-red-600";
  if (assigned > required) return "text-blue-600";
  return "text-emerald-600";
}

function StaffingHeaderRatio({
  assigned,
  required,
  assignmentMismatch = false,
}: {
  assigned: number;
  required: number;
  assignmentMismatch?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-xl font-semibold tabular-nums leading-none tracking-tight",
        staffingHeaderAssignedClassName(assigned, required, assignmentMismatch)
      )}
    >
      {assigned}/{required}
    </p>
  );
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right text-sm font-medium tabular-nums text-foreground",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CardMetricsPanel({
  shiftCount,
  totalHours,
  hasCompensation,
  baseCost,
  surchargeCost,
  totalCost,
  money,
  t,
}: {
  shiftCount: number;
  totalHours: number;
  hasCompensation: boolean;
  baseCost: number;
  surchargeCost: number;
  totalCost: number;
  money: (amount: number) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  const shiftCountLabel =
    shiftCount === 1
      ? t("dashboard.summaryShiftCountOne")
      : t("dashboard.summaryShiftCountMany", { count: shiftCount });

  return (
    <div className={cn("overflow-hidden border border-border/70 bg-background/40", DASHBOARD_PANEL_ROUNDED_CLASS)}>
      <div className="space-y-1.5 px-3 py-2.5">
        <DetailRow label={t("dashboard.ampelDetailShifts")} value={shiftCountLabel} />
        <DetailRow
          label={t("dashboard.ampelDetailHours")}
          value={t("dashboard.ampelHours", {
            hours: formatDurationHours(totalHours),
          })}
        />
      </div>

      {hasCompensation ? (
        <>
          <div className="space-y-1.5 border-t border-border/50 px-3 py-2.5">
            <DetailRow
              label={t("dashboard.ampelDetailBaseCompensation")}
              value={money(baseCost)}
            />
            <DetailRow
              label={t("dashboard.kpiSurcharges")}
              value={
                surchargeCost > 0 ? `+${money(surchargeCost)}` : money(0)
              }
            />
          </div>
          <div className="border-t-2 border-border/80 bg-background/55 px-3 py-2.5">
            <DetailRow
              label={t("dashboard.kpiTotalCost")}
              value={money(totalCost)}
              valueClassName="text-base font-semibold"
            />
          </div>
        </>
      ) : (
        <div className="border-t-2 border-border/80 bg-background/55 px-3 py-2.5">
          <DetailRow
            label={t("dashboard.kpiTotalCost")}
            value={t("dashboard.ampelCompensationIncomplete")}
            valueClassName="text-muted"
          />
        </div>
      )}
    </div>
  );
}

const NO_SERVICE_HOURS_TEXT_CLASS = "text-[#718095]";

function staffingRowShowsCandidatesButton(
  row: DashboardStaffingWindowRow,
  isPastDay: boolean
): boolean {
  return (
    !isPastDay &&
    row.rowKind === "staffing_window" &&
    (row.status === "understaffed" || row.status === "planned")
  );
}

type StaffingWindowRowViewProps = {
  row: DashboardStaffingWindowRow;
  rowIndex: number;
  rows: readonly DashboardStaffingWindowRow[];
  isPastDay: boolean;
  isToday: boolean;
  isNoServiceHours: boolean;
  showShiftColumn: boolean;
  noServiceHoursLabel: string;
  shiftConfirmationEnabled: boolean;
  windowIssuesEnabled: boolean;
  candidatesButtonLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
};

function resolveStaffingWindowRowFlags(
  row: DashboardStaffingWindowRow,
  rowIndex: number,
  rows: readonly DashboardStaffingWindowRow[],
  todayISO: string,
  shiftConfirmationEnabled: boolean,
  windowIssuesEnabled: boolean
) {
  const isPastDay = isPastCalendarDate(row.dateISO, todayISO);
  const isToday = row.dateISO === todayISO;
  const isNoServiceHours = row.rowKind === "no_service_hours";
  const showDayLabel =
    rowIndex === 0 || rows[rowIndex - 1]?.dateISO !== row.dateISO;
  const showCandidatesButton = staffingRowShowsCandidatesButton(row, isPastDay);
  const showIssuesButton =
    (row.staffingConflicts?.length ?? 0) > 0 ||
    (row.staffingHints?.length ?? 0) > 0;
  const showWindowIssuesButton =
    windowIssuesEnabled &&
    staffingRowShowsIssuesButton(row, shiftConfirmationEnabled) &&
    !showIssuesButton;

  return {
    isPastDay,
    isToday,
    isNoServiceHours,
    showDayLabel,
    showCandidatesButton,
    showIssuesButton,
    showWindowIssuesButton,
  };
}

function StaffingWindowRowActions({
  showCandidatesButton,
  showIssuesButton,
  showWindowIssuesButton,
  candidatesButtonLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  row,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
}: {
  showCandidatesButton: boolean;
  showIssuesButton: boolean;
  showWindowIssuesButton: boolean;
  candidatesButtonLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  row: DashboardStaffingWindowRow;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
}) {
  if (!showCandidatesButton && !showIssuesButton && !showWindowIssuesButton) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
      {showCandidatesButton ? (
        <DashboardStaffingRowCandidatesButton
          variant="candidates"
          ariaLabel={candidatesButtonLabel}
          onClick={() => onOpenCandidates?.(row)}
        />
      ) : null}
      {showIssuesButton ? (
        <DashboardStaffingRowCandidatesButton
          variant="staffingIssues"
          ariaLabel={staffingIssuesButtonLabel}
          onClick={() => onOpenStaffingIssues?.(row)}
        />
      ) : null}
      {showWindowIssuesButton ? (
        <DashboardStaffingRowCandidatesButton
          variant="windowIssues"
          ariaLabel={windowIssuesButtonLabel}
          onClick={() => onOpenWindowIssues?.(row)}
        />
      ) : null}
    </div>
  );
}

function StaffingWindowMobileList({
  rows,
  noServiceHoursLabel,
  shiftConfirmationEnabled,
  windowIssuesEnabled,
  showShiftColumn,
  candidatesButtonLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
  todayISO,
}: Omit<
  StaffingWindowRowViewProps,
  | "row"
  | "rowIndex"
  | "isPastDay"
  | "isToday"
  | "isNoServiceHours"
> & {
  rows: DashboardStaffingWindowRow[];
  todayISO: string;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className="divide-y divide-border/50 md:hidden">
      {rows.map((row, rowIndex) => {
        const flags = resolveStaffingWindowRowFlags(
          row,
          rowIndex,
          rows,
          todayISO,
          shiftConfirmationEnabled,
          windowIssuesEnabled
        );

        return (
          <li
            key={`${row.dateISO}:${row.serviceHourId}`}
            className={cn(
              "flex items-start gap-2 px-3 py-2",
              flags.isPastDay && "bg-muted/14",
              flags.isNoServiceHours
                ? NO_SERVICE_HOURS_TEXT_CLASS
                : "text-foreground"
            )}
          >
            <div className="min-w-0 flex-1">
              {flags.showDayLabel ? (
                <p
                  className={cn(
                    "text-xs font-medium",
                    flags.isToday &&
                      !flags.isNoServiceHours &&
                      CALENDAR_TODAY_WEEKDAY_TEXT_CLASS
                  )}
                >
                  {row.weekdayLabel}
                </p>
              ) : null}
              <p
                className={cn(
                  "text-sm",
                  !flags.isNoServiceHours && "tabular-nums"
                )}
              >
                {flags.isNoServiceHours
                  ? noServiceHoursLabel
                  : `${row.timeFrom} – ${row.timeTo}`}
              </p>
              {showShiftColumn && !flags.isNoServiceHours && row.shiftName ? (
                <p className="truncate text-xs text-muted">{row.shiftName}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {flags.isNoServiceHours && !row.hasUnplannedShifts ? null : (
                <span
                  className={staffingCountClassName(
                    row,
                    flags.isPastDay,
                    shiftConfirmationEnabled
                  )}
                >
                  {row.assigned}/{row.required}
                </span>
              )}
              <StaffingWindowRowActions
                {...flags}
                candidatesButtonLabel={candidatesButtonLabel}
                staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                windowIssuesButtonLabel={windowIssuesButtonLabel}
                row={row}
                onOpenCandidates={onOpenCandidates}
                onOpenStaffingIssues={onOpenStaffingIssues}
                onOpenWindowIssues={onOpenWindowIssues}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StaffingWindowTable({
  rows,
  dayColumnLabel,
  timeColumnLabel,
  shiftColumnLabel,
  staffingColumnLabel,
  noServiceHoursLabel,
  unplannedShiftLabel,
  candidatesButtonLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
  todayISO,
  shiftConfirmationEnabled = false,
  windowIssuesEnabled = false,
  showShiftColumn = false,
}: {
  rows: DashboardStaffingWindowRow[];
  dayColumnLabel: string;
  timeColumnLabel: string;
  shiftColumnLabel: string;
  staffingColumnLabel: string;
  noServiceHoursLabel: string;
  unplannedShiftLabel: string;
  candidatesButtonLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
  todayISO: string;
  shiftConfirmationEnabled?: boolean;
  windowIssuesEnabled?: boolean;
  showShiftColumn?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "overflow-hidden border border-border/70 bg-background/30",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        MODAL_SCROLLBAR_CLASS
      )}
    >
      <StaffingWindowMobileList
        rows={rows}
        noServiceHoursLabel={noServiceHoursLabel}
        shiftConfirmationEnabled={shiftConfirmationEnabled}
        windowIssuesEnabled={windowIssuesEnabled}
        showShiftColumn={showShiftColumn}
        candidatesButtonLabel={candidatesButtonLabel}
        staffingIssuesButtonLabel={staffingIssuesButtonLabel}
        windowIssuesButtonLabel={windowIssuesButtonLabel}
        onOpenCandidates={onOpenCandidates}
        onOpenStaffingIssues={onOpenStaffingIssues}
        onOpenWindowIssues={onOpenWindowIssues}
        todayISO={todayISO}
      />
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[13%]" />
          <col className={showShiftColumn ? "w-[28%]" : "w-[42%]"} />
          {showShiftColumn ? <col /> : null}
          <col className="w-[5.25rem]" />
          <col className="w-8" />
        </colgroup>
        <thead>
          <tr className="border-b border-border/70 bg-background/60 text-muted">
            <th className="px-2.5 py-1 text-left text-sm font-medium">
              {dayColumnLabel}
            </th>
            <th className="px-2.5 py-1 text-left text-sm font-medium">
              {timeColumnLabel}
            </th>
            {showShiftColumn ? (
              <th className="px-2.5 py-1 text-left text-sm font-medium">
                {shiftColumnLabel}
              </th>
            ) : null}
            <th className="px-2 py-1 text-right text-sm font-medium leading-tight">
              {staffingColumnLabel}
            </th>
            <th className="w-8 px-0 py-1" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const flags = resolveStaffingWindowRowFlags(
              row,
              rowIndex,
              rows,
              todayISO,
              shiftConfirmationEnabled,
              windowIssuesEnabled
            );

            return (
            <tr
              key={`${row.dateISO}:${row.serviceHourId}`}
              className={cn(
                "border-b border-border/40 last:border-b-0",
                flags.isPastDay && "bg-muted/14",
                flags.isNoServiceHours
                  ? NO_SERVICE_HOURS_TEXT_CLASS
                  : "text-foreground"
              )}
            >
              <td
                className={cn(
                  "px-2.5 py-0.5 font-medium",
                  flags.isToday &&
                    flags.showDayLabel &&
                    !flags.isNoServiceHours &&
                    CALENDAR_TODAY_WEEKDAY_TEXT_CLASS
                )}
              >
                {flags.showDayLabel ? row.weekdayLabel : null}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap px-2.5 py-0.5",
                  !flags.isNoServiceHours && "tabular-nums"
                )}
              >
                {flags.isNoServiceHours
                  ? noServiceHoursLabel
                  : `${row.timeFrom} – ${row.timeTo}`}
              </td>
              {showShiftColumn ? (
                <td className="min-w-0 px-2.5 py-0.5">
                  {flags.isNoServiceHours ? null : row.shiftName ? (
                    <span className="block truncate" title={row.shiftName}>
                      {row.shiftName}
                    </span>
                  ) : null}
                </td>
              ) : null}
              <td className="w-[5.25rem] px-2 py-0.5 text-right tabular-nums">
                {flags.isNoServiceHours && !row.hasUnplannedShifts ? null : (
                  <span
                    className={staffingCountClassName(
                      row,
                      flags.isPastDay,
                      shiftConfirmationEnabled
                    )}
                  >
                    {row.assigned}/{row.required}
                  </span>
                )}
              </td>
              <td className="w-8 px-0 py-0.5 align-middle">
                <StaffingWindowRowActions
                  {...flags}
                  candidatesButtonLabel={candidatesButtonLabel}
                  staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                  windowIssuesButtonLabel={windowIssuesButtonLabel}
                  row={row}
                  onOpenCandidates={onOpenCandidates}
                  onOpenStaffingIssues={onOpenStaffingIssues}
                  onOpenWindowIssues={onOpenWindowIssues}
                />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const CARD_CONTENT_CLASS = "flex min-w-0 flex-1 flex-col";

const CARD_HEADER_CLASS = cn(
  "grid min-h-0 min-w-0 grid-cols-1 items-start gap-2 overflow-y-hidden px-3 py-2 md:h-[5.25rem] md:grid-cols-[minmax(0,1fr)_auto] md:gap-3 md:px-4",
  DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS
);

const CARD_HEADER_MAIN_CLASS = "flex min-w-0 flex-col justify-between py-0.5";

const CARD_HEADER_STATUS_COLUMN_CLASS =
  "flex w-full min-h-0 max-h-full shrink-0 flex-col items-stretch justify-start gap-0 self-stretch overflow-y-auto py-0.5 md:w-max";

function areaCardStatusBadgeProps(
  level: DashboardAreaAmpelLevel,
  isPastScope: boolean,
  t: ReturnType<typeof useTranslations>
): { label: string; dotClassName: string; labelClassName: string } {
  if (isAreaStaffingUncovered(level)) {
    if (isPastScope) {
      return {
        label: t("dashboard.ampelBadgeCriticalPast"),
        dotClassName: "bg-foreground/45",
        labelClassName: "text-foreground/80",
      };
    }

    return {
      label: t("dashboard.ampelBadgeCritical"),
      dotClassName: "bg-red-600",
      labelClassName: "text-foreground/90",
    };
  }

  return {
    label: t("dashboard.ampelStatusCovered"),
    dotClassName: "bg-emerald-600",
    labelClassName: "text-foreground/90",
  };
}

const AREA_HEADER_STATUS_BADGE_CLASS =
  "flex shrink-0 items-center gap-1.5 text-xs font-medium leading-4 max-md:whitespace-normal md:whitespace-nowrap";

function AreaCardHeaderStatusLine({
  dotClassName,
  labelClassName,
  label,
  onClick,
}: {
  dotClassName: string;
  labelClassName: string;
  label: string;
  onClick?: () => void;
}) {
  const className = cn(
    AREA_HEADER_STATUS_BADGE_CLASS,
    onClick &&
      "cursor-pointer rounded-sm hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  );

  const content = (
    <>
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", dotClassName)}
        aria-hidden
      />
      <span className={labelClassName}>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function AreaCardHeaderStatusList({
  staffingEnabled,
  shiftConfirmationEnabled,
  statusBadge,
  confirmationConflictStatuses,
  showStaffingIssuesButton,
  staffingStatusClickable,
  onOpenStaffingCandidates,
  onOpenStaffingIssues,
  onOpenConfirmationIssues,
  t,
}: {
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  statusBadge: { label: string; dotClassName: string; labelClassName: string };
  confirmationConflictStatuses: readonly ShiftConfirmationStatus[];
  showStaffingIssuesButton: boolean;
  staffingStatusClickable: boolean;
  onOpenStaffingCandidates?: () => void;
  onOpenStaffingIssues: () => void;
  onOpenConfirmationIssues?: (status: ShiftConfirmationStatus) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasStaffingStatus = staffingEnabled;
  const hasConfirmationStatuses =
    shiftConfirmationEnabled && confirmationConflictStatuses.length > 0;

  if (!hasStaffingStatus && !hasConfirmationStatuses && !showStaffingIssuesButton) {
    return null;
  }

  return (
    <div className={cn(CARD_HEADER_STATUS_COLUMN_CLASS, MODAL_SCROLLBAR_CLASS)}>
      {hasStaffingStatus ? (
        <AreaCardHeaderStatusLine
          dotClassName={statusBadge.dotClassName}
          labelClassName={statusBadge.labelClassName}
          label={statusBadge.label}
          onClick={staffingStatusClickable ? onOpenStaffingCandidates : undefined}
        />
      ) : null}
      {hasConfirmationStatuses
        ? confirmationConflictStatuses.map((status) => (
            <AreaCardHeaderStatusLine
              key={status}
              dotClassName={shiftConfirmationConflictDotClass(status)}
              labelClassName="text-foreground/85"
              label={t(`dashboard.ampelHeaderConfirmationConflict.${status}`)}
              onClick={
                onOpenConfirmationIssues
                  ? () => onOpenConfirmationIssues(status)
                  : undefined
              }
            />
          ))
        : null}
      {showStaffingIssuesButton ? (
        <AreaCardHeaderStatusLine
          dotClassName="bg-[#CA8A04]"
          labelClassName="text-foreground/85"
          label={t("dashboard.ampelHeaderStaffingConflicts")}
          onClick={onOpenStaffingIssues}
        />
      ) : null}
    </div>
  );
}

function AreaCardHeader({
  areaName,
  staffingEnabled,
  stats,
  isPastScope,
  staffingScopeDateLabel = null,
  shiftConfirmationEnabled = false,
  staffingStatusClickable,
  onOpenStaffingCandidates,
  onOpenStaffingIssues,
  onOpenConfirmationIssues,
  t,
}: {
  areaName: string;
  staffingEnabled: boolean;
  stats: DashboardAreaWeekStats;
  isPastScope: boolean;
  staffingScopeDateLabel?: string | null;
  shiftConfirmationEnabled?: boolean;
  staffingStatusClickable: boolean;
  onOpenStaffingCandidates?: () => void;
  onOpenStaffingIssues: () => void;
  onOpenConfirmationIssues?: (status: ShiftConfirmationStatus) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const showStaffingIssuesButton =
    staffingEnabled && stats.staffingIssues.length > 0;
  const statusBadge = areaCardStatusBadgeProps(stats.ampelLevel, isPastScope, t);
  const showStatusList =
    staffingEnabled ||
    showStaffingIssuesButton ||
    (shiftConfirmationEnabled && stats.confirmationConflictStatuses.length > 0);

  return (
    <div className={CARD_HEADER_CLASS}>
      <div className={CARD_HEADER_MAIN_CLASS}>
        <h2 className="min-w-0 truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
          {areaName}
        </h2>

        {staffingEnabled ? (
          stats.requiredTotal > 0 ? (
            <div className="min-w-0">
              <StaffingHeaderRatio
                assigned={stats.assignedTotal}
                required={stats.requiredTotal}
                assignmentMismatch={stats.hasAssignmentMismatch}
              />
              <p className="mt-0.5 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-xs text-foreground/70">
                  {t("dashboard.ampelStaffingWeekCaption")}
                </span>
                {staffingScopeDateLabel ? (
                  <span className="text-base font-medium tabular-nums tracking-tight text-foreground/85">
                    {staffingScopeDateLabel}
                  </span>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("dashboard.ampelStatusNoDemand")}</p>
          )
        ) : (
          <div aria-hidden />
        )}
      </div>

      {showStatusList ? (
        <AreaCardHeaderStatusList
          staffingEnabled={staffingEnabled}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          statusBadge={statusBadge}
          confirmationConflictStatuses={stats.confirmationConflictStatuses}
          showStaffingIssuesButton={showStaffingIssuesButton}
          staffingStatusClickable={staffingStatusClickable}
          onOpenStaffingCandidates={onOpenStaffingCandidates}
          onOpenStaffingIssues={onOpenStaffingIssues}
          onOpenConfirmationIssues={onOpenConfirmationIssues}
          t={t}
        />
      ) : null}
    </div>
  );
}

const CARD_BODY_SECTION_CLASS =
  "min-w-0 border-b border-border/50 px-4 py-3 last:border-b-0";

const CARD_METRICS_SECTION_CLASS = "px-4 pb-3 pt-3";

const CARD_FOOTER_LINK_CLASS = DASHBOARD_TEXT_LINK_BUTTON_CLASS;

export function DashboardAreaAmpelCard({
  stats,
  staffingEnabled,
  areaCalendarHref,
  employeeCalendarHref,
  candidatesPlanning = null,
  showCalendarFooterLinks = true,
  isPastScope = false,
  todayISO = toISODate(new Date()),
  staffingScopeDateLabel = null,
  shiftConfirmationEnabled = false,
  windowIssuesContext = null,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";
  const [staffingIssuesOpen, setStaffingIssuesOpen] = useState(false);
  const [staffingIssuesForModal, setStaffingIssuesForModal] = useState<
    readonly DashboardStaffingIssue[] | null
  >(null);
  const [candidatesRow, setCandidatesRow] =
    useState<DashboardStaffingWindowRow | null>(null);
  const [windowIssuesRow, setWindowIssuesRow] =
    useState<DashboardStaffingWindowRow | null>(null);
  const [windowIssuesConfirmationFilter, setWindowIssuesConfirmationFilter] =
    useState<ShiftConfirmationStatus | null>(null);

  const windowIssuesEnabled = Boolean(
    windowIssuesContext && shiftConfirmationEnabled
  );

  const staffingStatusClickable = isStaffingHeaderStatusClickable({
    ampelLevel: stats.ampelLevel,
    isPastScope,
    hasCandidatesPlanning: Boolean(candidatesPlanning),
    staffingWindowRows: stats.staffingWindowRows,
    todayISO,
  });

  const openStaffingCandidatesFromHeader = () => {
    const row = findFirstStaffingCandidatesRow(stats.staffingWindowRows, todayISO);
    if (row) setCandidatesRow(row);
  };

  const openConfirmationIssuesFromHeader = (status: ShiftConfirmationStatus) => {
    if (!windowIssuesContext) return;
    const row = findFirstRowWithConfirmationStatus(
      stats.staffingWindowRows,
      status
    );
    if (!row) return;
    setWindowIssuesConfirmationFilter(status);
    setWindowIssuesRow(row);
  };

  const openWindowIssuesForRow = (row: DashboardStaffingWindowRow) => {
    setWindowIssuesConfirmationFilter(null);
    setWindowIssuesRow(row);
  };

  const closeWindowIssuesModal = () => {
    setWindowIssuesRow(null);
    setWindowIssuesConfirmationFilter(null);
  };

  const openStaffingIssuesModal = (
    issues: readonly DashboardStaffingIssue[] | null = null
  ) => {
    setStaffingIssuesForModal(issues);
    setStaffingIssuesOpen(true);
  };

  const closeStaffingIssuesModal = () => {
    setStaffingIssuesOpen(false);
    setStaffingIssuesForModal(null);
  };

  const money = (amount: number) =>
    `${formatTagAreaFooterMoney(amount, intlLocale)} €`;

  const showStaffingTable =
    staffingEnabled && stats.staffingWindowRows.length > 0;

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden border border-border bg-surface shadow-sm transition-[box-shadow,border-color] hover:border-primary/25 hover:shadow-md",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          staffingEnabled
            ? ampelAccentStripeClass(stats.ampelLevel)
            : "bg-border"
        )}
        aria-hidden
      />

      <div className={CARD_CONTENT_CLASS}>
        <AreaCardHeader
          areaName={stats.areaName}
          staffingEnabled={staffingEnabled}
          stats={stats}
          isPastScope={isPastScope}
          staffingScopeDateLabel={staffingScopeDateLabel}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          staffingStatusClickable={staffingStatusClickable}
          onOpenStaffingCandidates={
            staffingStatusClickable ? openStaffingCandidatesFromHeader : undefined
          }
          onOpenStaffingIssues={() => openStaffingIssuesModal()}
          onOpenConfirmationIssues={
            windowIssuesEnabled ? openConfirmationIssuesFromHeader : undefined
          }
          t={t}
        />

        {showStaffingTable ? (
          <div className={CARD_BODY_SECTION_CLASS}>
            <StaffingWindowTable
              rows={stats.staffingWindowRows}
              dayColumnLabel={t("dashboard.ampelColumnDay")}
              timeColumnLabel={t("dashboard.ampelColumnTime")}
              shiftColumnLabel={t("dashboard.ampelColumnShift")}
              staffingColumnLabel={t("dashboard.ampelColumnStaffing")}
              noServiceHoursLabel={t("areaCalendar.noServiceHours")}
              unplannedShiftLabel={t("dashboard.ampelUnplannedShiftHint")}
              candidatesButtonLabel={t("dashboard.ampelStaffingCandidatesButtonLabel")}
              staffingIssuesButtonLabel={t("dashboard.staffingIssuesButtonLabelOne")}
              windowIssuesButtonLabel={t("dashboard.staffingWindowIssuesButtonLabel")}
              onOpenCandidates={
                candidatesPlanning ? (row) => setCandidatesRow(row) : undefined
              }
              onOpenStaffingIssues={(row) =>
                openStaffingIssuesModal([
                  ...(row.staffingConflicts ?? []),
                  ...(row.staffingHints ?? []),
                ])
              }
              onOpenWindowIssues={openWindowIssuesForRow}
              todayISO={todayISO}
              shiftConfirmationEnabled={shiftConfirmationEnabled}
              windowIssuesEnabled={windowIssuesEnabled}
              showShiftColumn={stats.hasAreaShiftTemplates}
            />
          </div>
        ) : null}

        <div className={CARD_METRICS_SECTION_CLASS}>
          <CardMetricsPanel
            shiftCount={stats.shiftCount}
            totalHours={stats.totalHours}
            hasCompensation={stats.hasCompensation}
            baseCost={stats.baseCost}
            surchargeCost={stats.surchargeCost}
            totalCost={stats.totalCost}
            money={money}
            t={t}
          />
        </div>
      </div>

      {showCalendarFooterLinks ? (
        <footer className="flex items-center justify-center gap-2 border-t border-border/80 bg-background/30 px-3 py-2">
          <Link href={areaCalendarHref} className={CARD_FOOTER_LINK_CLASS}>
            {t("nav.areaCalendar")}
          </Link>
          <span className="text-muted/60" aria-hidden>
            ·
          </span>
          <Link href={employeeCalendarHref} className={CARD_FOOTER_LINK_CLASS}>
            {t("nav.employeeCalendar")}
          </Link>
        </footer>
      ) : null}

      {staffingIssuesOpen ? (
        <DashboardAreaStaffingIssuesModal
          areaName={stats.areaName}
          issues={staffingIssuesForModal ?? stats.staffingIssues}
          onClose={closeStaffingIssuesModal}
        />
      ) : null}

      {candidatesRow && candidatesPlanning ? (
        <DashboardStaffingRowCandidatesModal
          row={candidatesRow}
          planning={{
            ...candidatesPlanning,
            areaId: stats.areaId,
            areaName: stats.areaName,
            areaCalendarHref,
          }}
          onClose={() => setCandidatesRow(null)}
        />
      ) : null}

      {windowIssuesRow && windowIssuesContext ? (
        <DashboardStaffingWindowIssuesModal
          row={windowIssuesRow}
          context={{
            ...windowIssuesContext,
            areaId: stats.areaId,
            areaName: stats.areaName,
            areaCalendarHref,
          }}
          confirmationStatusFilter={windowIssuesConfirmationFilter}
          onOpenCandidates={
            candidatesPlanning ? (row) => setCandidatesRow(row) : undefined
          }
          onClose={closeWindowIssuesModal}
        />
      ) : null}
    </article>
  );
}
