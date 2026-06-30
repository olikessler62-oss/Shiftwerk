"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { DashboardAreaAmpelCard } from "@/components/dashboard/dashboard-area-ampel-card";
import { DashboardDayDrilldownAreaCombobox } from "@/components/dashboard/dashboard-day-drilldown-area-combobox";
import {
  DashboardDayDrilldownDayCombobox,
  DASHBOARD_DAY_DRILLDOWN_WEEK_VALUE,
} from "@/components/dashboard/dashboard-day-drilldown-day-combobox";
import { DashboardDayDrilldownAreasMasonry } from "@/components/dashboard/dashboard-day-drilldown-areas-masonry";
import {
  DashboardAreaAssignmentOverviewModal,
  type DashboardAreaAssignmentOverviewContext,
} from "@/components/dashboard/dashboard-area-assignment-overview-modal";
import type { DashboardStaffingCandidatesPlanningContext } from "@/components/dashboard/dashboard-staffing-row-candidates-modal";
import type { DashboardStaffingWindowIssuesContext } from "@/lib/dashboard-staffing-window-issues";
import { cn } from "@/lib/cn";
import {
  parseISODate,
  startOfWeek,
  toISODate,
  isPastCalendarDate,
  weekDates,
} from "@/lib/dates";
import { toIntlLocale } from "@/i18n/intl-locale";
import { isAreaStaffingUncovered } from "@/lib/dashboard-area-header-actions";
import {
  weekdayIndexFromDate,
  weekdayLabelFromIndex,
} from "@/lib/location-staffing-client";
import {
  isEnglishIntlLocale,
  weekdayAbbrevFromIndex,
} from "@schichtwerk/i18n";
import { formatDayHeader } from "@/lib/planning-utils";
import { buildHolidayNamesByDate } from "@/lib/german-public-holidays";
import {
  CALENDAR_DAY_HEADER_ACTIVE_CLASS,
  CALENDAR_HOLIDAY_DAY_HEADER_LABEL_LEFT_CLASS,
} from "@/lib/calendar-day-header-styles";
import {
  DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS,
} from "@/lib/dashboard-panel-styles";
import { dayCardMinHeightRem } from "@/lib/dashboard-day-card-layout";
// Experiment Wochentags-Farben — zum Reaktivieren Import + DayCard-Block unten einkommentieren:
// import {
//   DAY_CARD_WEEKDAY_BODY_SURFACE_CLASS,
//   resolveDayCardWeekdaySurfaces,
// } from "@/lib/dashboard-day-card-weekday-colors";
import { useOrgFeatures, useOrganization, useShowCompensationInPlanningUi } from "@/lib/org-features-provider";
import { buildPlanningPageUrl, planningWeekStartFromParam } from "@/lib/planning-week";
import { APP_SHELL_CONTENT_OFFSET_CLASS } from "@/lib/app-shell-layout";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-modal-shell";
import {
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS,
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS,
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_SHELL_CLASS,
  DASHBOARD_STATUS_BAR_COMPACT_NAV_BUTTON_CLASS,
} from "@/lib/dashboard-toolbar-ui";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Profile,
  Qualification,
} from "@schichtwerk/types";
import { useClearMainNavPendingWhenReady } from "@/lib/app-shell-main-nav-pending";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import type { DashboardExtPanelSnapshot } from "@/lib/dashboard-ext-panel-data";
import {
  computeDashboardAreaWeekStats,
  sortDashboardAreaWeekStats,
  type DashboardAreaAmpelLevel,
  type DashboardAreaWeekStats,
  type DashboardLocationWeekRollup,
} from "@/lib/dashboard-area-week-stats";
import {
  computeLocationCompensationRollup,
  formatTagAreaFooterMoney,
} from "@/lib/tag-area-footer-stats";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
import { buildBreaksByTemplateIdFromAreaTemplates } from "@/lib/shift-work-hours";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES,
  DASHBOARD_DAY_CONFIRMATION_STATUSES,
  hasActionableConfirmationCounts,
  type DashboardDayConfirmationCounts,
} from "@/lib/dashboard-day-confirmation-counts";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { resolveDashboardAreaCardScopeDateLabel, resolveDashboardAreaCardScopeDateISO, resolveDashboardAreaStatsDates } from "@/lib/dashboard-area-card-scope-label";
import {
  planDashboardDrilldownWeekTransition,
  resolveDashboardDrilldownDayIndex,
  type CurrentWeekDrilldownSnapshot,
} from "@/lib/dashboard-drilldown-week-navigation";
import {
  buildDashboardOverviewDrilldownHref,
  readDashboardOverviewDrilldownFromSearchParams,
  resolveDashboardOverviewViewFromSearchParams,
  type DashboardOverviewDrilldownUrlState,
} from "@/lib/dashboard-overview-drilldown-url";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { getAreaCalendarWeekHeaderParts } from "@/lib/planning-utils";
import { formatDurationHours } from "@/lib/shift-type-display";
import type { DashboardExtDaySnapshot } from "@/lib/dashboard-ext-panel-data";
import { organizationTodayISO } from "@schichtwerk/database";
import { isPastWeek } from "@/lib/planning-readonly";

/** Dashboard 3 — Ecken maximal 5px. */
const D3_ROUNDED = "rounded-[5px]";

/** Feiner Rahmen + dezenter Schatten für Content-Karten. */
const D3_CARD_FRAME_CLASS =
  "border border-black/10 shadow-[0_1px_2px_0_rgba(15,23,42,0.06)]";

// ── Ampel helpers ──────────────────────────────────────────────────────────

function ampelDot(level: DashboardAreaAmpelLevel) {
  return <StaffingStatusStrokeIcon level={level} />;
}

function ampelLabel(level: DashboardAreaAmpelLevel): string {
  const labels: Record<DashboardAreaAmpelLevel, string> = {
    met: "Vollständig besetzt",
    no_demand: "Kein Bedarf",
    partial: "Teilweise besetzt",
    critical: "Kritisch – offen",
    overstaffed_only: "Überbesetzt",
  };
  return labels[level];
}

const D3_STAFFING_STROKE_ICON_CLASS = "h-5 w-5 shrink-0";

const D3_STROKE_ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const D3_STAFFING_STROKE_COLOR: Record<DashboardAreaAmpelLevel, string> = {
  met: "text-green-600",
  partial: STAFFING_OCHER_TEXT_CLASS,
  critical: "text-red-600",
  no_demand: "text-slate-400",
  overstaffed_only: "text-blue-600",
};

/** Monoline-Stroke-Icons (Lucide-Stil) — einheitlich 20 px, semantische Farbe. */
function StaffingStatusStrokeIcon({
  level,
  muted,
  className,
}: {
  level: DashboardAreaAmpelLevel;
  muted?: boolean;
  className?: string;
}) {
  const label = ampelLabel(level);
  const svgClass = cn(
    D3_STAFFING_STROKE_ICON_CLASS,
    D3_STAFFING_STROKE_COLOR[level],
    muted && "opacity-40",
    className
  );

  switch (level) {
    case "met":
      return (
        <svg {...D3_STROKE_ICON_PROPS} className={svgClass} aria-label={label}>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "partial":
      return (
        <svg {...D3_STROKE_ICON_PROPS} className={svgClass} aria-label={label}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "critical":
      return (
        <svg {...D3_STROKE_ICON_PROPS} className={svgClass} aria-label={label}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "no_demand":
      return (
        <svg {...D3_STROKE_ICON_PROPS} className={svgClass} aria-label={label}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
        </svg>
      );
    case "overstaffed_only":
      return (
        <svg {...D3_STROKE_ICON_PROPS} className={svgClass} aria-label={label}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
        </svg>
      );
  }
}

function DayCardAreaAmpelIcon({
  level,
  muted,
}: {
  level: DashboardAreaAmpelLevel;
  muted: boolean;
}) {
  return <StaffingStatusStrokeIcon level={level} muted={muted} />;
}

// ── Drill-down state ───────────────────────────────────────────────────────

type AreaDetailScope = "day" | "week";

type View =
  | { level: "week" }
  | { level: "day"; dayIndex: number };

// ── Wochen-Kennzahlen (dezent als Tabelle) ─────────────────────────────────

type D3WeekSummaryAccent = "green" | "red" | "yellow" | "gray" | "neutral";

type D3WeekSummaryTableRow = {
  key: string;
  label: string;
  value: string | number;
  detail?: string;
  accent?: D3WeekSummaryAccent;
};

const D3_WEEK_SUMMARY_TABLE_SHELL_CLASS = cn(
  D3_ROUNDED,
  "overflow-hidden border border-black/15"
);

const D3_WEEK_SUMMARY_LABEL_CLASS =
  "text-[10px] font-medium leading-tight text-foreground/80";
const D3_WEEK_SUMMARY_DETAIL_CLASS =
  "text-[10px] leading-tight text-foreground/72";

function d3WeekSummaryValueClass(accent: D3WeekSummaryAccent = "neutral"): string {
  switch (accent) {
    case "green":
      return "text-green-700/90";
    case "red":
      return "text-red-700/90";
    case "yellow":
      return "text-[#784e00]/90";
    case "gray":
      return "text-foreground/72";
    default:
      return "text-foreground";
  }
}

function D3WeekSummaryTableCell({
  row,
  isLabelRow,
}: {
  row: D3WeekSummaryTableRow;
  isLabelRow: boolean;
}) {
  if (isLabelRow) {
    return (
      <th
        scope="col"
        className="border-l border-black/[0.08] px-2 py-1 text-left font-normal first:border-l-0 sm:px-3"
      >
        <span className={cn("block truncate", D3_WEEK_SUMMARY_LABEL_CLASS)}>
          {row.label}
        </span>
      </th>
    );
  }

  return (
    <td className="border-l border-black/[0.08] px-2 pb-1.5 pt-0 align-top first:border-l-0 sm:px-3 sm:pb-2">
      <span
        className={cn(
          "block truncate text-sm font-semibold tabular-nums leading-tight",
          d3WeekSummaryValueClass(row.accent)
        )}
      >
        {row.value}
      </span>
      {row.detail ? (
        <span className={cn("mt-0.5 block truncate", D3_WEEK_SUMMARY_DETAIL_CLASS)}>
          {row.detail}
        </span>
      ) : null}
    </td>
  );
}

function D3WeekSummarySection({
  rows,
  showTopBorder = false,
}: {
  rows: readonly D3WeekSummaryTableRow[];
  showTopBorder?: boolean;
}) {
  return (
    <tbody className={cn(showTopBorder && "border-t border-black/12")}>
      <tr>
        {rows.map((row) => (
          <D3WeekSummaryTableCell key={`${row.key}-label`} row={row} isLabelRow />
        ))}
      </tr>
      <tr>
        {rows.map((row) => (
          <D3WeekSummaryTableCell key={`${row.key}-value`} row={row} isLabelRow={false} />
        ))}
      </tr>
    </tbody>
  );
}

function D3WeekSummaryMetrics({
  todayDay,
  coveragePct,
  rollup,
}: {
  todayDay: DashboardExtDaySnapshot | undefined;
  coveragePct: number | null;
  rollup: DashboardLocationWeekRollup;
}) {
  const t = useTranslations();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";
  const money = (amount: number) =>
    `${formatTagAreaFooterMoney(amount, intlLocale)} €`;
  const incomplete = t("dashboard.ampelCompensationIncomplete");

  const staffingRows: D3WeekSummaryTableRow[] = [
    {
      key: "today-open",
      label: "Heute offen",
      value: todayDay
        ? todayDay.openSlots === 0
          ? "✓ Besetzt"
          : todayDay.openSlots
        : "—",
      detail: todayDay
        ? `${todayDay.shiftCount} Schichten heute`
        : undefined,
      accent: !todayDay
        ? "gray"
        : todayDay.openSlots === 0
          ? "green"
          : "red",
    },
    {
      key: "week-coverage",
      label: "Woche gesamt",
      value: coveragePct !== null ? `${coveragePct}%` : "—",
      detail:
        rollup.requiredTotal > 0
          ? `${rollup.assignedTotal}/${rollup.requiredTotal} besetzt`
          : "Kein Bedarf konfiguriert",
      accent:
        coveragePct === null
          ? "gray"
          : coveragePct >= 90
            ? "green"
            : coveragePct >= 60
              ? "yellow"
              : "red",
    },
    {
      key: "open-slots",
      label: "Offene Stellen",
      value: rollup.openSlots,
      detail:
        rollup.criticalAreaCount > 0
          ? `${rollup.criticalAreaCount} kritische Bereiche`
          : "Alles im grünen Bereich",
      accent:
        rollup.openSlots === 0
          ? "green"
          : rollup.criticalAreaCount > 0
            ? "red"
            : "yellow",
    },
  ];

  const compensationRows: D3WeekSummaryTableRow[] = [
    {
      key: "base",
      label: t("dashboard.ampelDetailBaseCompensation"),
      value: rollup.hasCompensation ? money(rollup.baseCost) : incomplete,
      accent: "neutral",
    },
    {
      key: "surcharges",
      label: t("dashboard.kpiSurcharges"),
      value: !rollup.hasCompensation
        ? incomplete
        : rollup.surchargeCost > 0
          ? `+${money(rollup.surchargeCost)}`
          : money(0),
      accent: "neutral",
    },
    {
      key: "total",
      label: t("dashboard.kpiTotalCost"),
      value: rollup.hasCompensation ? money(rollup.totalCost) : incomplete,
      detail: rollup.hasCompensation
        ? t("dashboard.ampelHours", {
            hours: formatDurationHours(rollup.totalHours),
          })
        : undefined,
      accent: "neutral",
    },
  ];

  return (
    <div className={D3_WEEK_SUMMARY_TABLE_SHELL_CLASS}>
      <table className="w-full table-fixed border-collapse">
        <D3WeekSummarySection rows={staffingRows} />
        {showCompensationInPlanningUi ? (
          <D3WeekSummarySection rows={compensationRows} showTopBorder />
        ) : null}
      </table>
    </div>
  );
}

/** Tag-Karten + Statuszeile — gemeinsames Raster für Kalender-Button-Ausrichtung. */
const D3_DAY_CARDS_GRID_CLASS =
  "grid min-w-0 max-w-full auto-rows-fr grid-cols-1 items-stretch gap-2 min-[380px]:grid-cols-2 min-[380px]:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7";

function formatDashboardScopeDayMonth(dateISO: string, intlLocale: string): string {
  const date = parseISODate(dateISO);
  const day = String(date.getDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat(intlLocale, { month: "short" })
    .format(date)
    .replace(/\.$/, "")
    .slice(0, 3);
  return `${day}.${month}`;
}

function formatDashboardAreaScopeDayLabel(
  dateISO: string,
  intlLocale: string
): string {
  const { weekday } = formatDayHeader(dateISO, intlLocale, "short");
  return `${weekday} ${formatDashboardScopeDayMonth(dateISO, intlLocale)}`;
}

function formatDashboardAreaScopeWeekLabel(
  weekStartISO: string,
  intlLocale: string,
  calendarWeek: number
): string {
  const start = parseISODate(weekStartISO);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = formatDashboardScopeDayMonth(weekStartISO, intlLocale);
  const endLabel = formatDashboardScopeDayMonth(toISODate(end), intlLocale);
  return `KW ${calendarWeek} (${startLabel} - ${endLabel})`;
}

function weekEndISO(weekStartISO: string): string {
  const end = parseISODate(weekStartISO);
  end.setDate(end.getDate() + 6);
  return toISODate(end);
}

function resolveAreaCardPastScope(
  areaScope: AreaDetailScope,
  dayDateISO: string,
  weekStartISO: string,
  todayISO: string
): boolean {
  if (areaScope === "day") {
    return isPastCalendarDate(dayDateISO, todayISO);
  }
  return isPastWeek(weekEndISO(weekStartISO));
}

function buildDashboardCalendarHref(
  pathname: "/bereich-kalender" | "/mitarbeiter-kalender",
  weekStart: string,
  locationId: string | null
): string {
  const params = new URLSearchParams();
  params.set("week", weekStart);
  if (locationId) params.set("location", locationId);
  return buildPlanningPageUrl(pathname, params);
}

export function DashboardLocationStatusBar({
  weekStart,
  locationId,
  backAction,
  backButtonRef,
}: {
  weekStart: string;
  locationId: string | null;
  backAction?: { label: string; onClick: () => void } | null;
  backButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations();

  const employeeCalendarHref = useMemo(
    () => buildDashboardCalendarHref("/mitarbeiter-kalender", weekStart, locationId),
    [weekStart, locationId]
  );
  const areaCalendarHref = useMemo(
    () => buildDashboardCalendarHref("/bereich-kalender", weekStart, locationId),
    [weekStart, locationId]
  );

  const navButtonClass = DASHBOARD_STATUS_BAR_COMPACT_NAV_BUTTON_CLASS;

  const calendarNavLinks = (
    <>
      <Link
        href={employeeCalendarHref}
        className={cn(navButtonClass, "shrink-0 justify-center max-sm:px-2")}
      >
        <span className="sm:hidden">{t("dashboard.calendarNavEmployee")}</span>
        <span className="hidden sm:inline">{t("nav.employeeCalendar")}</span>
      </Link>
      <Link
        href={areaCalendarHref}
        className={cn(navButtonClass, "shrink-0 justify-center max-sm:px-2")}
      >
        <span className="sm:hidden">{t("dashboard.calendarNavArea")}</span>
        <span className="hidden sm:inline">{t("nav.areaCalendar")}</span>
      </Link>
    </>
  );

  return (
    <header
      className={cn(
        "flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-2"
      )}
    >
      {backAction ? (
        <button
          ref={backButtonRef}
          type="button"
          onClick={backAction.onClick}
          className={cn(navButtonClass, "gap-1.5")}
          aria-label={backAction.label}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="whitespace-nowrap">{backAction.label}</span>
        </button>
      ) : null}

      <div className="flex min-w-0 shrink-0 flex-row flex-nowrap items-stretch gap-2 sm:ml-auto">
        {calendarNavLinks}
      </div>
    </header>
  );
}

// ── Area scope toggle ──────────────────────────────────────────────────────

function D3AreaScopeToggle({
  scope,
  dayLabel,
  weekLabel,
  weekShortLabel,
  onScopeChange,
}: {
  scope: AreaDetailScope;
  dayLabel: string;
  weekLabel: string;
  weekShortLabel?: string;
  onScopeChange: (scope: AreaDetailScope) => void;
}) {
  const t = useTranslations();
  const weekButtonLabel = weekShortLabel ?? weekLabel;

  return (
    <div
      role="group"
      aria-label={t("dashboard.areaScopeAriaLabel")}
      className={DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_SHELL_CLASS}
    >
      <button
        type="button"
        aria-pressed={scope === "day"}
        title={dayLabel}
        onClick={() => onScopeChange("day")}
        className={
          scope === "day"
            ? DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS
            : DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS
        }
      >
        <span className="min-w-0 truncate">{dayLabel}</span>
      </button>
      <button
        type="button"
        aria-pressed={scope === "week"}
        title={weekLabel}
        onClick={() => onScopeChange("week")}
        className={
          scope === "week"
            ? DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS
            : DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS
        }
      >
        <span className="min-w-0 truncate">{weekButtonLabel}</span>
      </button>
    </div>
  );
}

/** Tag-Karten — Schatten (einzeln). */
const D3_DAY_CARD_FRAME_SHADOW_CLASS =
  "shadow-[0_2px_6px_-1px_rgba(15,23,42,0.1),0_1px_3px_0_rgba(15,23,42,0.06)]";

/** Tag-Karten im Wochen-Tray — flacher, der Tray trägt die Tiefe. */
const D3_DAY_CARD_IN_WEEK_TRAY_SHADOW_CLASS =
  "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]";

/** Tag-Karten — einheitlicher schwarzer 1px-Rahmen. */
const D3_DAY_CARD_BORDER_CLASS = "border border-black";

/** Wochen-Tray — Kalender-Objekt: aktiver Kopf, weißer Body, schwarzer Rahmen. */
const D3_WEEK_TRAY_CLASS = cn(
  D3_ROUNDED,
  "overflow-x-hidden border border-black bg-white",
  "shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12),0_2px_8px_-2px_rgba(15,23,42,0.08)]"
);

const D3_WEEK_TRAY_HEADER_CLASS = cn(
  CALENDAR_DAY_HEADER_ACTIVE_CLASS,
  "border-b border-black px-3 py-2.5 text-center sm:px-4"
);

const D3_WEEK_TRAY_BODY_CLASS = "p-2 sm:p-3";

/**
 * Wochenansicht: einzelne Karten mit Abstand; Höhe folgt dem Inhalt (kein fr-Stretch).
 */
const D3_DAY_CARDS_WEEK_TRAY_GRID_CLASS = cn(
  "grid w-full min-w-0 max-w-full auto-rows-auto items-start",
  "grid-cols-1 gap-2",
  "min-[380px]:grid-cols-2 min-[380px]:gap-2.5",
  "sm:grid-cols-3 sm:gap-3",
  "md:grid-cols-4 md:gap-3",
  "2xl:grid-cols-7 2xl:gap-1.5"
);

/** Klickbare Bereichszeile in der Daycard (Icon + Name, schmal hinter dem Text). */
const D3_DAY_CARD_AREA_ROW_BUTTON_CLASS = cn(
  "inline-flex max-w-full items-center gap-x-2.5 pr-[5px]",
  "cursor-pointer rounded-sm text-left",
  "hover:bg-black/[0.09] active:bg-black/[0.12]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
);

const D3_DAY_CARD_AREA_ROW_STATIC_CLASS =
  "inline-flex max-w-full items-center gap-x-2.5 pr-[5px]";

/** Tag-Karte im Wochen-Tray — dezente abgerundete Einzelkarte. */
const D3_DAY_CARD_WEEK_TRAY_CLASS = cn(
  D3_ROUNDED,
  D3_DAY_CARD_BORDER_CLASS,
  D3_DAY_CARD_IN_WEEK_TRAY_SHADOW_CLASS
);

/** Datums- + Wochentagszeile — feste Höhe inkl. reservierter Feiertagszeile. */
const D3_DAY_CARD_HEADER_SLOT_CLASS = cn(
  DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS,
  "border-t border-t-black border-b border-b-[#5c6678]",
  "flex min-h-[4.5rem] shrink-0 flex-col justify-start px-3.5 pb-2.5 pt-2.5"
);

/** Feiertagszeile unter dem Datum — Slot immer reserviert (kein Layout-Sprung). */
const D3_DAY_CARD_HOLIDAY_SLOT_CLASS =
  "mt-px h-[13px] min-h-[13px] shrink-0 overflow-hidden";

const D3_DAY_CARD_HOLIDAY_LABEL_CLASS = CALENDAR_HOLIDAY_DAY_HEADER_LABEL_LEFT_CLASS;

/** Content unter dem Kopf — Hover-Hintergrund (via group-hover auf der Tag-Karte). */
const D3_DAY_CARD_BODY_HOVER_SURFACE_CLASS = "group-hover:bg-[#eff3f7]";

/** Vergangene Tage — helleres Grau im Content unter dem Kopf. */
const D3_DAY_CARD_BODY_PAST_SURFACE_CLASS = cn(
  "bg-[#e8ebf0]",
  D3_DAY_CARD_BODY_HOVER_SURFACE_CLASS
);

const D3_DAY_CARD_STATUS_DOT_CLASS = "size-2.5 shrink-0 rounded-full";

function dayCardShowsStatusDot(
  day: DashboardExtDaySnapshot,
  staffingEnabled: boolean
): boolean {
  return staffingEnabled && day.hasServiceHours;
}

function dayCardStatusDotClass(day: DashboardExtDaySnapshot): string {
  const hasUncoveredArea = day.areas.some(
    (area) => area.hasServiceHours && isAreaStaffingUncovered(area.ampelLevel)
  );

  return hasUncoveredArea ? "bg-red-600" : "bg-emerald-600";
}

function dayCardWeekdayTwoLetter(
  weekdayIndex: number,
  localeKey: "de" | "en"
): string {
  const raw = weekdayAbbrevFromIndex(weekdayIndex, localeKey).replace(/\.$/, "");
  const two = raw.slice(0, 2);
  return two.charAt(0).toUpperCase() + two.slice(1).toLowerCase();
}

function dayCardEditorialDateParts(dateISO: string, intlLocale: string) {
  const localeKey = isEnglishIntlLocale(intlLocale) ? "en" : "de";
  const date = parseISODate(dateISO);
  const dayNumber = date.toLocaleDateString(intlLocale, { day: "numeric" });
  const monthLong = date.toLocaleDateString(intlLocale, { month: "long" });
  return {
    weekdayShort: dayCardWeekdayTwoLetter(
      weekdayIndexFromDate(dateISO),
      localeKey
    ),
    dateLabel: `${dayNumber}. ${monthLong}`,
  };
}

// ── Day card ───────────────────────────────────────────────────────────────

const DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS =
  "inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums";

function dayCardConfirmationChipClass(status: ShiftConfirmationStatus): string {
  switch (status) {
    case "requested":
      return cn(
        DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS,
        "border-amber-200/90 bg-amber-50",
        STAFFING_OCHER_TEXT_CLASS
      );
    case "pending":
      return cn(
        DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS,
        "border-fuchsia-200/90 bg-fuchsia-50 text-[#701a75]"
      );
    case "rejected":
      return cn(
        DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS,
        "border-red-200 bg-red-50 text-red-800"
      );
    case "canceled":
      return cn(
        DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS,
        "border-orange-200 bg-orange-50 text-orange-800"
      );
    case "unresolved":
      return cn(
        DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS,
        "border-neutral-200 bg-neutral-100 text-neutral-600"
      );
    default:
      return DAY_CARD_CONFIRMATION_CHIP_BASE_CLASS;
  }
}

function dayCardConfirmationShortLabelKey(
  status: (typeof DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES)[number]
):
  | "dashboard.dayCardConfirmationShort.requested"
  | "dashboard.dayCardConfirmationShort.pending"
  | "dashboard.dayCardConfirmationShort.rejected"
  | "dashboard.dayCardConfirmationShort.canceled"
  | "dashboard.dayCardConfirmationShort.unresolved" {
  return `dashboard.dayCardConfirmationShort.${status}` as const;
}

function DayCardConfirmationTooltipContent({
  counts,
  t,
}: {
  counts: DashboardDayConfirmationCounts;
  t: ReturnType<typeof useTranslations>;
}) {
  const lines = DASHBOARD_DAY_CONFIRMATION_STATUSES.filter(
    (status) => counts[status] > 0
  );

  if (lines.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="font-semibold text-foreground">
        {t("dashboard.dayCardConfirmationTooltipTitle")}
      </p>
      {lines.map((status) => (
        <p key={status}>
          {counts[status]} {t(shiftConfirmationStatusLabelKey(status))}
        </p>
      ))}
    </div>
  );
}

function DayCardConfirmationChips({
  counts,
  t,
}: {
  counts: DashboardDayConfirmationCounts;
  t: ReturnType<typeof useTranslations>;
}) {
  const actionableStatuses = DASHBOARD_DAY_ACTIONABLE_CONFIRMATION_STATUSES.filter(
    (status) => counts[status] > 0
  );

  if (actionableStatuses.length === 0) return null;

  const chips = (
    <div className="flex flex-wrap gap-1">
      {actionableStatuses.map((status) => (
        <span key={status} className={dayCardConfirmationChipClass(status)}>
          {counts[status]} {t(dayCardConfirmationShortLabelKey(status))}
        </span>
      ))}
    </div>
  );

  return (
    <Tooltip content={<DayCardConfirmationTooltipContent counts={counts} t={t} />}>
      <span className="inline-flex max-w-full">{chips}</span>
    </Tooltip>
  );
}

function DayCard({
  day,
  areaCount,
  staffingEnabled,
  shiftConfirmationEnabled,
  embeddedInWeekTray = false,
  holidayName = null,
  onClick,
  onAreaClick,
}: {
  day: DashboardExtDaySnapshot;
  areaCount: number;
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  embeddedInWeekTray?: boolean;
  holidayName?: string | null;
  onClick: () => void;
  onAreaClick?: (areaId: string) => void;
}) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const { weekdayShort, dateLabel } = dayCardEditorialDateParts(
    day.dateISO,
    intlLocale
  );
  const isPastDay = day.isPast && !day.isToday;
  const showStatusDot = dayCardShowsStatusDot(day, staffingEnabled);
  // const weekdaySurfaces = resolveDayCardWeekdaySurfaces(weekdayIndexFromDate(day.dateISO), {
  //   isPast: isPastDay,
  // });
  const showConfirmationChips =
    shiftConfirmationEnabled &&
    day.shiftCount > 0 &&
    hasActionableConfirmationCounts(day.confirmationCounts);
  const showOpenSlots = day.openSlots > 0;
  const showFooterDivider = showConfirmationChips || showOpenSlots;
  const cardMinHeightRem = dayCardMinHeightRem(areaCount);

  return (
    <div
      role="group"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      style={{ minHeight: `${cardMinHeightRem}rem` }}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden text-left transition-colors",
        embeddedInWeekTray ? "min-w-0 h-auto" : "h-full min-h-0",
        embeddedInWeekTray
          ? D3_DAY_CARD_WEEK_TRAY_CLASS
          : cn(
              D3_ROUNDED,
              D3_DAY_CARD_FRAME_SHADOW_CLASS,
              D3_DAY_CARD_BORDER_CLASS
            ),
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      )}
    >
      <div
        className={cn(
          D3_DAY_CARD_HEADER_SLOT_CLASS,
          "relative",
          embeddedInWeekTray && "px-2.5 py-2 sm:px-3.5 sm:py-2.5"
        )}
      >
        {showStatusDot ? (
          <span
            className={cn(
              D3_DAY_CARD_STATUS_DOT_CLASS,
              dayCardStatusDotClass(day),
              "absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5"
            )}
            aria-hidden
          />
        ) : null}
        <div className={cn("min-w-0", showStatusDot && "pr-5")}>
          <p
            className={cn(
              "font-bold leading-none tracking-tight",
              embeddedInWeekTray ? "text-base sm:text-lg xl:text-xl" : "text-xl",
              isPastDay ? "text-foreground/80" : "text-foreground"
            )}
          >
            {weekdayShort}
          </p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <p
              className={cn(
                "min-w-0 truncate text-sm leading-none",
                isPastDay ? "text-foreground/65" : "text-foreground/80"
              )}
            >
              {dateLabel}
            </p>
            {day.isToday ? (
              <span className="shrink-0 text-xs font-medium leading-none text-foreground/75">
                {t("dashboard.areaScopeToday")}
              </span>
            ) : null}
          </div>
          <div className={D3_DAY_CARD_HOLIDAY_SLOT_CLASS}>
            {holidayName ? (
              <div className={D3_DAY_CARD_HOLIDAY_LABEL_CLASS}>{holidayName}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-colors",
          "min-w-0",
          embeddedInWeekTray
            ? "px-2.5 pb-3 pt-3 sm:px-3.5 sm:pb-4 sm:pt-4"
            : "px-3.5 pb-4 pt-4",
          isPastDay
            ? D3_DAY_CARD_BODY_PAST_SURFACE_CLASS
            : cn("bg-white", D3_DAY_CARD_BODY_HOVER_SURFACE_CLASS)
        )}
      >
        <div className="min-h-0 flex-1">
          {!day.hasServiceHours ? (
            <p className="text-[11px] font-medium leading-snug text-foreground/70">
              Keine Servicezeiten
            </p>
          ) : day.shiftCount === 0 ? (
            <p className="text-[11px] leading-snug text-muted/80">
              Keine Schichten
            </p>
          ) : (
            <div className="flex flex-col items-start gap-y-2">
              {day.areas.map((area) =>
                onAreaClick ? (
                  <button
                    key={area.areaId}
                    type="button"
                    className={D3_DAY_CARD_AREA_ROW_BUTTON_CLASS}
                    aria-label={t("dashboard.dayCardOpenAreaAriaLabel", {
                      area: area.areaName,
                    })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAreaClick(area.areaId);
                    }}
                  >
                    <div className="flex h-5 w-6 shrink-0 items-center justify-center">
                      {area.hasServiceHours ? (
                        <DayCardAreaAmpelIcon level={area.ampelLevel} muted={false} />
                      ) : (
                        <span className={D3_STAFFING_STROKE_ICON_CLASS} aria-hidden />
                      )}
                    </div>
                    <span className="min-h-5 min-w-0 truncate text-[11px] leading-5 text-foreground/75">
                      {area.areaName}
                    </span>
                  </button>
                ) : (
                  <div key={area.areaId} className={D3_DAY_CARD_AREA_ROW_STATIC_CLASS}>
                    <div className="flex h-5 w-6 shrink-0 items-center justify-center">
                      {area.hasServiceHours ? (
                        <DayCardAreaAmpelIcon level={area.ampelLevel} muted={false} />
                      ) : (
                        <span className={D3_STAFFING_STROKE_ICON_CLASS} aria-hidden />
                      )}
                    </div>
                    <span className="min-h-5 min-w-0 truncate text-[11px] leading-5 text-foreground/75">
                      {area.areaName}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
        {showFooterDivider ? (
          <div className="mt-3 shrink-0 space-y-2 border-t border-black/[0.08] pt-3">
            {showConfirmationChips ? (
              <DayCardConfirmationChips counts={day.confirmationCounts} t={t} />
            ) : null}

            {showOpenSlots ? (
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[13px] font-bold tabular-nums leading-none text-red-600/90">
                  {day.openSlots}
                </span>
                <span className="text-[11px] font-medium leading-snug text-foreground/70">
                  offen
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Ampel legend ───────────────────────────────────────────────────────────

function AmpelLegend() {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-auto -mx-4 shrink-0 border-t border-border bg-background px-4 py-3 md:-mx-6 md:px-6"
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Legende:
        </span>
        {(
          [
            { level: "met" as DashboardAreaAmpelLevel, label: "Vollbesetzt" },
            { level: "partial" as DashboardAreaAmpelLevel, label: "Teilweise" },
            { level: "critical" as DashboardAreaAmpelLevel, label: "Kritisch" },
            { level: "no_demand" as DashboardAreaAmpelLevel, label: "Kein Bedarf" },
          ] as const
        ).map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1.5">
            {ampelDot(level)}
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  snapshot: DashboardExtPanelSnapshot;
  calendarShifts: readonly PlanningShift[];
  weeklyHoursShifts?: readonly PlanningShift[];
  locations?: readonly { id: string; name: string }[];
  weekStart: string;
  selectedLocationId: string | null;
  planningAreas: LocationArea[];
  employees: Profile[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  showLocationInUi?: boolean;
};

export function DashboardOverviewView({
  snapshot,
  calendarShifts,
  weeklyHoursShifts,
  locations = [],
  weekStart,
  selectedLocationId,
  planningAreas,
  employees,
  serviceHours,
  staffingRules,
  staffingOverrides,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds,
  showLocationInUi = true,
}: Props) {
  useClearMainNavPendingWhenReady(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const features = useOrgFeatures();
  const organization = useOrganization();
  const simplePlanning = !features.areas;
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const activeWeekStart = planningWeekStartFromParam(
    searchParams.get("week") ?? weekStart
  );
  const planningWeekDates = useMemo(
    () => weekDates(activeWeekStart),
    [activeWeekStart]
  );
  const todayISO = useMemo(
    () => organizationTodayISO(organization.timezone),
    [organization.timezone]
  );
  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(parseISODate(todayISO))),
    [todayISO]
  );
  const isCurrentWeek = activeWeekStart === currentWeekStart;
  const weekTrayHeader = useMemo(
    () => getAreaCalendarWeekHeaderParts(activeWeekStart, intlLocale),
    [activeWeekStart, intlLocale]
  );
  const holidayNames = useMemo(
    () =>
      buildHolidayNamesByDate(
        planningWeekDates,
        locale === "en" ? "en" : "de"
      ),
    [planningWeekDates, locale]
  );
  const drilldownFromUrl = useMemo(
    () =>
      readDashboardOverviewDrilldownFromSearchParams(
        searchParams,
        planningWeekDates
      ),
    [searchParams, planningWeekDates]
  );
  const view = useMemo(
    () =>
      resolveDashboardOverviewViewFromSearchParams(
        searchParams,
        planningWeekDates
      ),
    [searchParams, planningWeekDates]
  );
  const dayDrilldownFocusedAreaId = useMemo(() => {
    if (view.level !== "day" || !drilldownFromUrl.focusAreaId) {
      return null;
    }
    return planningAreas.some((area) => area.id === drilldownFromUrl.focusAreaId)
      ? drilldownFromUrl.focusAreaId
      : null;
  }, [view.level, drilldownFromUrl.focusAreaId, planningAreas]);
  const [areaDetailScopeByAreaId, setAreaDetailScopeByAreaId] = useState<
    Record<string, AreaDetailScope>
  >({});
  const [detailDayISO, setDetailDayISO] = useState<string | null>(null);
  const [assignmentOverviewAreaId, setAssignmentOverviewAreaId] = useState<
    string | null
  >(null);
  const [areaMetricsDetailsOpenByAreaId, setAreaMetricsDetailsOpenByAreaId] =
    useState<Record<string, boolean>>({});
  const currentWeekDrilldownSnapshotRef =
    useRef<CurrentWeekDrilldownSnapshot | null>(null);
  const previousWeekStartRef = useRef(activeWeekStart);
  const weekOverviewButtonRef = useRef<HTMLButtonElement>(null);
  const [weekOverviewButtonWidth, setWeekOverviewButtonWidth] = useState<
    number | null
  >(null);

  useLayoutEffect(() => {
    if (view.level !== "day") {
      setWeekOverviewButtonWidth(null);
      return;
    }

    const node = weekOverviewButtonRef.current;
    if (!node) {
      setWeekOverviewButtonWidth(null);
      return;
    }

    const updateWidth = () => {
      setWeekOverviewButtonWidth(Math.ceil(node.getBoundingClientRect().width));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [view.level, locale]);

  const currentWeekTodayDayIndex = useMemo(
    () => planningWeekDates.findIndex((dateISO) => dateISO === todayISO),
    [planningWeekDates, todayISO]
  );

  const navigateDrilldown = useCallback(
    (
      next: DashboardOverviewDrilldownUrlState,
      options?: { replace?: boolean }
    ) => {
      const href = buildDashboardOverviewDrilldownHref(
        pathname,
        new URLSearchParams(searchParams.toString()),
        next
      );
      if (options?.replace) {
        router.replace(href);
        return;
      }
      router.push(href);
    },
    [pathname, router, searchParams]
  );

  const openDayDrilldown = useCallback(
    (dayIndex: number, focusAreaId: string | null = null) => {
      const dayISO = planningWeekDates[dayIndex];
      if (!dayISO) return;
      setDetailDayISO(dayISO);
      if (focusAreaId) {
        setAreaDetailScopeByAreaId((previous) => ({
          ...previous,
          [focusAreaId]: "day",
        }));
      } else {
        setAreaDetailScopeByAreaId({});
      }
      navigateDrilldown({ dayISO, focusAreaId });
    },
    [navigateDrilldown, planningWeekDates]
  );

  const closeDayDrilldown = useCallback(() => {
    navigateDrilldown({ dayISO: null, focusAreaId: null }, { replace: true });
  }, [navigateDrilldown]);

  const setDrilldownAreaFocus = useCallback(
    (areaId: string | null) => {
      if (!drilldownFromUrl.dayISO) return;
      const focusAreaId =
        areaId && planningAreas.some((area) => area.id === areaId)
          ? areaId
          : null;
      navigateDrilldown(
        { dayISO: drilldownFromUrl.dayISO, focusAreaId },
        { replace: true }
      );
    },
    [drilldownFromUrl.dayISO, navigateDrilldown, planningAreas]
  );

  const drilldownAreaOptions = useMemo(
    () =>
      planningAreas.map((area) => ({
        id: area.id,
        name: area.name,
      })),
    [planningAreas]
  );

  useEffect(() => {
    if (snapshot.weekStart !== activeWeekStart) {
      router.refresh();
    }
  }, [activeWeekStart, router, snapshot.weekStart]);

  useEffect(() => {
    const previousWeekStart = previousWeekStartRef.current;
    const transition = planDashboardDrilldownWeekTransition({
      previousWeekStart,
      nextWeekStart: activeWeekStart,
      currentWeekStart,
      view,
      areaDetailScopeByAreaId,
      savedSnapshot: currentWeekDrilldownSnapshotRef.current,
      currentWeekTodayDayIndex:
        currentWeekTodayDayIndex >= 0 ? currentWeekTodayDayIndex : null,
    });

    previousWeekStartRef.current = activeWeekStart;

    if (!transition) {
      return;
    }

    currentWeekDrilldownSnapshotRef.current = transition.savedSnapshot;

    if (transition.restoreAreaScopes) {
      setAreaDetailScopeByAreaId(transition.restoreAreaScopes);
    }

    if (transition.nextDayIndex !== undefined) {
      const nextDayISO = planningWeekDates[transition.nextDayIndex];
      if (view.level !== "week" && nextDayISO) {
        navigateDrilldown(
          { dayISO: nextDayISO, focusAreaId: null },
          { replace: true }
        );
      }
    }
  }, [
    activeWeekStart,
    currentWeekStart,
    view,
    areaDetailScopeByAreaId,
    currentWeekTodayDayIndex,
    navigateDrilldown,
    planningWeekDates,
  ]);

  const getAreaDetailScope = useCallback(
    (areaId: string): AreaDetailScope => areaDetailScopeByAreaId[areaId] ?? "day",
    [areaDetailScopeByAreaId]
  );

  const setAreaDetailScopeForArea = useCallback(
    (areaId: string, scope: AreaDetailScope) => {
      setAreaDetailScopeByAreaId((previous) => ({ ...previous, [areaId]: scope }));
    },
    []
  );

  const setAreaMetricsDetailsOpen = useCallback((areaId: string, open: boolean) => {
    setAreaMetricsDetailsOpenByAreaId((previous) => ({
      ...previous,
      [areaId]: open,
    }));
  }, []);

  const compensationShiftRefs = useMemo(
    () =>
      calendarShifts.map((shift) => ({
        employeeId: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        area_shift_template_id: shift.area_shift_template_id,
        location_area_id: shift.location_area_id,
      })),
    [calendarShifts]
  );
  const shiftCompensation = useLazyShiftCompensation(compensationShiftRefs);

  const tagAreaFooterStatsOptions = useMemo(
    () => ({
      breaksByTemplateId: buildBreaksByTemplateIdFromAreaTemplates(areaShiftTemplates),
      areaShiftTemplates,
    }),
    [areaShiftTemplates]
  );

  const profileQualificationIdsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [profileId, ids] of Object.entries(profileQualificationIds)) {
      map.set(profileId, new Set(ids));
    }
    return map;
  }, [profileQualificationIds]);

  const employeeNameById = useMemo(
    () => new Map(employees.map((profile) => [profile.id, profile.full_name] as const)),
    [employees]
  );

  const formatStaffingTimeLabel = useCallback(
    (weekdayLabel: string, startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingPeriodLabel", {
        weekday: weekdayLabel,
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const formatCalendarStaffingTimeLabel = useCallback(
    (startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingCalendarTooltipTimeLabel", {
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const staffingWeekdayLabel = useCallback(
    (weekdayIndex: number) => weekdayLabelFromIndex(weekdayIndex, t),
    [t]
  );

  const formatCriticalWindowLabel = useCallback(
    (dateISO: string, entry: { calendarTimeLabel?: string; label: string }) => {
      const dayHeader = formatDayHeader(dateISO, intlLocale, "short");
      const time = entry.calendarTimeLabel ?? entry.label;
      return `${dayHeader.weekday} ${time}`;
    },
    [intlLocale]
  );

  const formatWeekdayLabel = useCallback(
    (dateISO: string) => formatDayHeader(dateISO, intlLocale, "short").weekday,
    [intlLocale]
  );

  const buildAreaHref = useCallback(
    (pathname: "/bereich-kalender" | "/mitarbeiter-kalender", areaId: string) => {
      const params = new URLSearchParams();
      params.set("week", activeWeekStart);
      if (selectedLocationId) params.set("location", selectedLocationId);
      params.set("area", areaId);
      return buildPlanningPageUrl(pathname, params);
    },
    [activeWeekStart, selectedLocationId]
  );

  const compensationRollup = useMemo(
    () =>
      computeLocationCompensationRollup(
        snapshot.dates,
        compensationShiftRefs,
        shiftCompensation,
        undefined,
        tagAreaFooterStatsOptions
      ),
    [snapshot.dates, compensationShiftRefs, shiftCompensation, tagAreaFooterStatsOptions]
  );

  const rollup = useMemo(
    () => ({
      ...snapshot.rollup,
      totalHours: compensationRollup.totalHours,
      baseCost: compensationRollup.baseCost,
      surchargeCost: compensationRollup.surchargeCost,
      totalCost: compensationRollup.totalCost,
      hasCompensation: compensationRollup.hasCompensation,
      currency: compensationRollup.currency,
    }),
    [snapshot.rollup, compensationRollup]
  );

  const { days } = snapshot;

  const coveragePct =
    rollup.requiredTotal > 0
      ? Math.round((rollup.assignedTotal / rollup.requiredTotal) * 100)
      : null;

  const todayDay = days.find((d) => d.isToday);

  const drilldownDayIndex = resolveDashboardDrilldownDayIndex(
    view.level,
    view.level !== "week" ? view.dayIndex : 0
  );

  const drilldownDateISO =
    drilldownDayIndex !== null
      ? planningWeekDates[drilldownDayIndex] ?? null
      : null;

  useEffect(() => {
    if (drilldownDateISO) {
      setDetailDayISO(drilldownDateISO);
    }
  }, [drilldownDateISO]);

  const resolveAreaCardScopeDateISO = useCallback(
    (areaScope: AreaDetailScope) => {
      const dayISO = detailDayISO ?? drilldownDateISO ?? activeWeekStart;
      if (!drilldownDateISO) return activeWeekStart;
      return resolveDashboardAreaCardScopeDateISO(areaScope, {
        drilldownDayISO: dayISO,
        weekStartISO: activeWeekStart,
      });
    },
    [activeWeekStart, detailDayISO, drilldownDateISO]
  );

  const resolveStatsDatesForArea = useCallback(
    (areaId: string) => {
      const scope = areaDetailScopeByAreaId[areaId] ?? "day";
      const dayISO = detailDayISO ?? drilldownDateISO ?? activeWeekStart;
      return resolveDashboardAreaStatsDates(scope, {
        drilldownDayISO: dayISO,
        weekDates: planningWeekDates,
      });
    },
    [areaDetailScopeByAreaId, activeWeekStart, detailDayISO, drilldownDateISO, planningWeekDates]
  );

  const dayAreaStats = useMemo(() => {
    if (!drilldownDateISO) return [];

    return sortDashboardAreaWeekStats(
      planningAreas.map((area) => {
        const statsDates = resolveStatsDatesForArea(area.id);

        return computeDashboardAreaWeekStats({
          area,
          dates: statsDates,
          shifts: calendarShifts,
          staffingRules,
          staffingOverrides,
          serviceHours,
          areaShiftTemplates,
          qualifications,
          profileQualificationIds: profileQualificationIdsMap,
          employeeNameById,
          compensationByKey: shiftCompensation,
          staffingEnabled: snapshot.staffingEnabled,
          formatTimeLabel: formatStaffingTimeLabel,
          weekdayLabel: staffingWeekdayLabel,
          formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
          formatCriticalWindowLabel,
          formatWeekdayLabel,
        });
      })
    );
  }, [
    drilldownDateISO,
    resolveStatsDatesForArea,
    planningAreas,
    calendarShifts,
    staffingRules,
    staffingOverrides,
    serviceHours,
    areaShiftTemplates,
    qualifications,
    profileQualificationIdsMap,
    employeeNameById,
    shiftCompensation,
    snapshot.staffingEnabled,
    formatStaffingTimeLabel,
    staffingWeekdayLabel,
    formatCalendarStaffingTimeLabel,
    formatCriticalWindowLabel,
    formatWeekdayLabel,
  ]);

  const visibleDayAreaStats = useMemo(() => {
    if (!dayDrilldownFocusedAreaId) {
      return dayAreaStats;
    }
    return dayAreaStats.filter(
      (stats) => stats.areaId === dayDrilldownFocusedAreaId
    );
  }, [dayAreaStats, dayDrilldownFocusedAreaId]);

  const dayDrilldownDayOptions = useMemo(() => {
    const optionByDateISO = new Map<string, { value: string; label: string }>();
    for (const day of days) {
      if (day.shiftCount > 0) {
        optionByDateISO.set(day.dateISO, {
          value: day.dateISO,
          label: formatDashboardAreaScopeDayLabel(day.dateISO, intlLocale),
        });
      }
    }
    const activeDayISO = detailDayISO ?? drilldownDateISO;
    if (activeDayISO && !optionByDateISO.has(activeDayISO)) {
      optionByDateISO.set(activeDayISO, {
        value: activeDayISO,
        label: formatDashboardAreaScopeDayLabel(activeDayISO, intlLocale),
      });
    }
    return planningWeekDates
      .filter((dateISO) => optionByDateISO.has(dateISO))
      .map((dateISO) => optionByDateISO.get(dateISO)!);
  }, [days, detailDayISO, drilldownDateISO, intlLocale, planningWeekDates]);

  const dayComboboxValue = useMemo(() => {
    if (
      dayDrilldownFocusedAreaId &&
      (areaDetailScopeByAreaId[dayDrilldownFocusedAreaId] ?? "day") === "week"
    ) {
      return DASHBOARD_DAY_DRILLDOWN_WEEK_VALUE;
    }
    return detailDayISO ?? drilldownDateISO ?? "";
  }, [
    areaDetailScopeByAreaId,
    dayDrilldownFocusedAreaId,
    detailDayISO,
    drilldownDateISO,
  ]);

  const dayComboboxValueLabel = useMemo(() => {
    if (dayComboboxValue === DASHBOARD_DAY_DRILLDOWN_WEEK_VALUE) {
      return null;
    }
    return (
      dayDrilldownDayOptions.find((option) => option.value === dayComboboxValue)
        ?.label ??
      (dayComboboxValue
        ? formatDashboardAreaScopeDayLabel(dayComboboxValue, intlLocale)
        : null)
    );
  }, [dayComboboxValue, dayDrilldownDayOptions, intlLocale]);

  const handleDayDrilldownDayChange = useCallback(
    (value: string) => {
      if (value === DASHBOARD_DAY_DRILLDOWN_WEEK_VALUE) {
        if (dayDrilldownFocusedAreaId) {
          setAreaDetailScopeForArea(dayDrilldownFocusedAreaId, "week");
        }
        return;
      }
      setDetailDayISO(value);
      if (
        dayDrilldownFocusedAreaId &&
        (areaDetailScopeByAreaId[dayDrilldownFocusedAreaId] ?? "day") === "week"
      ) {
        setAreaDetailScopeForArea(dayDrilldownFocusedAreaId, "day");
      }
    },
    [areaDetailScopeByAreaId, dayDrilldownFocusedAreaId, setAreaDetailScopeForArea]
  );

  const buildCandidatesPlanning = useCallback(
    (
      areaId: string
    ):
      | Omit<
          DashboardStaffingCandidatesPlanningContext,
          "areaId" | "areaName" | "areaCalendarHref"
        >
      | null => {
      if (!selectedLocationId || !snapshot.staffingEnabled || !drilldownDateISO) {
        return null;
      }

      return {
        weekStart: activeWeekStart,
        dates: resolveStatsDatesForArea(areaId),
        weeklyHoursShifts,
        locations,
        planningAreas,
        locationId: selectedLocationId,
        simplePlanning,
        calendarShifts,
        staffingRules,
        staffingOverrides,
        serviceHours,
        areaShiftTemplates,
        qualifications,
        profileQualificationIds: profileQualificationIdsMap,
        employeeNameById,
        readOnlyWeek: snapshot.readOnlyWeek,
        formatTimeLabel: formatStaffingTimeLabel,
        weekdayLabel: staffingWeekdayLabel,
        formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
      };
    },
    [
      selectedLocationId,
      snapshot.staffingEnabled,
      snapshot.readOnlyWeek,
      drilldownDateISO,
      resolveStatsDatesForArea,
      activeWeekStart,
      weeklyHoursShifts,
      locations,
      planningAreas,
      simplePlanning,
      calendarShifts,
      staffingRules,
      staffingOverrides,
      serviceHours,
      areaShiftTemplates,
      qualifications,
      profileQualificationIdsMap,
      employeeNameById,
      formatStaffingTimeLabel,
      staffingWeekdayLabel,
      formatCalendarStaffingTimeLabel,
    ]
  );

  const buildWindowIssuesContext = useCallback(
    (
      _areaId: string
    ):
      | Omit<
          DashboardStaffingWindowIssuesContext,
          "areaId" | "areaName" | "areaCalendarHref"
        >
      | null => {
      if (!selectedLocationId || !shiftConfirmationEnabled || !drilldownDateISO) {
        return null;
      }

      return {
        weekStart: activeWeekStart,
        locationId: selectedLocationId,
        calendarShifts,
        serviceHours,
        employeeNameById,
        shiftConfirmationEnabled,
        readOnlyWeek: snapshot.readOnlyWeek,
        todayISO,
      };
    },
    [
      selectedLocationId,
      shiftConfirmationEnabled,
      drilldownDateISO,
      activeWeekStart,
      calendarShifts,
      serviceHours,
      employeeNameById,
      snapshot.readOnlyWeek,
      todayISO,
    ]
  );

  const resolveAreaScopeDayToggleLabel = useCallback(
    (dateISO: string | null) => {
      if (!dateISO) {
        return t("dashboard.areaScopeToday");
      }
      if (isCurrentWeek) {
        if (dateISO === todayISO) {
          return t("dashboard.areaScopeToday");
        }
        const localeKey = isEnglishIntlLocale(intlLocale) ? "en" : "de";
        return dayCardWeekdayTwoLetter(
          weekdayIndexFromDate(dateISO),
          localeKey
        );
      }
      return formatDashboardAreaScopeDayLabel(dateISO, intlLocale);
    },
    [intlLocale, isCurrentWeek, t, todayISO]
  );

  const areaScopeDayToggleLabel = useMemo(
    () => resolveAreaScopeDayToggleLabel(detailDayISO ?? drilldownDateISO),
    [detailDayISO, drilldownDateISO, resolveAreaScopeDayToggleLabel]
  );

  const areaScopeWeekLabel = useMemo(() => {
    if (isCurrentWeek) {
      return t("dashboard.areaScopeWeek");
    }
    const weekHeader = getAreaCalendarWeekHeaderParts(activeWeekStart, intlLocale);
    return formatDashboardAreaScopeWeekLabel(
      activeWeekStart,
      intlLocale,
      weekHeader.calendarWeek
    );
  }, [activeWeekStart, intlLocale, isCurrentWeek, t]);

  const areaScopeWeekShortLabel = useMemo(() => {
    if (isCurrentWeek) {
      return t("dashboard.areaScopeWeek");
    }
    const weekHeader = getAreaCalendarWeekHeaderParts(activeWeekStart, intlLocale);
    return `KW ${weekHeader.calendarWeek}`;
  }, [activeWeekStart, intlLocale, isCurrentWeek, t]);

  const buildAssignmentOverviewContext = useCallback(
    (
      areaId: string,
      areaName: string,
      areaCalendarHref: string
    ): DashboardAreaAssignmentOverviewContext | null => {
      if (!selectedLocationId || !snapshot.staffingEnabled || !drilldownDateISO) {
        return null;
      }

      const scope = areaDetailScopeByAreaId[areaId] ?? "day";
      const dayISO = detailDayISO ?? drilldownDateISO;
      if (!dayISO) return null;
      const statsDates = resolveDashboardAreaStatsDates(scope, {
        drilldownDayISO: dayISO,
        weekDates: planningWeekDates,
      });

      const candidatesBase = buildCandidatesPlanning(areaId);
      if (!candidatesBase) return null;

      return {
        ...candidatesBase,
        areaId,
        areaName,
        areaCalendarHref,
        dates: statsDates,
        shiftConfirmationEnabled,
        todayISO,
      };
    },
    [
      selectedLocationId,
      snapshot.staffingEnabled,
      drilldownDateISO,
      detailDayISO,
      areaDetailScopeByAreaId,
      planningWeekDates,
      buildCandidatesPlanning,
      shiftConfirmationEnabled,
      todayISO,
    ]
  );

  const assignmentOverviewStats = useMemo(
    () =>
      assignmentOverviewAreaId
        ? dayAreaStats.find((stats) => stats.areaId === assignmentOverviewAreaId) ??
          null
        : null,
    [assignmentOverviewAreaId, dayAreaStats]
  );

  const assignmentOverviewContext = useMemo(() => {
    if (!assignmentOverviewStats) return null;
    return buildAssignmentOverviewContext(
      assignmentOverviewStats.areaId,
      assignmentOverviewStats.areaName,
      buildAreaHref("/bereich-kalender", assignmentOverviewStats.areaId)
    );
  }, [assignmentOverviewStats, buildAssignmentOverviewContext, buildAreaHref]);

  const assignmentOverviewScopeLabel = useMemo(() => {
    if (!assignmentOverviewAreaId) return "";
    const scope = areaDetailScopeByAreaId[assignmentOverviewAreaId] ?? "day";
    return resolveDashboardAreaCardScopeDateLabel(
      scope,
      resolveAreaCardScopeDateISO(scope),
      activeWeekStart,
      intlLocale
    );
  }, [
    areaDetailScopeByAreaId,
    assignmentOverviewAreaId,
    intlLocale,
    resolveAreaCardScopeDateISO,
    activeWeekStart,
  ]);

  const assignmentOverviewShowDayHeaders = useMemo(() => {
    if (!assignmentOverviewAreaId) return false;
    return (areaDetailScopeByAreaId[assignmentOverviewAreaId] ?? "day") === "week";
  }, [areaDetailScopeByAreaId, assignmentOverviewAreaId]);

  const selectedLocationName = useMemo(
    () =>
      locations.find((location) => location.id === selectedLocationId)?.name ??
      null,
    [locations, selectedLocationId]
  );

  const renderDayDrilldownAreaSlot = (stats: DashboardAreaWeekStats) => (
    <div key={`${stats.areaId}-${activeWeekStart}-${detailDayISO ?? drilldownDateISO ?? ""}`} className="flex min-w-0 max-w-full flex-col gap-2">
      <div className="flex min-w-0 max-w-full justify-end">
        <D3AreaScopeToggle
          scope={getAreaDetailScope(stats.areaId)}
          dayLabel={areaScopeDayToggleLabel}
          weekLabel={areaScopeWeekLabel}
          weekShortLabel={areaScopeWeekShortLabel}
          onScopeChange={(scope) =>
            setAreaDetailScopeForArea(stats.areaId, scope)
          }
        />
      </div>
      <div className="min-w-0 max-w-full">
      <DashboardAreaAmpelCard
        stats={stats}
        staffingEnabled={snapshot.staffingEnabled}
        areaCalendarHref={buildAreaHref("/bereich-kalender", stats.areaId)}
        employeeCalendarHref={buildAreaHref(
          "/mitarbeiter-kalender",
          stats.areaId
        )}
        candidatesPlanning={buildCandidatesPlanning(stats.areaId)}
        showCalendarFooterLinks={false}
        isPastScope={resolveAreaCardPastScope(
          getAreaDetailScope(stats.areaId),
          resolveAreaCardScopeDateISO(getAreaDetailScope(stats.areaId)),
          activeWeekStart,
          todayISO
        )}
        staffingScopeDateLabel={resolveDashboardAreaCardScopeDateLabel(
          getAreaDetailScope(stats.areaId),
          resolveAreaCardScopeDateISO(getAreaDetailScope(stats.areaId)),
          activeWeekStart,
          intlLocale
        )}
        staffingScopeMode={getAreaDetailScope(stats.areaId)}
        staffingScopeHolidayName={
          getAreaDetailScope(stats.areaId) === "day"
            ? holidayNames[resolveAreaCardScopeDateISO("day")] ?? null
            : null
        }
        showStaffingWeekCaption={false}
        todayISO={todayISO}
        shiftConfirmationEnabled={shiftConfirmationEnabled}
        windowIssuesContext={buildWindowIssuesContext(stats.areaId)}
        showMetricsDetails={areaMetricsDetailsOpenByAreaId[stats.areaId] ?? false}
        onShowMetricsDetailsChange={(open) =>
          setAreaMetricsDetailsOpen(stats.areaId, open)
        }
        onOpenAssignmentOverview={
          snapshot.staffingEnabled
            ? () => setAssignmentOverviewAreaId(stats.areaId)
            : undefined
        }
      />
      </div>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden px-4 pb-0 md:px-6",
          APP_SHELL_CONTENT_OFFSET_CLASS
        )}
      >
        <div className="min-w-0 max-w-full shrink-0 bg-background max-md:sticky max-md:top-0 max-md:z-20">
          <DashboardLocationStatusBar
            weekStart={snapshot.weekStart}
            locationId={snapshot.locationId}
            backButtonRef={weekOverviewButtonRef}
            backAction={
              view.level === "day"
                ? {
                    label: t("dashboard.backToWeekView"),
                    onClick: closeDayDrilldown,
                  }
                : null
            }
          />
          <div className="mt-5 border-b border-black/20" aria-hidden />
        </div>

        <div
          className={cn(
            "flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-clip overflow-y-auto pt-3",
            view.level !== "week" && MODAL_SCROLLBAR_CLASS
          )}
        >
      {/* ── WEEK VIEW ────────────────────────────────────────────── */}
      {view.level === "week" && (
        <div className="flex min-w-0 max-w-full flex-col gap-5 pb-0">
          {/* Day cards */}
          {days.length === 0 ? (
            <div className={cn(D3_WEEK_TRAY_CLASS, "px-6 py-10 text-center text-sm text-muted")}>
              Keine Schichten in dieser Woche
            </div>
          ) : (
            <div className={D3_WEEK_TRAY_CLASS}>
              <div className={D3_WEEK_TRAY_HEADER_CLASS}>
                <p className="text-base font-semibold tabular-nums text-black">
                  {t("dashboard.headerCalendarWeek", {
                    week: String(weekTrayHeader.calendarWeek),
                  })}
                </p>
                {isCurrentWeek ? (
                  <div className="mt-0.5 flex flex-col items-center gap-0.5 min-[420px]:grid min-[420px]:w-full min-[420px]:grid-cols-[1fr_auto_1fr] min-[420px]:items-baseline min-[420px]:gap-x-2">
                    <span
                      className="hidden min-[420px]:invisible min-[420px]:justify-self-end min-[420px]:text-[10px] min-[420px]:leading-none"
                      aria-hidden
                    >
                      {t("common.currentWeekHint")}
                    </span>
                    <span className="text-xs font-medium leading-snug text-black">
                      {weekTrayHeader.rangeLabel}
                    </span>
                    <span className="text-[10px] leading-none text-black min-[420px]:justify-self-start">
                      {t("common.currentWeekHint")}
                    </span>
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs font-medium leading-snug text-black">
                    {weekTrayHeader.rangeLabel}
                  </p>
                )}
              </div>
              <div className={D3_WEEK_TRAY_BODY_CLASS}>
                <div
                  className={D3_DAY_CARDS_WEEK_TRAY_GRID_CLASS}
                  aria-describedby="dashboard-week-tray-day-card-hint"
                >
                  {days.map((day, i) => (
                    <DayCard
                      key={day.dateISO}
                      day={day}
                      areaCount={planningAreas.length}
                      staffingEnabled={snapshot.staffingEnabled}
                      shiftConfirmationEnabled={shiftConfirmationEnabled}
                      embeddedInWeekTray
                      holidayName={holidayNames[day.dateISO] ?? null}
                      onClick={() => {
                        openDayDrilldown(i, null);
                      }}
                      onAreaClick={(areaId) => {
                        openDayDrilldown(i, areaId);
                      }}
                    />
                  ))}
                </div>
                <p
                  id="dashboard-week-tray-day-card-hint"
                  className="mt-2 whitespace-nowrap text-center text-[10px] leading-none text-muted sm:text-[11px]"
                >
                  {t("dashboard.weekTrayDayCardHint")}
                </p>
              </div>
            </div>
          )}

          {/* Kennzahlen */}
          <div className="border-t border-black/15 pt-4">
            <D3WeekSummaryMetrics
              todayDay={todayDay}
              coveragePct={coveragePct}
              rollup={rollup}
            />
          </div>

          <AmpelLegend />
        </div>
      )}

      {/* ── DAY VIEW ─────────────────────────────────────────────── */}
      {view.level === "day" && drilldownDateISO && (
        <div
          key={`${activeWeekStart}-${drilldownDateISO}`}
          className="min-w-0 max-w-full pb-6"
        >
          {drilldownAreaOptions.length > 0 || dayDrilldownDayOptions.length > 0 ? (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {drilldownAreaOptions.length > 0 ? (
                <DashboardDayDrilldownAreaCombobox
                  areas={drilldownAreaOptions}
                  value={dayDrilldownFocusedAreaId}
                  onChange={setDrilldownAreaFocus}
                  referenceWidthPx={weekOverviewButtonWidth}
                />
              ) : null}
              {dayDrilldownDayOptions.length > 0 ? (
                <DashboardDayDrilldownDayCombobox
                  days={dayDrilldownDayOptions}
                  value={dayComboboxValue}
                  valueLabel={dayComboboxValueLabel}
                  onChange={handleDayDrilldownDayChange}
                  showWeekOption={Boolean(dayDrilldownFocusedAreaId)}
                  referenceWidthPx={weekOverviewButtonWidth}
                />
              ) : null}
            </div>
          ) : null}
          {visibleDayAreaStats.length === 0 ? (
            <div
              className={cn(
                D3_ROUNDED,
                D3_CARD_FRAME_CLASS,
                "border-dashed border-black/15 bg-surface px-6 py-10 text-center text-sm text-muted"
              )}
            >
              {t("dashboard.noAreas")}
            </div>
          ) : (
            <DashboardDayDrilldownAreasMasonry>
              {visibleDayAreaStats.map(renderDayDrilldownAreaSlot)}
            </DashboardDayDrilldownAreasMasonry>
          )}
        </div>
      )}
        </div>
      </div>

      {assignmentOverviewStats && assignmentOverviewContext ? (
        <DashboardAreaAssignmentOverviewModal
          rows={assignmentOverviewStats.staffingWindowRows}
          context={assignmentOverviewContext}
          scopeLabel={assignmentOverviewScopeLabel}
          showDayHeaders={assignmentOverviewShowDayHeaders}
          locationName={showLocationInUi ? selectedLocationName : null}
          locationCount={locations.length}
          onClose={() => setAssignmentOverviewAreaId(null)}
        />
      ) : null}
    </>
  );
}
