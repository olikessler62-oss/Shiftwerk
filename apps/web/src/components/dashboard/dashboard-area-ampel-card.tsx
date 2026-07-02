"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, type RefObject } from "react";
import { DashboardPastDayChangeConfirmModal } from "@/components/dashboard/dashboard-past-day-change-confirm-modal";
import { DashboardAreaStaffingIssuesModal } from "@/components/dashboard/dashboard-area-staffing-issues-modal";
import { DashboardStaffingRowCandidatesButton } from "@/components/dashboard/dashboard-staffing-row-candidates-button";
import { DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS } from "@/components/dashboard/dashboard-staffing-row-action-icons";
import {
  DashboardStaffingWindowIssuesModal,
} from "@/components/dashboard/dashboard-staffing-window-issues-modal";
import {
  DashboardStaffingRowCandidatesModal,
  type DashboardStaffingCandidatesPlanningContext,
} from "@/components/dashboard/dashboard-staffing-row-candidates-modal";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useShowCompensationInPlanningUi, useAllowPastShiftChanges, useOrganization } from "@/lib/org-features-provider";
import {
  createPlanningPastShiftChecker,
  planningMomentFromStaffingRow,
  type PlanningPastShiftChecker,
} from "@/lib/planning-past-shift-time";
import { resolveOrganizationTimeZone } from "@schichtwerk/database";
import {
  STAFFING_TABLE_ACTION_COL_PX,
  useStaffingTableLayout,
} from "@/lib/use-staffing-table-headers-fit";
import { cn } from "@/lib/cn";
import { DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS, DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import type {
  DashboardAreaAmpelLevel,
  DashboardAreaWeekStats,
  DashboardStaffingIssue,
  DashboardStaffingWindowRow,
  DashboardStaffingWindowRowStatus,
} from "@/lib/dashboard-area-week-stats";
import {
  resolveDashboardDayAreaStaffingGaugeFromWindowRows,
  staffingWindowRowHasUnconfirmedPlannedCoverage,
} from "@/lib/dashboard-area-week-stats";
import type { DashboardActionableConfirmationStatus } from "@/lib/dashboard-confirmation-employee-dedupe";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import {
  DashboardAreaStatusFooterLines,
  DASHBOARD_AREA_CARD_HEADER_STATUS_TWO_COLUMN_MIN_HEIGHT_CLASS,
  DASHBOARD_AREA_STATUS_FOOTER_COLUMN_CLASS,
  DASHBOARD_AREA_STATUS_FOOTER_TWO_COLUMN_CLASS,
} from "@/components/dashboard/dashboard-area-status-footer-lines";
import { DashboardAreaScopeToggle } from "@/components/dashboard/dashboard-area-scope-toggle";
import {
  resolveDashboardAreaStatusFooterLines,
  type DashboardAreaStatusFooterLineId,
} from "@/lib/dashboard-area-status-footer-lines";
import { formatTagAreaFooterMoney } from "@/lib/tag-area-footer-stats";
import { formatDurationHours } from "@/lib/shift-type-display";
import { isPastCalendarDate, toISODate } from "@/lib/dates";
import { CALENDAR_TODAY_WEEKDAY_TEXT_CLASS } from "@/lib/calendar-day-header-styles";
import type { DashboardAreaDetailScope } from "@/lib/dashboard-drilldown-week-navigation";
import {
  isAreaStaffingPlannedOnly,
  isAreaStaffingUncovered,
  isStaffingHeaderStatusClickable,
} from "@/lib/dashboard-area-header-actions";
import {
  findFirstRowWithConfirmationStatus,
  findFirstPlannedStaffingWindowRow,
  findFirstStaffingCandidatesRow,
  type DashboardStaffingWindowIssuesContext,
} from "@/lib/dashboard-staffing-window-issues";
import { DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS, DASHBOARD_TEXT_LINK_BUTTON_CLASS, DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_HEADER_CLASS, DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_HEIGHT_CLASS } from "@/lib/dashboard-toolbar-ui";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { CALENDAR_HOLIDAY_DAY_HEADER_LABEL_INLINE_CLASS } from "@/lib/calendar-day-header-styles";
import { StaffingFillGauge } from "@/components/areacalendar/staffing-fill-gauge";
import { StaffingStatusStrokeIcon } from "@/components/dashboard/staffing-status-stroke-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui";
import {
  buildStaffingWindowRowDisplayLineBesetztTooltip,
  filterStaffingWindowRowsForWeekView,
  flattenStaffingWindowTableLines,
  resolveStaffingWindowTableRowAction,
  staffingWindowDisplayLineCountClassName,
  staffingWindowRowsHaveDetailsPerStatusSplit,
  type FlattenStaffingWindowTableLinesOptions,
  type StaffingWindowDisplayLineAction,
  type StaffingWindowRowDisplayLine,
} from "@/lib/dashboard-staffing-row-status";
import { useDashboardAreaStaffingViewPrefs } from "@/lib/use-dashboard-area-staffing-view-prefs";
import {
  STAFFING_OCHER_ACCENT_BG_CLASS,
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
  onOpenSwapRequests?: () => void;
  /** Tagesansicht: Status zweispaltig (4 Zeilen statt 8). */
  statusFooterLayout?: "stack" | "two-column";
  /** Tages-Drilldown: Tag/Woche-Schalter rechts oben im Karten-Header. */
  areaScopeToggle?: {
    scope: DashboardAreaDetailScope;
    dayLabel: string;
    weekLabel: string;
    weekShortLabel?: string;
    onScopeChange: (scope: DashboardAreaDetailScope) => void;
  };
};

function ampelAccentStripeClass(
  level: DashboardAreaAmpelLevel,
  plannedOnly: boolean
): string {
  if (plannedOnly) return STAFFING_OCHER_ACCENT_BG_CLASS;
  return isAreaStaffingUncovered(level) ? "bg-red-600" : "bg-emerald-600";
}

/** Feste Höhe der Füllstandsanzeigen-Zeile — Tag und Woche gleich, Datum in Zeile 3 bleibt stabil. */
const AREA_CARD_STAFFING_HEADER_SLOT_CLASS =
  "flex h-8 shrink-0 items-center";

const AREA_CARD_STAFFING_HEADER_NO_SERVICE_HOURS_CLASS =
  "text-[11px] font-medium leading-snug text-foreground/70";

const AREA_CARD_STAFFING_HEADER_NO_SHIFTS_CLASS =
  "text-[11px] leading-snug text-muted/80";

function areaHasStaffingWindowsInScope(
  rows: readonly DashboardStaffingWindowRow[]
): boolean {
  return rows.some((row) => row.rowKind === "staffing_window");
}

/** Bereichskarten-Header — eine aggregierte Füllstandsanzeige (Tag- und Wochen-Scope). */
const DASHBOARD_AREA_CARD_HEADER_GAUGE_SIZE_PX = 32;

/** Eine Füllstandsanzeige im Bereichskarten-Header — aggregiert über alle Fenster im Scope. */
function AreaCardStaffingHeaderGauge({
  stats,
  t,
}: {
  stats: DashboardAreaWeekStats;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!areaHasStaffingWindowsInScope(stats.staffingWindowRows)) {
    return (
      <span className={AREA_CARD_STAFFING_HEADER_NO_SERVICE_HOURS_CLASS}>
        {t("areaCalendar.noServiceHours")}
      </span>
    );
  }

  if (stats.shiftCount === 0) {
    return (
      <span className={AREA_CARD_STAFFING_HEADER_NO_SHIFTS_CLASS}>
        {t("dashboard.dayCardNoShifts")}
      </span>
    );
  }

  const gauge = resolveDashboardDayAreaStaffingGaugeFromWindowRows(
    stats.staffingWindowRows
  );

  if (gauge) {
    return (
      <StaffingFillGauge
        assigned={gauge.assigned}
        required={gauge.required}
        variant={gauge.variant}
        sizePx={DASHBOARD_AREA_CARD_HEADER_GAUGE_SIZE_PX}
        className="gap-0"
      />
    );
  }

  return <StaffingStatusStrokeIcon level={stats.ampelLevel} muted={false} />;
}

/** Feste Mindesthöhe der Datumszeile — einzeilig stabil, Feiertag darf umbrechen. */
const AREA_CARD_DATE_ROW_CLASS =
  "flex min-h-5 min-w-0 flex-wrap items-baseline gap-x-2";

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

function staffingWindowRowShowsNoServiceHoursStyle(
  row: DashboardStaffingWindowRow
): boolean {
  return row.rowKind === "no_service_hours" || row.noServiceHoursDay === true;
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
  pastDayBlockedTooltip: string;
  planningPastShiftChecker: PlanningPastShiftChecker;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
};

function resolveStaffingWindowRowFlags(
  row: DashboardStaffingWindowRow,
  rowIndex: number,
  rows: readonly DashboardStaffingWindowRow[],
  todayISO: string,
  planningPastShiftChecker: PlanningPastShiftChecker
) {
  const isPastDay = planningPastShiftChecker.isMomentInPast(
    planningMomentFromStaffingRow(row)
  );
  const isToday = row.dateISO === todayISO;
  const isNoServiceHours = staffingWindowRowShowsNoServiceHoursStyle(row);
  const showsNoServiceHoursLabelOnly = row.rowKind === "no_service_hours";
  const showDayLabel =
    rowIndex === 0 || rows[rowIndex - 1]?.dateISO !== row.dateISO;

  return {
    isPastDay,
    isToday,
    isNoServiceHours,
    showsNoServiceHoursLabelOnly,
    showDayLabel,
  };
}

function staffingRowActionBlockedByPastMoment(
  action: StaffingWindowDisplayLineAction,
  row: DashboardStaffingWindowRow,
  planningPastShiftChecker: PlanningPastShiftChecker
): boolean {
  if (action !== "candidates" && action !== "windowIssues") return false;
  return planningPastShiftChecker.isBlockedForPlanning(
    planningMomentFromStaffingRow(row)
  );
}

function StaffingWindowStaffingCount({
  row,
  line,
  isPastDay,
  shiftConfirmationEnabled,
  t,
}: {
  row: DashboardStaffingWindowRow;
  line: StaffingWindowRowDisplayLine;
  isPastDay: boolean;
  shiftConfirmationEnabled: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const tooltipContent = buildStaffingWindowRowDisplayLineBesetztTooltip(
    row,
    line,
    shiftConfirmationEnabled,
    t
  );
  const count = (
    <span
      className={staffingWindowDisplayLineCountClassName(
        row,
        line,
        isPastDay,
        shiftConfirmationEnabled
      )}
    >
      {line.assigned}/{line.required}
    </span>
  );

  if (!tooltipContent) return count;

  return <Tooltip content={tooltipContent}>{count}</Tooltip>;
}

function StaffingWindowRowAction({
  action,
  assignEmployeeTooltipLabel,
  staffingIssuesButtonLabel,
  windowIssuesButtonLabel,
  windowIssuesTooltipLabel,
  pastDayBlockedTooltip,
  planningPastShiftChecker,
  row,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
}: {
  action: StaffingWindowDisplayLineAction | null;
  assignEmployeeTooltipLabel: string;
  staffingIssuesButtonLabel: string;
  windowIssuesButtonLabel: string;
  windowIssuesTooltipLabel: string;
  pastDayBlockedTooltip: string;
  planningPastShiftChecker: PlanningPastShiftChecker;
  row: DashboardStaffingWindowRow;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
}) {
  if (!action) {
    return (
      <span className={DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS} aria-hidden />
    );
  }

  const blockedByPastMoment = staffingRowActionBlockedByPastMoment(
    action,
    row,
    planningPastShiftChecker
  );

  if (action === "candidates") {
    const tooltipContent = blockedByPastMoment
      ? pastDayBlockedTooltip
      : assignEmployeeTooltipLabel;
    return (
      <Tooltip
        content={tooltipContent}
        className={DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS}
      >
        <span className="inline-flex">
          <DashboardStaffingRowCandidatesButton
            variant="candidates"
            ariaLabel={tooltipContent}
            disabled={blockedByPastMoment}
            onClick={() => onOpenCandidates?.(row)}
          />
        </span>
      </Tooltip>
    );
  }

  if (action === "staffingIssues") {
    return (
      <DashboardStaffingRowCandidatesButton
        variant="staffingIssues"
        ariaLabel={staffingIssuesButtonLabel}
        onClick={() => onOpenStaffingIssues?.(row)}
      />
    );
  }

  const tooltipContent = blockedByPastMoment
    ? pastDayBlockedTooltip
    : windowIssuesTooltipLabel;
  return (
    <Tooltip
      content={tooltipContent}
      className={DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS}
    >
      <span className="inline-flex">
        <DashboardStaffingRowCandidatesButton
          variant="windowIssues"
          ariaLabel={windowIssuesButtonLabel}
          disabled={blockedByPastMoment}
          onClick={() => onOpenWindowIssues?.(row)}
        />
      </span>
    </Tooltip>
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
  pastDayBlockedTooltip,
  planningPastShiftChecker,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
  todayISO,
  t,
  tableLineOptions,
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
  pastDayBlockedTooltip: string;
  planningPastShiftChecker: PlanningPastShiftChecker;
  assignEmployeeTooltipLabel: string;
  tableLineOptions?: FlattenStaffingWindowTableLinesOptions;
  t: ReturnType<typeof useTranslations>;
}) {
  if (rows.length === 0) return null;

  const tableLines = flattenStaffingWindowTableLines(rows, tableLineOptions);

  return (
    <ul className="divide-y divide-border/50">
      {tableLines.map((item, index) => {
        const { row, line, isFirstInShiftGroup, showDayLabel } = item;
        const flags = resolveStaffingWindowRowFlags(
          row,
          rows.indexOf(row),
          rows,
          todayISO,
          planningPastShiftChecker
        );
        const action = resolveStaffingWindowTableRowAction(
          row,
          line,
          todayISO,
          shiftConfirmationEnabled,
          windowIssuesEnabled,
          tableLineOptions
        );

        return (
          <li
            key={`${row.dateISO}:${row.serviceHourId}:${line.kind}:${index}`}
            className={cn(
              "flex min-h-7 items-center gap-2 px-3 py-2",
              flags.isPastDay && "bg-muted/14",
              flags.isNoServiceHours
                ? NO_SERVICE_HOURS_TEXT_CLASS
                : "text-foreground"
            )}
          >
            <div className="min-w-0 flex-1">
              {showDayLabel ? (
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
              {isFirstInShiftGroup ? (
                <p
                  className={cn(
                    "text-sm",
                    !flags.isNoServiceHours && "tabular-nums"
                  )}
                >
                  {flags.showsNoServiceHoursLabelOnly
                    ? noServiceHoursLabel
                    : `${row.timeFrom} – ${row.timeTo}`}
                </p>
              ) : null}
              {showShiftColumn &&
              isFirstInShiftGroup &&
              !flags.isNoServiceHours &&
              row.shiftName ? (
                <p className="truncate text-xs text-muted">{row.shiftName}</p>
              ) : null}
            </div>
            {flags.showsNoServiceHoursLabelOnly && !row.hasUnplannedShifts ? null : (
              <div className="flex shrink-0 flex-row items-center justify-end gap-1.5">
                <StaffingWindowStaffingCount
                  row={row}
                  line={line}
                  isPastDay={flags.isPastDay}
                  shiftConfirmationEnabled={shiftConfirmationEnabled}
                  t={t}
                />
                <StaffingWindowRowAction
                  action={action}
                  assignEmployeeTooltipLabel={assignEmployeeTooltipLabel}
                  staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                  windowIssuesButtonLabel={windowIssuesButtonLabel}
                  windowIssuesTooltipLabel={windowIssuesTooltipLabel}
                  pastDayBlockedTooltip={pastDayBlockedTooltip}
                  planningPastShiftChecker={planningPastShiftChecker}
                  row={row}
                  onOpenCandidates={onOpenCandidates}
                  onOpenStaffingIssues={onOpenStaffingIssues}
                  onOpenWindowIssues={onOpenWindowIssues}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const STAFFING_TABLE_HEAD_CELL_CLASS =
  "overflow-hidden px-2.5 py-1 text-left text-sm font-medium text-muted";
const STAFFING_TABLE_HEAD_LABEL_CLASS = "block truncate";
const STAFFING_TABLE_BODY_CELL_CLASS =
  "min-h-7 min-w-0 overflow-hidden px-2.5 py-0.5";
const STAFFING_TABLE_BODY_COUNT_CELL_CLASS =
  "min-h-7 min-w-0 px-1.5 py-0.5 text-right tabular-nums";
const STAFFING_TABLE_BODY_ACTION_CELL_CLASS =
  "min-h-7 w-[52px] min-w-[52px] px-0 py-0.5 text-center align-middle";

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
        <span
          className="shrink-0"
          style={{ width: STAFFING_TABLE_ACTION_COL_PX }}
          aria-hidden
        />
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
  pastDayBlockedTooltip,
  planningPastShiftChecker,
  onOpenCandidates,
  onOpenStaffingIssues,
  onOpenWindowIssues,
  todayISO,
  shiftConfirmationEnabled = false,
  windowIssuesEnabled = false,
  showShiftColumn = false,
  tableLineOptions,
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
  pastDayBlockedTooltip: string;
  planningPastShiftChecker: PlanningPastShiftChecker;
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onOpenStaffingIssues?: (row: DashboardStaffingWindowRow) => void;
  onOpenWindowIssues?: (row: DashboardStaffingWindowRow) => void;
  todayISO: string;
  shiftConfirmationEnabled?: boolean;
  windowIssuesEnabled?: boolean;
  showShiftColumn?: boolean;
  tableLineOptions?: FlattenStaffingWindowTableLinesOptions;
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
        "relative border border-border/70 bg-background/30",
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
          <col className="w-[11%]" />
          <col className={showShiftColumn ? "w-[24%]" : "w-[36%]"} />
          {showShiftColumn ? <col /> : null}
          <col style={{ width: staffingColumnWidthPx }} />
          <col style={{ width: STAFFING_TABLE_ACTION_COL_PX }} />
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
            <th
              className="px-0 py-1"
              style={{ width: STAFFING_TABLE_ACTION_COL_PX }}
              aria-hidden
            />
          </tr>
        </thead>
        <tbody>
          {flattenStaffingWindowTableLines(rows, tableLineOptions).map((item, index) => {
            const { row, line, isFirstInShiftGroup, showDayLabel } = item;
            const rowIndex = rows.indexOf(row);
            const flags = resolveStaffingWindowRowFlags(
              row,
              rowIndex,
              rows,
              todayISO,
              planningPastShiftChecker
            );
            const action = resolveStaffingWindowTableRowAction(
              row,
              line,
              todayISO,
              shiftConfirmationEnabled,
              windowIssuesEnabled,
              tableLineOptions
            );
            const rowClassName = cn(
              "border-b border-border/40 last:border-b-0",
              flags.isPastDay && "bg-muted/14",
              flags.isNoServiceHours
                ? NO_SERVICE_HOURS_TEXT_CLASS
                : "text-foreground"
            );

            if (flags.showsNoServiceHoursLabelOnly) {
              return (
                <tr
                  key={`${row.dateISO}:${row.serviceHourId}:${index}`}
                  className={rowClassName}
                >
                  <td
                    className={cn(
                      STAFFING_TABLE_BODY_CELL_CLASS,
                      "font-medium",
                      flags.isToday &&
                        showDayLabel &&
                        CALENDAR_TODAY_WEEKDAY_TEXT_CLASS
                    )}
                  >
                    {showDayLabel ? (
                      <span className="block truncate">{row.weekdayLabel}</span>
                    ) : null}
                  </td>
                  <td
                    className={cn(STAFFING_TABLE_BODY_CELL_CLASS, "tabular-nums")}
                    colSpan={
                      showShiftColumn
                        ? row.hasUnplannedShifts
                          ? 2
                          : 3
                        : row.hasUnplannedShifts
                          ? 1
                          : 2
                    }
                  >
                    <span
                      className={cn(
                        "block",
                        headersTruncate ? "truncate" : "whitespace-normal"
                      )}
                    >
                      {noServiceHoursLabel}
                    </span>
                  </td>
                  {showShiftColumn && row.hasUnplannedShifts ? (
                    <td className={STAFFING_TABLE_BODY_CELL_CLASS}>
                      {row.shiftName ? (
                        <span className="block truncate">{row.shiftName}</span>
                      ) : null}
                    </td>
                  ) : null}
                  {row.hasUnplannedShifts ? (
                    <>
                      <td className={STAFFING_TABLE_BODY_COUNT_CELL_CLASS}>
                        <StaffingWindowStaffingCount
                          row={row}
                          line={line}
                          isPastDay={flags.isPastDay}
                          shiftConfirmationEnabled={shiftConfirmationEnabled}
                          t={t}
                        />
                      </td>
                      <td className={STAFFING_TABLE_BODY_ACTION_CELL_CLASS}>
                        <div className="flex justify-center">
                          <StaffingWindowRowAction
                            action={action}
                            assignEmployeeTooltipLabel={assignEmployeeTooltipLabel}
                            staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                            windowIssuesButtonLabel={windowIssuesButtonLabel}
                            windowIssuesTooltipLabel={windowIssuesTooltipLabel}
                            pastDayBlockedTooltip={pastDayBlockedTooltip}
                            planningPastShiftChecker={planningPastShiftChecker}
                            row={row}
                            onOpenCandidates={onOpenCandidates}
                            onOpenStaffingIssues={onOpenStaffingIssues}
                            onOpenWindowIssues={onOpenWindowIssues}
                          />
                        </div>
                      </td>
                    </>
                  ) : (
                    <td
                      colSpan={2}
                      className={STAFFING_TABLE_BODY_ACTION_CELL_CLASS}
                      aria-hidden
                    />
                  )}
                </tr>
              );
            }

            return (
              <tr
                key={`${row.dateISO}:${row.serviceHourId}:${line.kind}:${index}`}
                className={rowClassName}
              >
                <td
                  className={cn(
                    STAFFING_TABLE_BODY_CELL_CLASS,
                    "font-medium",
                    flags.isToday &&
                      showDayLabel &&
                      CALENDAR_TODAY_WEEKDAY_TEXT_CLASS
                  )}
                >
                  {showDayLabel ? (
                    <span className="block truncate">{row.weekdayLabel}</span>
                  ) : null}
                  {showDayLabel && row.noServiceHoursDay ? (
                    <span className="block truncate text-xs">
                      {noServiceHoursLabel}
                    </span>
                  ) : null}
                </td>
                <td
                  className={cn(
                    STAFFING_TABLE_BODY_CELL_CLASS,
                    isFirstInShiftGroup && "tabular-nums"
                  )}
                >
                  {isFirstInShiftGroup ? (
                    <span className="block truncate">
                      {`${row.timeFrom} – ${row.timeTo}`}
                    </span>
                  ) : null}
                </td>
                {showShiftColumn ? (
                  <td className={STAFFING_TABLE_BODY_CELL_CLASS}>
                    {isFirstInShiftGroup && row.shiftName ? (
                      <span className="block truncate">{row.shiftName}</span>
                    ) : null}
                  </td>
                ) : null}
                <td className={STAFFING_TABLE_BODY_COUNT_CELL_CLASS}>
                  <StaffingWindowStaffingCount
                    row={row}
                    line={line}
                    isPastDay={flags.isPastDay}
                    shiftConfirmationEnabled={shiftConfirmationEnabled}
                    t={t}
                  />
                </td>
                <td className={STAFFING_TABLE_BODY_ACTION_CELL_CLASS}>
                  <div className="flex justify-center">
                    <StaffingWindowRowAction
                      action={action}
                      assignEmployeeTooltipLabel={assignEmployeeTooltipLabel}
                      staffingIssuesButtonLabel={staffingIssuesButtonLabel}
                      windowIssuesButtonLabel={windowIssuesButtonLabel}
                      windowIssuesTooltipLabel={windowIssuesTooltipLabel}
                      pastDayBlockedTooltip={pastDayBlockedTooltip}
                      planningPastShiftChecker={planningPastShiftChecker}
                      row={row}
                      onOpenCandidates={onOpenCandidates}
                      onOpenStaffingIssues={onOpenStaffingIssues}
                      onOpenWindowIssues={onOpenWindowIssues}
                    />
                  </div>
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
          pastDayBlockedTooltip={pastDayBlockedTooltip}
          planningPastShiftChecker={planningPastShiftChecker}
          onOpenCandidates={onOpenCandidates}
          onOpenStaffingIssues={onOpenStaffingIssues}
          onOpenWindowIssues={onOpenWindowIssues}
          todayISO={todayISO}
          tableLineOptions={tableLineOptions}
          t={t}
        />
      )}
    </div>
  );
}

const CARD_CONTENT_CLASS = "flex min-w-0 flex-1 flex-col";

const CARD_HEADER_CLASS = cn(
  "grid min-h-0 min-w-0 grid-cols-1 items-start gap-2 overflow-y-hidden px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3 md:px-4",
  DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS
);

const CARD_HEADER_MAIN_CLASS = "flex min-w-0 flex-col gap-1 py-0.5";

const CARD_HEADER_SCOPE_AND_STATUS_COLUMN_CLASS =
  "flex w-full min-w-0 max-w-[min(100%,14rem)] shrink-0 flex-col items-end self-stretch overflow-y-auto py-0.5 md:w-max";

/** Reserviert Platz für den Schalter — Statuszeilen bleiben unverändert. */
const CARD_HEADER_SCOPE_TOGGLE_SPACER_CLASS = cn(
  "mb-[3px] shrink-0",
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_HEIGHT_CLASS
);

const CARD_HEADER_SCOPE_TOGGLE_ANCHOR_CLASS =
  "absolute top-1 right-2 z-10 md:top-1.5 md:right-3";

function AreaCardHeader({
  areaName,
  staffingEnabled,
  stats,
  staffingScopeDateLabel = null,
  staffingScopeMode = "week",
  staffingScopeHolidayName = null,
  showStaffingWeekCaption = true,
  shiftConfirmationEnabled = false,
  staffingStatusClickable,
  onOpenStaffingCandidates,
  onOpenPlannedCoverage,
  onOpenConfirmationIssues,
  onOpenSwapRequests,
  statusFooterLayout = "stack",
  areaScopeToggle,
  t,
}: {
  areaName: string;
  staffingEnabled: boolean;
  stats: DashboardAreaWeekStats;
  staffingScopeDateLabel?: string | null;
  staffingScopeMode?: DashboardAreaDetailScope;
  staffingScopeHolidayName?: string | null;
  showStaffingWeekCaption?: boolean;
  shiftConfirmationEnabled?: boolean;
  staffingStatusClickable: boolean;
  onOpenStaffingCandidates?: () => void;
  onOpenPlannedCoverage?: () => void;
  onOpenConfirmationIssues?: (status: DashboardActionableConfirmationStatus) => void;
  onOpenSwapRequests?: () => void;
  statusFooterLayout?: "stack" | "two-column";
  areaScopeToggle?: Props["areaScopeToggle"];
  t: ReturnType<typeof useTranslations>;
}) {
  const statusFooterLines = resolveDashboardAreaStatusFooterLines({
    openSlots: stats.openSlots,
    shiftConfirmationEnabled,
    shiftCount: stats.shiftCount,
    confirmationCounts: stats.confirmationCounts,
    swapRequestedCount: stats.swapRequestedCount,
  });
  const showStatusList = statusFooterLines.length > 0;
  const statusFooterTwoColumn = statusFooterLayout === "two-column";
  const hasScopeColumn = Boolean(areaScopeToggle);
  const headerShellClass = cn(
    CARD_HEADER_CLASS,
    hasScopeColumn && "relative grid-cols-[minmax(0,1fr)_auto]",
    showStatusList &&
      statusFooterTwoColumn &&
      DASHBOARD_AREA_CARD_HEADER_STATUS_TWO_COLUMN_MIN_HEIGHT_CLASS
  );
  const statusFooterShellClass = statusFooterTwoColumn
    ? DASHBOARD_AREA_STATUS_FOOTER_TWO_COLUMN_CLASS
    : DASHBOARD_AREA_STATUS_FOOTER_COLUMN_CLASS;

  const handleStatusFooterLineClick = (id: DashboardAreaStatusFooterLineId) => {
    switch (id) {
      case "open":
        if (staffingStatusClickable) onOpenStaffingCandidates?.();
        return;
      case "proposed":
        onOpenPlannedCoverage?.();
        return;
      case "swap_requested":
        onOpenSwapRequests?.();
        return;
      case "requested":
      case "pending":
      case "rejected":
      case "canceled":
      case "unresolved":
        onOpenConfirmationIssues?.(id);
        return;
      default:
        return;
    }
  };

  const showStaffingHeaderMetrics = staffingEnabled;

  return (
    <div className={headerShellClass}>
      {areaScopeToggle ? (
        <div className={CARD_HEADER_SCOPE_TOGGLE_ANCHOR_CLASS}>
          <DashboardAreaScopeToggle
            {...areaScopeToggle}
            className={DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_HEADER_CLASS}
          />
        </div>
      ) : null}
      <div className={CARD_HEADER_MAIN_CLASS}>
        {hasScopeColumn ? (
          <h2 className="min-w-0 truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
            {areaName}
          </h2>
        ) : (
          <div className="flex items-start justify-between gap-2 md:contents">
            <h2 className="min-w-0 truncate text-lg font-semibold leading-tight tracking-tight text-foreground md:min-w-0">
              {areaName}
            </h2>
            {showStatusList ? (
              <div
                className={cn(
                  "shrink-0 md:hidden",
                  statusFooterTwoColumn && "ml-auto max-w-[min(100%,14rem)]"
                )}
              >
                <DashboardAreaStatusFooterLines
                  lines={statusFooterLines}
                  t={t}
                  layout={statusFooterLayout}
                  onLineClick={handleStatusFooterLineClick}
                />
              </div>
            ) : null}
          </div>
        )}

        {showStaffingHeaderMetrics ? (
          <div className={AREA_CARD_STAFFING_HEADER_SLOT_CLASS}>
            <AreaCardStaffingHeaderGauge stats={stats} t={t} />
          </div>
        ) : null}
        {staffingScopeDateLabel ? (
          <p
            className={cn(
              AREA_CARD_DATE_ROW_CLASS,
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
        ) : !staffingEnabled ? (
          <div aria-hidden />
        ) : null}
      </div>

      {showStatusList ? (
        <div
          className={cn(
            hasScopeColumn
              ? CARD_HEADER_SCOPE_AND_STATUS_COLUMN_CLASS
              : cn("hidden md:block", statusFooterShellClass),
            !hasScopeColumn && MODAL_SCROLLBAR_CLASS
          )}
        >
          {hasScopeColumn ? (
            <div className={CARD_HEADER_SCOPE_TOGGLE_SPACER_CLASS} aria-hidden />
          ) : null}
          <DashboardAreaStatusFooterLines
            lines={statusFooterLines}
            t={t}
            layout={statusFooterLayout}
            onLineClick={handleStatusFooterLineClick}
          />
        </div>
      ) : null}
    </div>
  );
}

const CARD_BODY_SECTION_CLASS =
  "min-w-0 border-b border-border/50 px-4 py-3 last:border-b-0";

const STAFFING_VIEW_CONTROLS_CLASS =
  "mb-2 flex flex-wrap items-center gap-x-4 gap-y-2";

const CARD_METRICS_SECTION_CLASS = "px-4 pb-3 pt-3";

type PastDayStaffingActionPending =
  | { kind: "candidates"; row: DashboardStaffingWindowRow }
  | {
      kind: "staffingIssues";
      row: DashboardStaffingWindowRow;
      issues: readonly DashboardStaffingIssue[];
    }
  | { kind: "windowIssues"; row: DashboardStaffingWindowRow };

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
  onOpenSwapRequests,
  statusFooterLayout = "stack",
  areaScopeToggle,
}: Props) {
  const t = useTranslations();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
  const organization = useOrganization();
  const allowPastShiftChanges = useAllowPastShiftChanges();
  const planningPastShiftChecker = useMemo(
    () =>
      createPlanningPastShiftChecker(
        allowPastShiftChanges,
        resolveOrganizationTimeZone(organization)
      ),
    [allowPastShiftChanges, organization]
  );
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
  const [pastDayChangeConfirm, setPastDayChangeConfirm] =
    useState<PastDayStaffingActionPending | null>(null);
  const [allowPastDayStaffingEdits, setAllowPastDayStaffingEdits] =
    useState(false);
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

  const [staffingViewPrefs, updateStaffingViewPrefs] =
    useDashboardAreaStaffingViewPrefs(stats.areaId);

  const resolvedStaffingScope =
    areaScopeToggle?.scope ?? staffingScopeMode ?? "week";
  const showIncludePastDaysCheckbox = resolvedStaffingScope === "week";

  const staffingTableRows = useMemo(() => {
    const rows = stats.staffingWindowRows;
    if (!showIncludePastDaysCheckbox || staffingViewPrefs.includePastDaysInWeek) {
      return rows;
    }
    return filterStaffingWindowRowsForWeekView(
      rows,
      todayISO,
      staffingViewPrefs.includePastDaysInWeek
    );
  }, [
    stats.staffingWindowRows,
    showIncludePastDaysCheckbox,
    staffingViewPrefs.includePastDaysInWeek,
    todayISO,
  ]);

  const staffingTableLineOptions = useMemo(
    (): FlattenStaffingWindowTableLinesOptions => ({
      compactStaffingRows: staffingViewPrefs.compactStaffingRows,
      todayISO,
      shiftConfirmationEnabled,
      windowIssuesEnabled,
    }),
    [
      staffingViewPrefs.compactStaffingRows,
      todayISO,
      shiftConfirmationEnabled,
      windowIssuesEnabled,
    ]
  );

  const staffingDetailsPerStatusAvailable = useMemo(
    () =>
      staffingWindowRowsHaveDetailsPerStatusSplit(staffingTableRows, {
        todayISO,
        shiftConfirmationEnabled,
        windowIssuesEnabled,
      }),
    [
      staffingTableRows,
      todayISO,
      shiftConfirmationEnabled,
      windowIssuesEnabled,
    ]
  );

  const effectiveStaffingTableLineOptions = useMemo(
    (): FlattenStaffingWindowTableLinesOptions => ({
      ...staffingTableLineOptions,
      compactStaffingRows:
        staffingTableLineOptions.compactStaffingRows === true &&
        staffingDetailsPerStatusAvailable,
    }),
    [staffingTableLineOptions, staffingDetailsPerStatusAvailable]
  );

  const staffingStatusClickable = isStaffingHeaderStatusClickable({
    ampelLevel: stats.ampelLevel,
    isPastScope,
    hasCandidatesPlanning: Boolean(candidatesPlanning),
    staffingWindowRows: stats.staffingWindowRows,
    todayISO,
    allowPastShiftChanges,
    timeZone: resolveOrganizationTimeZone(organization),
  });

  const openStaffingCandidatesFromHeader = () => {
    const row = findFirstStaffingCandidatesRow(stats.staffingWindowRows, {
      todayISO,
      allowPastShiftChanges,
      timeZone: resolveOrganizationTimeZone(organization),
    });
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

  const openPlannedCoverageFromHeader = () => {
    const row = findFirstPlannedStaffingWindowRow(stats.staffingWindowRows, {
      allowPastShiftChanges,
      timeZone: resolveOrganizationTimeZone(organization),
    });
    if (!row) return;
    if (staffingWindowRowHasUnconfirmedPlannedCoverage(row)) {
      setWindowIssuesConfirmationFilter("proposed");
    } else {
      setWindowIssuesConfirmationFilter(null);
    }
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

  const executePastDayStaffingAction = useCallback(
    (pending: PastDayStaffingActionPending) => {
      switch (pending.kind) {
        case "candidates":
          setCandidatesRow(pending.row);
          break;
        case "staffingIssues":
          openStaffingIssuesModal([...pending.issues]);
          break;
        case "windowIssues":
          setWindowIssuesConfirmationFilter(null);
          setWindowIssuesRow(pending.row);
          break;
      }
    },
    []
  );

  const requestStaffingRowAction = useCallback(
    (pending: PastDayStaffingActionPending) => {
      if (
        planningPastShiftChecker.isMomentInPast(
          planningMomentFromStaffingRow(pending.row)
        )
      ) {
        if (!allowPastShiftChanges) return;
        setPastDayChangeConfirm(pending);
        return;
      }
      executePastDayStaffingAction(pending);
    },
    [allowPastShiftChanges, executePastDayStaffingAction, planningPastShiftChecker]
  );

  const confirmPastDayStaffingAction = useCallback(() => {
    if (!pastDayChangeConfirm) return;
    setAllowPastDayStaffingEdits(true);
    executePastDayStaffingAction(pastDayChangeConfirm);
    setPastDayChangeConfirm(null);
  }, [executePastDayStaffingAction, pastDayChangeConfirm]);

  const closePastDayChangeConfirm = useCallback(() => {
    setPastDayChangeConfirm(null);
  }, []);

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
        "relative flex min-w-0 flex-col border border-border bg-surface shadow-sm transition-[box-shadow,border-color] hover:border-primary/25 hover:shadow-md",
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
          staffingScopeDateLabel={staffingScopeDateLabel}
          staffingScopeMode={staffingScopeMode}
          staffingScopeHolidayName={staffingScopeHolidayName}
          showStaffingWeekCaption={showStaffingWeekCaption}
          shiftConfirmationEnabled={shiftConfirmationEnabled}
          staffingStatusClickable={staffingStatusClickable}
          onOpenStaffingCandidates={
            staffingStatusClickable ? openStaffingCandidatesFromHeader : undefined
          }
          onOpenPlannedCoverage={
            windowIssuesEnabled ? openPlannedCoverageFromHeader : undefined
          }
          onOpenConfirmationIssues={
            windowIssuesEnabled ? openConfirmationIssuesFromHeader : undefined
          }
          onOpenSwapRequests={onOpenSwapRequests}
          statusFooterLayout={statusFooterLayout}
          areaScopeToggle={areaScopeToggle}
          t={t}
        />

        {showStaffingTable ? (
          <div className={CARD_BODY_SECTION_CLASS}>
            <div className={STAFFING_VIEW_CONTROLS_CLASS}>
              <label
                className={cn(
                  "flex items-center gap-2 text-sm text-foreground",
                  staffingDetailsPerStatusAvailable
                    ? "cursor-pointer"
                    : "cursor-default opacity-60"
                )}
              >
                <Checkbox
                  checked={
                    staffingViewPrefs.compactStaffingRows &&
                    staffingDetailsPerStatusAvailable
                  }
                  disabled={!staffingDetailsPerStatusAvailable}
                  onChange={(event) =>
                    updateStaffingViewPrefs({
                      compactStaffingRows: event.target.checked,
                    })
                  }
                  className="shrink-0"
                />
                <span>{t("dashboard.staffingViewCompact")}</span>
              </label>
              {showIncludePastDaysCheckbox ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={staffingViewPrefs.includePastDaysInWeek}
                    onChange={(event) =>
                      updateStaffingViewPrefs({
                        includePastDaysInWeek: event.target.checked,
                      })
                    }
                    className="shrink-0"
                  />
                  <span>{t("dashboard.staffingViewIncludePastDays")}</span>
                </label>
              ) : null}
            </div>
            <StaffingWindowTable
              rows={staffingTableRows}
              dayColumnLabel={t("dashboard.ampelColumnDay")}
              timeColumnLabel={t("dashboard.ampelColumnTime")}
              shiftColumnLabel={t("dashboard.ampelColumnShift")}
              staffingColumnLabel={t("dashboard.ampelColumnStaffing")}
              noServiceHoursLabel={t("areaCalendar.noServiceHours")}
              assignEmployeeTooltipLabel={t("dashboard.ampelStaffingAssignEmployeeTooltip")}
              staffingIssuesButtonLabel={t("dashboard.staffingIssuesButtonLabelOne")}
              windowIssuesButtonLabel={t("dashboard.staffingWindowIssuesButtonLabel")}
              windowIssuesTooltipLabel={t("dashboard.staffingWindowIssuesTitle")}
              pastDayBlockedTooltip={t("dashboard.pastDayPlanningChangeBlocked")}
              planningPastShiftChecker={planningPastShiftChecker}
              onOpenCandidates={(row) =>
                requestStaffingRowAction({ kind: "candidates", row })
              }
              onOpenStaffingIssues={(row) =>
                requestStaffingRowAction({
                  kind: "staffingIssues",
                  row,
                  issues: [
                    ...(row.staffingConflicts ?? []),
                    ...(row.staffingHints ?? []),
                  ],
                })
              }
              onOpenWindowIssues={(row) =>
                requestStaffingRowAction({ kind: "windowIssues", row })
              }
              todayISO={todayISO}
              shiftConfirmationEnabled={shiftConfirmationEnabled}
              windowIssuesEnabled={windowIssuesEnabled}
              showShiftColumn={stats.hasAreaShiftTemplates}
              tableLineOptions={effectiveStaffingTableLineOptions}
              t={t}
            />
          </div>
        ) : null}

        <div className={CARD_METRICS_SECTION_CLASS}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex min-w-0 flex-[1_1_12rem] cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={showMetricsDetails}
                onChange={(event) => setShowMetricsDetails(event.target.checked)}
                className="shrink-0"
              />
              <span className="min-w-0">
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
                className={cn(
                  DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS,
                  "shrink-0"
                )}
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

      {pastDayChangeConfirm ? (
        <DashboardPastDayChangeConfirmModal
          onCancel={closePastDayChangeConfirm}
          onConfirm={confirmPastDayStaffingAction}
        />
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
          allowPastDayChange={allowPastDayStaffingEdits}
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
          allowPastDayChange={allowPastDayStaffingEdits}
          context={{
            ...windowIssuesContext,
            areaId: stats.areaId,
            areaName: stats.areaName,
            areaCalendarHref,
          }}
          confirmationStatusFilter={windowIssuesConfirmationFilter}
          onOpenCandidates={
            candidatesPlanning
              ? (row) =>
                  requestStaffingRowAction({ kind: "candidates", row })
              : undefined
          }
          onClose={closeWindowIssuesModal}
        />
      ) : null}
    </article>
  );
}
