"use client";

import Link from "next/link";
import { useState, Fragment, useCallback, type RefObject } from "react";
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
import { useShowCompensationInPlanningUi } from "@/lib/org-features-provider";
import { useStaffingTableLayout } from "@/lib/use-staffing-table-headers-fit";
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
import type { DashboardAreaDetailScope } from "@/lib/dashboard-drilldown-week-navigation";
import {
  isAreaStaffingPlannedOnly,
  isAreaStaffingUncovered,
  isPlannedCoverageHeaderStatusClickable,
  isStaffingHeaderStatusClickable,
  resolveDashboardStaffingHeaderDisplay,
  shouldShowDashboardStaffingHeaderTooltip,
  shouldShowAreaCardPlannedCoverageStatusLine,
  shouldShowAreaCardStaffingAmpelStatus,
  type DashboardStaffingHeaderDisplay,
  type DashboardStaffingHeaderSegment,
  type DashboardStaffingHeaderSegmentKind,
} from "@/lib/dashboard-area-header-actions";
import {
  findFirstRowWithConfirmationStatus,
  findFirstPlannedStaffingWindowRow,
  findFirstStaffingCandidatesRow,
  staffingRowShowsIssuesButton,
  type DashboardStaffingWindowIssuesContext,
} from "@/lib/dashboard-staffing-window-issues";
import type { DashboardActionableConfirmationStatus } from "@/lib/dashboard-confirmation-employee-dedupe";
import { DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS, DASHBOARD_TEXT_LINK_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { CALENDAR_HOLIDAY_DAY_HEADER_LABEL_INLINE_CLASS } from "@/lib/calendar-day-header-styles";
import { Tooltip } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui";
import { buildStaffingWindowRowBesetztTooltip } from "@/lib/dashboard-staffing-row-status";
import {
  STAFFING_OCHER_ACCENT_BG_CLASS,
  STAFFING_OCHER_TEXT_CLASS,
} from "@/lib/staffing-ocher-styles";

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
  staffingScopeMode?: DashboardAreaDetailScope;
  /** Feiertagsname — nur Tag-Scope, inline nach dem Datum. */
  staffingScopeHolidayName?: string | null;
  /** „Besetzt/Bedarf“ vor dem Datumslabel — im Drilldown aus. */
  showStaffingWeekCaption?: boolean;
  shiftConfirmationEnabled?: boolean;
  windowIssuesContext?: Omit<
    DashboardStaffingWindowIssuesContext,
    "areaId" | "areaName" | "areaCalendarHref"
  > | null;
  showMetricsDetails?: boolean;
  onShowMetricsDetailsChange?: (open: boolean) => void;
  onOpenAssignmentOverview?: () => void;
};

function ampelAccentStripeClass(
  level: DashboardAreaAmpelLevel,
  plannedOnly: boolean
): string {
  if (plannedOnly) return STAFFING_OCHER_ACCENT_BG_CLASS;
  return isAreaStaffingUncovered(level) ? "bg-red-600" : "bg-emerald-600";
}

function staffingCountClassName(
  row: DashboardStaffingWindowRow,
  isPastDay: boolean,
  shiftConfirmationEnabled: boolean
): string {
  if (staffingRowShowsIssuesButton(row, shiftConfirmationEnabled)) {
    return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
  }

  const status = row.status;
  if (isPastDay) {
    switch (status) {
      case "understaffed":
        return "font-semibold text-red-950";
      case "planned":
      case "overstaffed":
        return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
      case "met":
        return "font-semibold text-emerald-950";
    }
  }

  switch (status) {
    case "understaffed":
      return "font-semibold text-red-600";
    case "planned":
    case "overstaffed":
      return cn("font-semibold", STAFFING_OCHER_TEXT_CLASS);
    case "met":
      return "font-semibold text-emerald-700";
  }
}

function staffingHeaderSegmentClassName(
  kind: DashboardStaffingHeaderSegmentKind
): string {
  switch (kind) {
    case "understaffed":
      return "text-red-600";
    case "planned":
    case "mismatch":
      return STAFFING_OCHER_TEXT_CLASS;
    case "overstaffed":
      return "text-blue-600";
    case "met":
      return "text-emerald-600";
  }
}

function staffingHeaderSegmentLabelKey(
  kind: DashboardStaffingHeaderSegmentKind
): `dashboard.ampelStaffingHeaderSegment.${DashboardStaffingHeaderSegmentKind}` {
  return `dashboard.ampelStaffingHeaderSegment.${kind}`;
}

function StaffingHeaderRatioSegment({
  assigned,
  required,
  className,
}: {
  assigned: number;
  required: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {assigned}/{required}
    </span>
  );
}

function StaffingHeaderTooltipContent({
  segments,
  t,
}: {
  segments: readonly DashboardStaffingHeaderSegment[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-1">
      {segments.map((segment) => (
        <p key={segment.kind}>
          {t(staffingHeaderSegmentLabelKey(segment.kind), {
            assigned: String(segment.assigned),
            required: String(segment.required),
          })}
        </p>
      ))}
    </div>
  );
}

function StaffingHeaderDisplay({
  display,
  t,
}: {
  display: DashboardStaffingHeaderDisplay;
  t: ReturnType<typeof useTranslations>;
}) {
  const { segments } = display;
  const baseClass = AREA_CARD_STAFFING_HEADER_ROW_CLASS;

  const content = (
    <p className={cn(baseClass, "flex min-w-0 items-baseline gap-1.5")}>
      {segments.map((segment, index) => (
        <Fragment key={segment.kind}>
          {index > 0 ? (
            <span className="font-normal text-muted/60" aria-hidden>
              |
            </span>
          ) : null}
          <StaffingHeaderRatioSegment
            assigned={segment.assigned}
            required={segment.required}
            className={staffingHeaderSegmentClassName(segment.kind)}
          />
        </Fragment>
      ))}
    </p>
  );

  if (!shouldShowDashboardStaffingHeaderTooltip(segments)) return content;

  return (
    <Tooltip content={<StaffingHeaderTooltipContent segments={segments} t={t} />}>
      <span className="inline-flex min-w-0 max-w-full">{content}</span>
    </Tooltip>
  );
}

/** Feste Höhe der Besetzt/Bedarf-Zeile — Platzhalter hält Datum in Zeile 3 stabil. */
const AREA_CARD_STAFFING_HEADER_ROW_CLASS =
  "text-xl font-semibold leading-none tracking-tight";

const AREA_CARD_STAFFING_HEADER_SLOT_CLASS = "min-h-5";

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
          "min-w-0 truncate text-right text-sm tabular-nums text-foreground",
          valueClassName ?? "font-normal"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CardMetricsPanel({
  shiftCount,
  grossHours,
  breakHours,
  totalHours,
  hasCompensation,
  baseCost,
  surchargeCost,
  totalCost,
  money,
  t,
  showCompensationInPlanning,
}: {
  shiftCount: number;
  grossHours: number;
  breakHours: number;
  totalHours: number;
  hasCompensation: boolean;
  baseCost: number;
  surchargeCost: number;
  totalCost: number;
  money: (amount: number) => string;
  t: ReturnType<typeof useTranslations>;
  showCompensationInPlanning: boolean;
}) {
  const shiftCountLabel =
    shiftCount === 1
      ? t("dashboard.summaryShiftCountOne")
      : t("dashboard.summaryShiftCountMany", { count: shiftCount });

  return (
    <div className={cn("overflow-hidden border border-border/70 bg-background/40", DASHBOARD_PANEL_ROUNDED_CLASS)}>
      <div className="px-3 py-2">
        <div className="space-y-1.5">
          <DetailRow label={t("dashboard.ampelDetailShifts")} value={shiftCountLabel} />
          <DetailRow
            label={t("dashboard.ampelDetailHours")}
            value={t("dashboard.ampelHours", {
              hours: formatDurationHours(grossHours),
            })}
          />
          <DetailRow
            label={t("dashboard.ampelDetailBreaks")}
            value={t("dashboard.ampelBreakHours", {
              hours: formatDurationHours(breakHours),
            })}
          />
        </div>
        <div className="mt-1.5 border-t border-border/50 pt-1.5">
          <DetailRow
            label={t("dashboard.ampelDetailTotalHours")}
            value={t("dashboard.ampelHours", {
              hours: formatDurationHours(totalHours),
            })}
          />
        </div>
      </div>

      {showCompensationInPlanning ? (
        hasCompensation ? (
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
                valueClassName="text-base font-bold"
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
        )
      ) : null}
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
    row.status === "understaffed"
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
  assignEmployeeTooltipLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  windowIssuesTooltipLabel: string;
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

function StaffingWindowStaffingCount({
  row,
  isPastDay,
  shiftConfirmationEnabled,
  t,
}: {
  row: DashboardStaffingWindowRow;
  isPastDay: boolean;
  shiftConfirmationEnabled: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const tooltipContent = buildStaffingWindowRowBesetztTooltip(
    row,
    shiftConfirmationEnabled,
    t
  );
  const count = (
    <span
      className={staffingCountClassName(
        row,
        isPastDay,
        shiftConfirmationEnabled
      )}
    >
      {row.assigned}/{row.required}
    </span>
  );

  if (!tooltipContent) return count;

  return <Tooltip content={tooltipContent}>{count}</Tooltip>;
}

function StaffingWindowRowActions({
  showCandidatesButton,
  showIssuesButton,
  showWindowIssuesButton,
  assignEmployeeTooltipLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  windowIssuesTooltipLabel,
  row,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
}: {
  showCandidatesButton: boolean;
  showIssuesButton: boolean;
  showWindowIssuesButton: boolean;
  assignEmployeeTooltipLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  windowIssuesTooltipLabel: string;
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
        <Tooltip content={assignEmployeeTooltipLabel}>
          <DashboardStaffingRowCandidatesButton
            variant="candidates"
            ariaLabel={assignEmployeeTooltipLabel}
            onClick={() => onOpenCandidates?.(row)}
          />
        </Tooltip>
      ) : null}
      {showIssuesButton ? (
        <DashboardStaffingRowCandidatesButton
          variant="staffingIssues"
          ariaLabel={staffingIssuesButtonLabel}
          onClick={() => onOpenStaffingIssues?.(row)}
        />
      ) : null}
      {showWindowIssuesButton ? (
        <Tooltip content={windowIssuesTooltipLabel}>
          <DashboardStaffingRowCandidatesButton
            variant="windowIssues"
            ariaLabel={windowIssuesButtonLabel}
            onClick={() => onOpenWindowIssues?.(row)}
          />
        </Tooltip>
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
  assignEmployeeTooltipLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  windowIssuesTooltipLabel,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
  todayISO,
  t,
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
  assignEmployeeTooltipLabel: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className="divide-y divide-border/50">
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
                <StaffingWindowStaffingCount
                  row={row}
                  isPastDay={flags.isPastDay}
                  shiftConfirmationEnabled={shiftConfirmationEnabled}
                  t={t}
                />
              )}
              <StaffingWindowRowActions
                {...flags}
                assignEmployeeTooltipLabel={assignEmployeeTooltipLabel}
                staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                windowIssuesButtonLabel={windowIssuesButtonLabel}
                windowIssuesTooltipLabel={windowIssuesTooltipLabel}
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

const STAFFING_TABLE_HEAD_CELL_CLASS =
  "overflow-hidden px-2.5 py-1 text-left text-sm font-medium text-muted";
const STAFFING_TABLE_HEAD_LABEL_CLASS = "block truncate";
const STAFFING_TABLE_BODY_CELL_CLASS = "min-w-0 overflow-hidden px-2.5 py-0.5";

function StaffingWindowTableHeaderCell({
  label,
  truncate,
  align = "left",
}: {
  label: string;
  truncate: boolean;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        STAFFING_TABLE_HEAD_CELL_CLASS,
        align === "right" && "px-2 text-right leading-tight"
      )}
    >
      <span
        className={cn(truncate && STAFFING_TABLE_HEAD_LABEL_CLASS)}
        title={truncate ? label : undefined}
      >
        {label}
      </span>
    </th>
  );
}

function StaffingWindowHeaderMeasure({
  measureRef,
  staffingLabelMeasureRef,
  dayColumnLabel,
  timeColumnLabel,
  shiftColumnLabel,
  staffingColumnLabel,
  showShiftColumn,
}: {
  measureRef: RefObject<HTMLDivElement | null>;
  staffingLabelMeasureRef: RefObject<HTMLSpanElement | null>;
  dayColumnLabel: string;
  timeColumnLabel: string;
  shiftColumnLabel: string;
  staffingColumnLabel: string;
  showShiftColumn: boolean;
}) {
  return (
    <>
      <div
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 flex w-max items-center whitespace-nowrap text-sm font-medium opacity-0"
        aria-hidden
      >
        <span className="px-2.5 py-1">{dayColumnLabel}</span>
        <span className="px-2.5 py-1">{timeColumnLabel}</span>
        {showShiftColumn ? (
          <span className="px-2.5 py-1">{shiftColumnLabel}</span>
        ) : null}
        <span className="px-2 py-1">{staffingColumnLabel}</span>
        <span className="w-8 shrink-0" aria-hidden />
      </div>
      <span
        ref={staffingLabelMeasureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 whitespace-nowrap px-2 py-1 text-sm font-medium opacity-0"
        aria-hidden
      >
        {staffingColumnLabel}
      </span>
    </>
  );
}

function StaffingWindowTable({
  rows,
  dayColumnLabel,
  timeColumnLabel,
  shiftColumnLabel,
  staffingColumnLabel,
  noServiceHoursLabel,
  assignEmployeeTooltipLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  windowIssuesTooltipLabel,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
  todayISO,
  shiftConfirmationEnabled = false,
  windowIssuesEnabled = false,
  showShiftColumn = false,
  t,
}: {
  rows: DashboardStaffingWindowRow[];
  dayColumnLabel: string;
  timeColumnLabel: string;
  shiftColumnLabel: string;
  staffingColumnLabel: string;
  noServiceHoursLabel: string;
  assignEmployeeTooltipLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  windowIssuesTooltipLabel: string;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
  todayISO: string;
  shiftConfirmationEnabled?: boolean;
  windowIssuesEnabled?: boolean;
  showShiftColumn?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const {
    containerRef,
    measureRef,
    staffingLabelMeasureRef,
    showTableLayout,
    headersTruncate,
    staffingColumnWidthPx,
  } = useStaffingTableLayout({
    day: dayColumnLabel,
    time: timeColumnLabel,
    shift: shiftColumnLabel,
    staffing: staffingColumnLabel,
    showShiftColumn,
  });

  if (rows.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden border border-border/70 bg-background/30",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        MODAL_SCROLLBAR_CLASS
      )}
    >
      <StaffingWindowHeaderMeasure
        measureRef={measureRef}
        staffingLabelMeasureRef={staffingLabelMeasureRef}
        dayColumnLabel={dayColumnLabel}
        timeColumnLabel={timeColumnLabel}
        shiftColumnLabel={shiftColumnLabel}
        staffingColumnLabel={staffingColumnLabel}
        showShiftColumn={showShiftColumn}
      />
      {showTableLayout ? (
      <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-0 table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[13%]" />
          <col className={showShiftColumn ? "w-[28%]" : "w-[42%]"} />
          {showShiftColumn ? <col /> : null}
          <col style={{ width: staffingColumnWidthPx }} />
          <col className="w-8" />
        </colgroup>
        <thead>
          <tr className="border-b border-border/70 bg-background/60">
            <StaffingWindowTableHeaderCell
              label={dayColumnLabel}
              truncate={headersTruncate}
            />
            <StaffingWindowTableHeaderCell
              label={timeColumnLabel}
              truncate={headersTruncate}
            />
            {showShiftColumn ? (
              <StaffingWindowTableHeaderCell
                label={shiftColumnLabel}
                truncate={headersTruncate}
              />
            ) : null}
            <StaffingWindowTableHeaderCell
              label={staffingColumnLabel}
              truncate={false}
              align="right"
            />
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
                  STAFFING_TABLE_BODY_CELL_CLASS,
                  "font-medium",
                  flags.isToday &&
                    flags.showDayLabel &&
                    !flags.isNoServiceHours &&
                    CALENDAR_TODAY_WEEKDAY_TEXT_CLASS
                )}
              >
                {flags.showDayLabel ? (
                  <span className="block truncate">{row.weekdayLabel}</span>
                ) : null}
              </td>
              <td
                className={cn(
                  STAFFING_TABLE_BODY_CELL_CLASS,
                  !flags.isNoServiceHours && "tabular-nums"
                )}
                colSpan={
                  flags.isNoServiceHours
                    ? showShiftColumn
                      ? row.hasUnplannedShifts
                        ? 2
                        : 3
                      : row.hasUnplannedShifts
                        ? 1
                        : 2
                    : undefined
                }
              >
                {flags.isNoServiceHours ? (
                  <span
                    className={cn(
                      "block",
                      headersTruncate ? "truncate" : "whitespace-normal"
                    )}
                  >
                    {noServiceHoursLabel}
                  </span>
                ) : (
                  <span className="block truncate">
                    {`${row.timeFrom} – ${row.timeTo}`}
                  </span>
                )}
              </td>
              {showShiftColumn && !flags.isNoServiceHours ? (
                <td className={STAFFING_TABLE_BODY_CELL_CLASS}>
                  {row.shiftName ? (
                    <span className="block truncate">{row.shiftName}</span>
                  ) : null}
                </td>
              ) : null}
              {!(flags.isNoServiceHours && !row.hasUnplannedShifts) ? (
                <td className="overflow-hidden px-2 py-0.5 text-right tabular-nums">
                  <StaffingWindowStaffingCount
                    row={row}
                    isPastDay={flags.isPastDay}
                    shiftConfirmationEnabled={shiftConfirmationEnabled}
                    t={t}
                  />
                </td>
              ) : null}
              <td className="w-8 px-0 py-0.5 align-middle">
                <StaffingWindowRowActions
                  {...flags}
                  assignEmployeeTooltipLabel={assignEmployeeTooltipLabel}
                  staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                  windowIssuesButtonLabel={windowIssuesButtonLabel}
                  windowIssuesTooltipLabel={windowIssuesTooltipLabel}
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
      ) : (
        <StaffingWindowMobileList
          rows={rows}
          noServiceHoursLabel={noServiceHoursLabel}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          windowIssuesEnabled={windowIssuesEnabled}
          showShiftColumn={showShiftColumn}
          assignEmployeeTooltipLabel={assignEmployeeTooltipLabel}
          staffingIssuesButtonLabel={staffingIssuesButtonLabel}
          windowIssuesButtonLabel={windowIssuesButtonLabel}
          windowIssuesTooltipLabel={windowIssuesTooltipLabel}
          onOpenCandidates={onOpenCandidates}
          onOpenStaffingIssues={onOpenStaffingIssues}
          onOpenWindowIssues={onOpenWindowIssues}
          todayISO={todayISO}
          t={t}
        />
      )}
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
  plannedOnly: boolean,
  t: ReturnType<typeof useTranslations>
): { label: string; dotClassName: string; labelClassName: string } {
  if (plannedOnly) {
    return {
      label: t("dashboard.ampelBadgePlanned"),
      dotClassName: "bg-[#CA8A04]",
      labelClassName: "text-foreground/90",
    };
  }

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
  showStaffingAmpelStatus,
  showPlannedCoverageStatusLine,
  shiftConfirmationEnabled,
  statusBadge,
  confirmationConflictStatuses,
  showStaffingIssuesButton,
  staffingStatusClickable,
  plannedCoverageStatusClickable,
  onOpenStaffingCandidates,
  onOpenPlannedCoverage,
  onOpenStaffingIssues,
  onOpenConfirmationIssues,
  t,
}: {
  showStaffingAmpelStatus: boolean;
  showPlannedCoverageStatusLine: boolean;
  shiftConfirmationEnabled: boolean;
  statusBadge: { label: string; dotClassName: string; labelClassName: string };
  confirmationConflictStatuses: readonly DashboardActionableConfirmationStatus[];
  showStaffingIssuesButton: boolean;
  staffingStatusClickable: boolean;
  plannedCoverageStatusClickable: boolean;
  onOpenStaffingCandidates?: () => void;
  onOpenPlannedCoverage?: () => void;
  onOpenStaffingIssues: () => void;
  onOpenConfirmationIssues?: (status: DashboardActionableConfirmationStatus) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasStaffingStatus = showStaffingAmpelStatus;
  const hasConfirmationStatuses =
    shiftConfirmationEnabled && confirmationConflictStatuses.length > 0;

  if (
    !hasStaffingStatus &&
    !showPlannedCoverageStatusLine &&
    !hasConfirmationStatuses &&
    !showStaffingIssuesButton
  ) {
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
      {showPlannedCoverageStatusLine ? (
        <AreaCardHeaderStatusLine
          dotClassName="bg-[#CA8A04]"
          labelClassName="text-foreground/90"
          label={t("dashboard.ampelBadgePlanned")}
          onClick={
            plannedCoverageStatusClickable ? onOpenPlannedCoverage : undefined
          }
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
  staffingScopeMode = "week",
  staffingScopeHolidayName = null,
  showStaffingWeekCaption = true,
  shiftConfirmationEnabled = false,
  staffingStatusClickable,
  plannedCoverageStatusClickable,
  onOpenStaffingCandidates,
  onOpenPlannedCoverage,
  onOpenStaffingIssues,
  onOpenConfirmationIssues,
  t,
}: {
  areaName: string;
  staffingEnabled: boolean;
  stats: DashboardAreaWeekStats;
  isPastScope: boolean;
  staffingScopeDateLabel?: string | null;
  staffingScopeMode?: DashboardAreaDetailScope;
  staffingScopeHolidayName?: string | null;
  showStaffingWeekCaption?: boolean;
  shiftConfirmationEnabled?: boolean;
  staffingStatusClickable: boolean;
  plannedCoverageStatusClickable: boolean;
  onOpenStaffingCandidates?: () => void;
  onOpenPlannedCoverage?: () => void;
  onOpenStaffingIssues: () => void;
  onOpenConfirmationIssues?: (status: DashboardActionableConfirmationStatus) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const showStaffingAmpelStatus = shouldShowAreaCardStaffingAmpelStatus({
    staffingEnabled,
    shiftCount: stats.shiftCount,
    ampelLevel: stats.ampelLevel,
  });
  const showStaffingIssuesButton =
    staffingEnabled && stats.staffingIssues.length > 0;
  const plannedOnly = isAreaStaffingPlannedOnly({
    ampelLevel: stats.ampelLevel,
    hasPlannedCoverage: stats.hasPlannedCoverage,
    hasUnderstaffed: stats.hasUnderstaffed,
  });
  const statusBadge = areaCardStatusBadgeProps(
    stats.ampelLevel,
    isPastScope,
    plannedOnly,
    t
  );
  const showPlannedCoverageStatusLine = shouldShowAreaCardPlannedCoverageStatusLine(
    {
      staffingScopeMode,
      hasPlannedCoverage: stats.hasPlannedCoverage,
      plannedOnly,
    }
  );
  const showStatusList =
    showStaffingAmpelStatus ||
    showPlannedCoverageStatusLine ||
    showStaffingIssuesButton ||
    (shiftConfirmationEnabled && stats.confirmationConflictStatuses.length > 0);

  const statusListProps = {
    showStaffingAmpelStatus,
    showPlannedCoverageStatusLine,
    shiftConfirmationEnabled,
    statusBadge,
    confirmationConflictStatuses: stats.confirmationConflictStatuses,
    showStaffingIssuesButton,
    staffingStatusClickable,
    plannedCoverageStatusClickable,
    onOpenStaffingCandidates,
    onOpenPlannedCoverage,
    onOpenStaffingIssues,
    onOpenConfirmationIssues,
    t,
  };

  const showStaffingHeaderMetrics =
    staffingEnabled && stats.requiredTotal > 0;
  const reserveStaffingHeaderRow =
    staffingEnabled && Boolean(staffingScopeDateLabel);

  return (
    <div className={CARD_HEADER_CLASS}>
      <div className={CARD_HEADER_MAIN_CLASS}>
        <div className="flex items-start justify-between gap-2 md:contents">
          <h2 className="min-w-0 truncate text-lg font-semibold leading-tight tracking-tight text-foreground md:min-w-0">
            {areaName}
          </h2>
          {showStatusList ? (
            <div className="shrink-0 md:hidden">
              <AreaCardHeaderStatusList {...statusListProps} />
            </div>
          ) : null}
        </div>

        {reserveStaffingHeaderRow ||
        showStaffingHeaderMetrics ||
        staffingScopeDateLabel ? (
          <div className="min-w-0">
            {reserveStaffingHeaderRow ? (
              <div className={AREA_CARD_STAFFING_HEADER_SLOT_CLASS}>
                {showStaffingHeaderMetrics ? (
                  <StaffingHeaderDisplay
                    display={resolveDashboardStaffingHeaderDisplay(stats)}
                    t={t}
                  />
                ) : (
                  <span
                    className={cn(
                      AREA_CARD_STAFFING_HEADER_ROW_CLASS,
                      "invisible block"
                    )}
                    aria-hidden
                  >
                    0/0
                  </span>
                )}
              </div>
            ) : showStaffingHeaderMetrics ? (
              <StaffingHeaderDisplay
                display={resolveDashboardStaffingHeaderDisplay(stats)}
                t={t}
              />
            ) : null}
            {staffingScopeDateLabel ? (
              <p
                className={cn(
                  "flex min-w-0 flex-wrap items-baseline gap-x-2",
                  showStaffingWeekCaption && "gap-1.5"
                )}
              >
                {showStaffingWeekCaption ? (
                  <span className="text-xs text-foreground/70">
                    {t("dashboard.ampelStaffingWeekCaption")}
                  </span>
                ) : null}
                <span className="text-base font-medium tabular-nums tracking-tight text-foreground/85">
                  {staffingScopeDateLabel}
                </span>
                {staffingScopeMode === "day" && staffingScopeHolidayName ? (
                  <span
                    className={cn(
                      CALENDAR_HOLIDAY_DAY_HEADER_LABEL_INLINE_CLASS,
                      "min-w-0"
                    )}
                  >
                    {staffingScopeHolidayName}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : !staffingEnabled ? (
          <div aria-hidden />
        ) : null}
      </div>

      {showStatusList ? (
        <div className="hidden md:block">
          <AreaCardHeaderStatusList {...statusListProps} />
        </div>
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
  staffingScopeMode = "week",
  staffingScopeHolidayName = null,
  showStaffingWeekCaption = true,
  shiftConfirmationEnabled = false,
  windowIssuesContext = null,
  showMetricsDetails: showMetricsDetailsProp,
  onShowMetricsDetailsChange,
  onOpenAssignmentOverview,
}: Props) {
  const t = useTranslations();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
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
  const [uncontrolledShowMetricsDetails, setUncontrolledShowMetricsDetails] =
    useState(false);
  const metricsDetailsControlled = showMetricsDetailsProp !== undefined;
  const showMetricsDetails = metricsDetailsControlled
    ? showMetricsDetailsProp
    : uncontrolledShowMetricsDetails;
  const setShowMetricsDetails = useCallback(
    (open: boolean) => {
      if (!metricsDetailsControlled) {
        setUncontrolledShowMetricsDetails(open);
      }
      onShowMetricsDetailsChange?.(open);
    },
    [metricsDetailsControlled, onShowMetricsDetailsChange]
  );

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

  const plannedOnly = isAreaStaffingPlannedOnly({
    ampelLevel: stats.ampelLevel,
    hasPlannedCoverage: stats.hasPlannedCoverage,
    hasUnderstaffed: stats.hasUnderstaffed,
  });
  const showPlannedCoverageStatusLine = shouldShowAreaCardPlannedCoverageStatusLine(
    {
      staffingScopeMode,
      hasPlannedCoverage: stats.hasPlannedCoverage,
      plannedOnly,
    }
  );
  const plannedCoverageStatusClickable = isPlannedCoverageHeaderStatusClickable({
    windowIssuesEnabled,
    isPastScope,
    showPlannedCoverageStatusLine,
    staffingWindowRows: stats.staffingWindowRows,
    todayISO,
  });

  const openStaffingCandidatesFromHeader = () => {
    const row = findFirstStaffingCandidatesRow(stats.staffingWindowRows, todayISO);
    if (row) setCandidatesRow(row);
  };

  const openConfirmationIssuesFromHeader = (
    status: DashboardActionableConfirmationStatus
  ) => {
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

  const openPlannedCoverageFromHeader = () => {
    const row = findFirstPlannedStaffingWindowRow(
      stats.staffingWindowRows,
      todayISO
    );
    if (row) openWindowIssuesForRow(row);
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
      {staffingEnabled && stats.ampelLevel !== "no_demand" ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-1",
            ampelAccentStripeClass(
              stats.ampelLevel,
              isAreaStaffingPlannedOnly({
                ampelLevel: stats.ampelLevel,
                hasPlannedCoverage: stats.hasPlannedCoverage,
                hasUnderstaffed: stats.hasUnderstaffed,
              })
            )
          )}
          aria-hidden
        />
      ) : !staffingEnabled ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1 bg-border"
          aria-hidden
        />
      ) : null}

      <div className={CARD_CONTENT_CLASS}>
        <AreaCardHeader
          areaName={stats.areaName}
          staffingEnabled={staffingEnabled}
          stats={stats}
          isPastScope={isPastScope}
          staffingScopeDateLabel={staffingScopeDateLabel}
          staffingScopeMode={staffingScopeMode}
          staffingScopeHolidayName={staffingScopeHolidayName}
          showStaffingWeekCaption={showStaffingWeekCaption}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          staffingStatusClickable={staffingStatusClickable}
          plannedCoverageStatusClickable={plannedCoverageStatusClickable}
          onOpenStaffingCandidates={
            staffingStatusClickable ? openStaffingCandidatesFromHeader : undefined
          }
          onOpenPlannedCoverage={
            plannedCoverageStatusClickable
              ? openPlannedCoverageFromHeader
              : undefined
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
              assignEmployeeTooltipLabel={t("dashboard.ampelStaffingAssignEmployeeTooltip")}
              staffingIssuesButtonLabel={t("dashboard.staffingIssuesButtonLabelOne")}
              windowIssuesButtonLabel={t("dashboard.staffingWindowIssuesButtonLabel")}
              windowIssuesTooltipLabel={t("dashboard.staffingWindowIssuesTitle")}
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
              t={t}
            />
          </div>
        ) : null}

        <div className={CARD_METRICS_SECTION_CLASS}>
          <div className="flex min-h-[2.75rem] items-center justify-between gap-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={showMetricsDetails}
                onChange={(event) => setShowMetricsDetails(event.target.checked)}
                className="shrink-0"
              />
              <span>
                {t(
                  showCompensationInPlanningUi
                    ? "dashboard.ampelShowHoursAndCostSummary"
                    : "dashboard.ampelShowHoursSummary"
                )}
              </span>
            </label>
            {staffingEnabled && onOpenAssignmentOverview ? (
              <button
                type="button"
                className={DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS}
                onClick={onOpenAssignmentOverview}
              >
                {t("dashboard.areaAssignmentOverviewButton")}
              </button>
            ) : null}
          </div>
          {showMetricsDetails ? (
            <div className="mt-2">
              <CardMetricsPanel
                shiftCount={stats.shiftCount}
                grossHours={stats.grossHours}
                breakHours={stats.breakHours}
                totalHours={stats.totalHours}
                hasCompensation={stats.hasCompensation}
                baseCost={stats.baseCost}
                surchargeCost={stats.surchargeCost}
                totalCost={stats.totalCost}
                money={money}
                t={t}
                showCompensationInPlanning={showCompensationInPlanningUi}
              />
            </div>
          ) : null}
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
