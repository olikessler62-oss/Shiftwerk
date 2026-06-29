"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { DashboardAreaAmpelCard } from "@/components/dashboard/dashboard-area-ampel-card";
import {
  DashboardAreaAssignmentOverviewModal,
  type DashboardAreaAssignmentOverviewContext,
} from "@/components/dashboard/dashboard-area-assignment-overview-modal";
import type { DashboardStaffingCandidatesPlanningContext } from "@/components/dashboard/dashboard-staffing-row-candidates-modal";
import type { DashboardStaffingWindowIssuesContext } from "@/lib/dashboard-staffing-window-issues";
import { cn } from "@/lib/cn";
import { parseISODate, startOfWeek, toISODate, isPastCalendarDate } from "@/lib/dates";
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
import { DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS } from "@/lib/dashboard-panel-styles";
import { dayCardMinHeightRem } from "@/lib/dashboard-day-card-layout";
import { useOrgFeatures, useOrganization } from "@/lib/org-features-provider";
import { buildPlanningPageUrl } from "@/lib/planning-week";
import { APP_SHELL_CONTENT_OFFSET_CLASS } from "@/lib/app-shell-layout";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-modal-shell";
import {
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS,
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS,
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_SHELL_CLASS,
  DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS,
  DASHBOARD_STATUS_BAR_COMPACT_HEIGHT_CLASS,
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
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { getAreaCalendarWeekHeaderParts } from "@/lib/planning-utils";
import { formatDurationHours } from "@/lib/shift-type-display";
import type {
  DashboardExtDaySnapshot,
  DashboardExtIssueSnapshot,
} from "@/lib/dashboard-ext-panel-data";
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

function ampelBg(level: DashboardAreaAmpelLevel): string {
  return {
    met: "bg-green-50",
    no_demand: "bg-gray-50",
    partial: "bg-yellow-50",
    critical: "bg-red-50",
    overstaffed_only: "bg-blue-50",
  }[level];
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
  | { level: "day"; dayIndex: number }
  | { level: "area"; dayIndex: number; areaId: string };

// ── Stat card ──────────────────────────────────────────────────────────────

/** Status-Karten unten — kräftiger dunkelgrauer Rahmen. */
const D3_STAT_CARD_FRAME_CLASS =
  "border border-gray-600 bg-transparent shadow-none";

/** Status-Panels — Kopf wie Tag-/Bereichskarten. */
const D3_STAT_PANEL_HEADER_CLASS = cn(
  DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS,
  "flex min-h-[2.5rem] shrink-0 items-center px-3 py-2"
);

const D3_STAT_PANEL_BODY_CLASS =
  "flex min-h-[4.25rem] flex-1 flex-col justify-center bg-white/80 px-3.5 py-3";

function D3StatPanelShell({
  label,
  bodyClassName,
  children,
}: {
  label: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        D3_ROUNDED,
        D3_STAT_CARD_FRAME_CLASS,
        "flex flex-col overflow-hidden"
      )}
    >
      <div className={D3_STAT_PANEL_HEADER_CLASS}>
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/85">
          {label}
        </p>
      </div>
      <div className={cn(D3_STAT_PANEL_BODY_CLASS, bodyClassName)}>{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: "green" | "red" | "yellow" | "gray" | "blue";
}) {
  const accentMap = {
    green: {
      border: "border-l-green-400/55",
      value: "text-green-700/80",
    },
    red: {
      border: "border-l-red-400/55",
      value: "text-red-700/80",
    },
    yellow: {
      border: "border-l-yellow-400/55",
      value: "text-[#784e00]/80",
    },
    gray: {
      border: "border-l-gray-300/80",
      value: "text-gray-600/75",
    },
    blue: {
      border: "border-l-blue-400/55",
      value: "text-blue-700/80",
    },
  };
  const { border: borderClass, value: valueClass } = accentMap[accent];
  return (
    <D3StatPanelShell label={label} bodyClassName={cn("border-l-2", borderClass)}>
      <p className={cn("text-lg font-semibold leading-none tabular-nums", valueClass)}>
        {value}
      </p>
      {sub ? (
        <p className="mt-1 truncate text-[11px] leading-snug text-black/65">{sub}</p>
      ) : null}
    </D3StatPanelShell>
  );
}

/** Entgelt / Zuschläge / Kosten — schwarze Typo, ohne Ampel-Farben. */
function D3CompensationStatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <D3StatPanelShell
      label={label}
      bodyClassName="border-l-2 border-l-black/15"
    >
      <p className="text-lg font-semibold leading-none tabular-nums text-black">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 truncate text-[11px] leading-snug text-black/65">{sub}</p>
      ) : null}
    </D3StatPanelShell>
  );
}

/** Entgelt / Zuschläge / Kosten — Wochen-Rollup wie Dashboard-KPI-Streifen. */
function D3CompensationPanels({ rollup }: { rollup: DashboardLocationWeekRollup }) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";
  const money = (amount: number) =>
    `${formatTagAreaFooterMoney(amount, intlLocale)} €`;
  const incomplete = t("dashboard.ampelCompensationIncomplete");

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <D3CompensationStatCard
        label={t("dashboard.ampelDetailBaseCompensation")}
        value={rollup.hasCompensation ? money(rollup.baseCost) : incomplete}
      />
      <D3CompensationStatCard
        label={t("dashboard.kpiSurcharges")}
        value={
          !rollup.hasCompensation
            ? incomplete
            : rollup.surchargeCost > 0
              ? `+${money(rollup.surchargeCost)}`
              : money(0)
        }
      />
      <D3CompensationStatCard
        label={t("dashboard.kpiTotalCost")}
        value={rollup.hasCompensation ? money(rollup.totalCost) : incomplete}
        sub={
          rollup.hasCompensation
            ? t("dashboard.ampelHours", {
                hours: formatDurationHours(rollup.totalHours),
              })
            : undefined
        }
      />
    </div>
  );
}

/** Status-Kopfzeile — etwas kräftigerer Rahmen als Content-Karten. */
const D3_STATUS_CARD_FRAME_CLASS =
  "border border-black/20 shadow-[0_1px_3px_0_rgba(15,23,42,0.08)]";

/** Tag-Karten + Statuszeile — gemeinsames Raster für Kalender-Button-Ausrichtung. */
const D3_DAY_CARDS_GRID_CLASS =
  "grid min-w-0 max-w-full auto-rows-fr grid-cols-1 items-stretch gap-2 min-[380px]:grid-cols-2 min-[380px]:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7";

/** Bereich-Karten im Tages-Drilldown — responsives Raster, volle Breite ohne Überlauf. */
const D3_DAY_DRILLDOWN_AREAS_GRID_CLASS =
  "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3";

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
  pageTitle,
  weekStart,
  locationId,
  backAction,
  titlePanelSurfaceClass = "bg-white",
}: {
  pageTitle: string;
  weekStart: string;
  locationId: string | null;
  backAction?: { label: string; onClick: () => void } | null;
  /** Kontext-Überschrift links — Drilldown: weiß. */
  titlePanelSurfaceClass?: string;
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
  const statusPanelFrameClass = cn(
    "rounded-none",
    D3_STATUS_CARD_FRAME_CLASS,
    DASHBOARD_STATUS_BAR_COMPACT_HEIGHT_CLASS,
    "flex items-center px-3 py-1 sm:px-3.5"
  );

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
      <div className="flex min-w-0 shrink-0 flex-row flex-nowrap items-stretch gap-2">
        <section
          className={cn(
            statusPanelFrameClass,
            titlePanelSurfaceClass,
            "w-fit shrink-0"
          )}
          aria-label={pageTitle}
        >
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {pageTitle}
          </span>
        </section>

        {backAction ? (
          <button
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
      </div>

      <div className="flex min-w-0 shrink-0 flex-row flex-nowrap items-stretch gap-2 sm:ml-auto">
        {calendarNavLinks}
      </div>
    </header>
  );
}

// ── Back button ────────────────────────────────────────────────────────────

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}

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
        {dayLabel}
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
        {weekButtonLabel}
      </button>
    </div>
  );
}

/** Tag-Karten — Schatten. */
const D3_DAY_CARD_FRAME_SHADOW_CLASS =
  "shadow-[0_2px_6px_-1px_rgba(15,23,42,0.1),0_1px_3px_0_rgba(15,23,42,0.06)]";

/** Tag-Karten — einheitlicher schwarzer 1px-Rahmen. */
const D3_DAY_CARD_BORDER_CLASS = "border border-black";

/** Datums- + Wochentagszeile — gleicher Kopf wie Drilldown-Bereichskarten. */
const D3_DAY_CARD_HEADER_SLOT_CLASS = cn(
  DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS,
  "flex min-h-[4.25rem] shrink-0 flex-col justify-center px-3.5 py-2.5"
);

/** Content unter dem Kopf — Hover-Hintergrund (via group-hover auf der Tag-Karte). */
const D3_DAY_CARD_BODY_HOVER_SURFACE_CLASS = "group-hover:bg-[#eff3f7]";

/** Vergangene Tage — helleres Grau im Content unter dem Kopf. */
const D3_DAY_CARD_BODY_PAST_SURFACE_CLASS = cn(
  "bg-[#e8ebf0]",
  D3_DAY_CARD_BODY_HOVER_SURFACE_CLASS
);

const D3_DAY_CARD_ACCENT_STRIPE_CLASS =
  "pointer-events-none absolute inset-y-0 left-0 z-10 w-1";

function dayCardShowsAccentStripe(
  day: DashboardExtDaySnapshot,
  staffingEnabled: boolean
): boolean {
  return staffingEnabled && day.hasServiceHours;
}

function dayCardAccentStripeClass(day: DashboardExtDaySnapshot): string {
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
  return {
    dayNumber: date.toLocaleDateString(intlLocale, { day: "numeric" }),
    weekdayShort: dayCardWeekdayTwoLetter(
      weekdayIndexFromDate(dateISO),
      localeKey
    ),
    monthLong: date.toLocaleDateString(intlLocale, { month: "long" }),
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
  onClick,
}: {
  day: DashboardExtDaySnapshot;
  areaCount: number;
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const { dayNumber, weekdayShort, monthLong } = dayCardEditorialDateParts(
    day.dateISO,
    intlLocale
  );
  const isPastDay = day.isPast && !day.isToday;
  const showConfirmationChips =
    shiftConfirmationEnabled &&
    day.shiftCount > 0 &&
    hasActionableConfirmationCounts(day.confirmationCounts);
  const showOpenSlots = day.openSlots > 0;
  const showFooterDivider = showConfirmationChips || showOpenSlots;
  const cardMinHeightRem = dayCardMinHeightRem(areaCount);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minHeight: `${cardMinHeightRem}rem` }}
      className={cn(
        `group relative flex h-full min-h-0 w-full cursor-pointer flex-col overflow-hidden ${D3_ROUNDED} text-left transition-colors`,
        D3_DAY_CARD_FRAME_SHADOW_CLASS,
        D3_DAY_CARD_BORDER_CLASS,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      )}
    >
      {dayCardShowsAccentStripe(day, staffingEnabled) ? (
        <span
          className={cn(D3_DAY_CARD_ACCENT_STRIPE_CLASS, dayCardAccentStripeClass(day))}
          aria-hidden
        />
      ) : null}
      <div className={D3_DAY_CARD_HEADER_SLOT_CLASS}>
        <div className="flex items-baseline gap-1.5">
          <p
            className={cn(
              "text-[1.625rem] leading-none tabular-nums tracking-tight",
              isPastDay ? "font-semibold text-foreground/85" : "font-bold text-foreground"
            )}
          >
            {dayNumber}
          </p>
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted">
            {" - "}
            {monthLong}
          </p>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <p
            className={cn(
              "text-sm font-semibold leading-none tracking-wide",
              isPastDay ? "text-foreground/75" : "text-foreground/85"
            )}
          >
            {weekdayShort}
          </p>
          {day.isToday ? (
            <p className="text-sm font-semibold leading-none text-foreground/85">
              {t("dashboard.areaScopeToday")}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-3.5 pb-4 pt-4 transition-colors",
          "min-w-0",
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
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
              {day.areas.map((area) => (
                <Fragment key={area.areaId}>
                  <div className="flex h-5 items-center justify-center">
                    {area.hasServiceHours ? (
                      <DayCardAreaAmpelIcon level={area.ampelLevel} muted={false} />
                    ) : (
                      <span className={D3_STAFFING_STROKE_ICON_CLASS} aria-hidden />
                    )}
                  </div>
                  <span className="min-h-5 min-w-0 truncate text-[11px] leading-5 text-foreground/75">
                    {area.areaName}
                  </span>
                </Fragment>
              ))}
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
    </button>
  );
}

// ── Issue row ──────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: DashboardExtIssueSnapshot }) {
  const kindLabel: Record<DashboardExtIssueSnapshot["kind"], string> = {
    understaffed_window: "Unterbesetzt",
    understaffed_qualification: "Qualifikation fehlt",
    overstaffed: "Überbesetzt",
    qualification_mismatch: "Qualifikation passt nicht",
    no_matching_qualification: "Keine passende Qualifikation",
  };

  const kindColor: Record<DashboardExtIssueSnapshot["kind"], string> = {
    understaffed_window: "bg-red-100 text-red-700",
    understaffed_qualification: "bg-orange-100 text-orange-700",
    overstaffed: "bg-blue-100 text-blue-700",
    qualification_mismatch: cn("bg-yellow-100", STAFFING_OCHER_TEXT_CLASS),
    no_matching_qualification: "bg-orange-100 text-orange-700",
  };

  return (
    <div className={cn("flex items-start gap-3 bg-white p-4", D3_ROUNDED, D3_CARD_FRAME_CLASS)}>
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-red-50", D3_ROUNDED)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-500" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(D3_ROUNDED, "px-2 py-0.5 text-xs font-semibold", kindColor[issue.kind])}>
            {kindLabel[issue.kind]}
          </span>
          <span className="text-xs text-muted">{issue.timeLabel}</span>
        </div>
        <p className="mt-1 text-sm font-medium">{issue.shiftName}</p>
        {issue.employeeName && (
          <p className="text-xs text-muted">{issue.employeeName}</p>
        )}
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
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const features = useOrgFeatures();
  const organization = useOrganization();
  const simplePlanning = !features.areas;
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const todayISO = useMemo(
    () => organizationTodayISO(organization.timezone),
    [organization.timezone]
  );
  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(parseISODate(todayISO))),
    [todayISO]
  );
  const isCurrentWeek = weekStart === currentWeekStart;
  const [view, setView] = useState<View>({ level: "week" });
  const [areaDetailScopeByAreaId, setAreaDetailScopeByAreaId] = useState<
    Record<string, AreaDetailScope>
  >({});
  const [assignmentOverviewAreaId, setAssignmentOverviewAreaId] = useState<
    string | null
  >(null);
  const currentWeekDrilldownSnapshotRef =
    useRef<CurrentWeekDrilldownSnapshot | null>(null);
  const previousWeekStartRef = useRef(weekStart);

  const currentWeekTodayDayIndex = useMemo(
    () => snapshot.dates.findIndex((dateISO) => dateISO === todayISO),
    [snapshot.dates, todayISO]
  );

  useEffect(() => {
    const previousWeekStart = previousWeekStartRef.current;
    const transition = planDashboardDrilldownWeekTransition({
      previousWeekStart,
      nextWeekStart: weekStart,
      currentWeekStart,
      view,
      areaDetailScopeByAreaId,
      savedSnapshot: currentWeekDrilldownSnapshotRef.current,
      currentWeekTodayDayIndex:
        currentWeekTodayDayIndex >= 0 ? currentWeekTodayDayIndex : null,
    });

    previousWeekStartRef.current = weekStart;

    if (!transition) {
      return;
    }

    currentWeekDrilldownSnapshotRef.current = transition.savedSnapshot;

    if (transition.restoreAreaScopes) {
      setAreaDetailScopeByAreaId(transition.restoreAreaScopes);
    }

    if (transition.nextDayIndex !== undefined) {
      setView((previous) =>
        previous.level !== "week"
          ? { ...previous, dayIndex: transition.nextDayIndex! }
          : previous
      );
    }
  }, [weekStart, currentWeekStart, view, areaDetailScopeByAreaId, currentWeekTodayDayIndex]);

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
      params.set("week", weekStart);
      if (selectedLocationId) params.set("location", selectedLocationId);
      params.set("area", areaId);
      return buildPlanningPageUrl(pathname, params);
    },
    [weekStart, selectedLocationId]
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

  const { days, areas, issues } = snapshot;

  const coveragePct =
    rollup.requiredTotal > 0
      ? Math.round((rollup.assignedTotal / rollup.requiredTotal) * 100)
      : null;

  const todayDay = days.find((d) => d.isToday);

  const drilldownDayIndex = resolveDashboardDrilldownDayIndex(
    view.level,
    view.level !== "week" ? view.dayIndex : 0
  );

  const currentDay =
    drilldownDayIndex !== null ? days[drilldownDayIndex] ?? null : null;

  const currentAreaId = view.level === "area" ? view.areaId : null;
  const currentAreaIssues = currentAreaId
    ? issues.filter(
        (i) =>
          i.areaId === currentAreaId &&
          (view.level === "area" && currentDay ? i.dateISO === currentDay.dateISO : true)
      )
    : [];
  const currentArea =
    currentAreaId ? areas.find((a) => a.areaId === currentAreaId) : null;
  const currentDayArea =
    view.level === "area" && currentDay && currentAreaId
      ? currentDay.areas.find((area) => area.areaId === currentAreaId) ?? null
      : null;

  const resolveAreaCardScopeDateISO = useCallback(
    (areaScope: AreaDetailScope) => {
      if (!currentDay) return weekStart;
      return resolveDashboardAreaCardScopeDateISO(areaScope, {
        drilldownDayISO: currentDay.dateISO,
        weekStartISO: weekStart,
      });
    },
    [currentDay, weekStart]
  );

  const resolveStatsDatesForArea = useCallback(
    (areaId: string) => {
      const scope = areaDetailScopeByAreaId[areaId] ?? "day";
      return resolveDashboardAreaStatsDates(scope, {
        drilldownDayISO: resolveAreaCardScopeDateISO("day"),
        weekDates: snapshot.dates,
      });
    },
    [areaDetailScopeByAreaId, resolveAreaCardScopeDateISO, snapshot.dates]
  );

  const dayAreaStats = useMemo(() => {
    if (!currentDay) return [];

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
    currentDay,
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

  const buildCandidatesPlanning = useCallback(
    (
      areaId: string
    ):
      | Omit<
          DashboardStaffingCandidatesPlanningContext,
          "areaId" | "areaName" | "areaCalendarHref"
        >
      | null => {
      if (!selectedLocationId || !snapshot.staffingEnabled || !currentDay) return null;

      return {
        weekStart,
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
      currentDay,
      resolveStatsDatesForArea,
      weekStart,
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
      if (!selectedLocationId || !shiftConfirmationEnabled || !currentDay) {
        return null;
      }

      return {
        weekStart,
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
      currentDay,
      weekStart,
      calendarShifts,
      serviceHours,
      employeeNameById,
      snapshot.readOnlyWeek,
      todayISO,
    ]
  );

  const areaScopeDayLabel = useMemo(() => {
    if (!currentDay) {
      return t("dashboard.areaScopeToday");
    }
    if (isCurrentWeek) {
      if (currentDay.dateISO === todayISO) {
        return t("dashboard.areaScopeToday");
      }
      const localeKey = isEnglishIntlLocale(intlLocale) ? "en" : "de";
      return dayCardWeekdayTwoLetter(
        weekdayIndexFromDate(currentDay.dateISO),
        localeKey
      );
    }
    return formatDashboardAreaScopeDayLabel(currentDay.dateISO, intlLocale);
  }, [currentDay, intlLocale, isCurrentWeek, t, todayISO]);

  const areaScopeWeekLabel = useMemo(() => {
    if (isCurrentWeek) {
      return t("dashboard.areaScopeWeek");
    }
    const weekHeader = getAreaCalendarWeekHeaderParts(weekStart, intlLocale);
    return formatDashboardAreaScopeWeekLabel(
      weekStart,
      intlLocale,
      weekHeader.calendarWeek
    );
  }, [intlLocale, isCurrentWeek, t, weekStart]);

  const areaScopeWeekShortLabel = useMemo(() => {
    if (isCurrentWeek) {
      return t("dashboard.areaScopeWeek");
    }
    const weekHeader = getAreaCalendarWeekHeaderParts(weekStart, intlLocale);
    return `KW ${weekHeader.calendarWeek}`;
  }, [intlLocale, isCurrentWeek, t, weekStart]);

  const buildAssignmentOverviewContext = useCallback(
    (
      areaId: string,
      areaName: string,
      areaCalendarHref: string
    ): DashboardAreaAssignmentOverviewContext | null => {
      if (!selectedLocationId || !snapshot.staffingEnabled || !currentDay) {
        return null;
      }

      const scope = areaDetailScopeByAreaId[areaId] ?? "day";
      const statsDates = resolveDashboardAreaStatsDates(scope, {
        drilldownDayISO: resolveAreaCardScopeDateISO("day"),
        weekDates: snapshot.dates,
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
      currentDay,
      areaDetailScopeByAreaId,
      resolveAreaCardScopeDateISO,
      snapshot.dates,
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
      weekStart,
      intlLocale
    );
  }, [
    areaDetailScopeByAreaId,
    assignmentOverviewAreaId,
    intlLocale,
    resolveAreaCardScopeDateISO,
    weekStart,
  ]);

  const assignmentOverviewShowDayHeaders = useMemo(() => {
    if (!assignmentOverviewAreaId) return false;
    return (areaDetailScopeByAreaId[assignmentOverviewAreaId] ?? "day") === "week";
  }, [areaDetailScopeByAreaId, assignmentOverviewAreaId]);

  const renderDayDrilldownAreaSlot = (stats: DashboardAreaWeekStats) => (
    <div key={stats.areaId} className="flex min-w-0 max-w-full flex-col gap-2">
      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2">
        {snapshot.staffingEnabled ? (
          <button
            type="button"
            className={cn(
              DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS,
              "max-w-full truncate"
            )}
            onClick={() => setAssignmentOverviewAreaId(stats.areaId)}
          >
            {t("dashboard.areaAssignmentOverviewButton")}
          </button>
        ) : (
          <span aria-hidden className="shrink-0" />
        )}
        <div className="shrink-0">
          <D3AreaScopeToggle
            scope={getAreaDetailScope(stats.areaId)}
            dayLabel={areaScopeDayLabel}
            weekLabel={areaScopeWeekLabel}
            weekShortLabel={areaScopeWeekShortLabel}
            onScopeChange={(scope) =>
              setAreaDetailScopeForArea(stats.areaId, scope)
            }
          />
        </div>
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
          weekStart,
          todayISO
        )}
        staffingScopeDateLabel={resolveDashboardAreaCardScopeDateLabel(
          getAreaDetailScope(stats.areaId),
          resolveAreaCardScopeDateISO(getAreaDetailScope(stats.areaId)),
          weekStart,
          intlLocale
        )}
        staffingScopeMode={getAreaDetailScope(stats.areaId)}
        todayISO={todayISO}
        shiftConfirmationEnabled={shiftConfirmationEnabled}
        windowIssuesContext={buildWindowIssuesContext(stats.areaId)}
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
            pageTitle={t("nav.dashboard")}
            weekStart={snapshot.weekStart}
            locationId={snapshot.locationId}
            backAction={
              view.level === "day"
                ? {
                    label: t("dashboard.backToWeekView"),
                    onClick: () => setView({ level: "week" }),
                  }
                : null
            }
          />
          <div className="mt-5 border-b border-black/20" aria-hidden />
        </div>

        <div
          className={cn(
            "flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-clip overflow-y-auto pt-3",
            MODAL_SCROLLBAR_CLASS
          )}
        >
      {view.level === "area" ? (
      <div className="space-y-1">
        {currentDay && currentArea && (
          <>
            <BackButton
              label={`${currentDay.weekdayLabel} – Alle Bereiche`}
              onClick={() => setView({ level: "day", dayIndex: view.dayIndex })}
            />
            <h2 className="text-xl font-bold">{currentArea.areaName}</h2>
            <p className="text-sm text-muted">
              {currentDay.weekdayLabel},{" "}
              {new Date(currentDay.dateISO).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "long",
              })}{" "}
              · {ampelLabel(currentArea.ampelLevel)}
            </p>
          </>
        )}
      </div>
      ) : null}

      {/* ── WEEK VIEW ────────────────────────────────────────────── */}
      {view.level === "week" && (
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-5 pb-0">
          {/* Day cards */}
          {days.length === 0 ? (
            <div className={cn(D3_ROUNDED, D3_CARD_FRAME_CLASS, "border-dashed border-black/15 bg-surface px-6 py-10 text-center text-sm text-muted")}>
              Keine Schichten in dieser Woche
            </div>
          ) : (
            <div className={D3_DAY_CARDS_GRID_CLASS}>
              {days.map((day, i) => (
                <DayCard
                  key={day.dateISO}
                  day={day}
                  areaCount={planningAreas.length}
                  staffingEnabled={snapshot.staffingEnabled}
                  shiftConfirmationEnabled={shiftConfirmationEnabled}
                  onClick={() => {
                    setAreaDetailScopeByAreaId({});
                    setView({ level: "day", dayIndex: i });
                  }}
                />
              ))}
            </div>
          )}

          {/* Stat cards */}
          <div className="space-y-2 border-t border-black/20 pt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatCard
              label="Heute offen"
              value={
                todayDay
                  ? todayDay.openSlots === 0
                    ? "✓ Besetzt"
                    : todayDay.openSlots
                  : "—"
              }
              sub={
                todayDay
                  ? `${todayDay.shiftCount} Schichten heute`
                  : undefined
              }
              accent={
                !todayDay
                  ? "gray"
                  : todayDay.openSlots === 0
                    ? "green"
                    : "red"
              }
            />
            <StatCard
              label="Woche gesamt"
              value={coveragePct !== null ? `${coveragePct}%` : "—"}
              sub={
                rollup.requiredTotal > 0
                  ? `${rollup.assignedTotal}/${rollup.requiredTotal} besetzt`
                  : "Kein Bedarf konfiguriert"
              }
              accent={
                coveragePct === null
                  ? "gray"
                  : coveragePct >= 90
                    ? "green"
                    : coveragePct >= 60
                      ? "yellow"
                      : "red"
              }
            />
            <StatCard
              label="Offene Stellen"
              value={rollup.openSlots}
              sub={
                rollup.criticalAreaCount > 0
                  ? `${rollup.criticalAreaCount} kritische Bereiche`
                  : "Alles im grünen Bereich"
              }
              accent={rollup.openSlots === 0 ? "green" : rollup.criticalAreaCount > 0 ? "red" : "yellow"}
            />
            </div>
            <D3CompensationPanels rollup={rollup} />
          </div>

          <AmpelLegend />
        </div>
      )}

      {/* ── DAY VIEW ─────────────────────────────────────────────── */}
      {view.level === "day" && currentDay && (
        <div className="min-w-0 max-w-full pb-6">
          {dayAreaStats.length === 0 ? (
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
            <div className={D3_DAY_DRILLDOWN_AREAS_GRID_CLASS}>
              {dayAreaStats.map(renderDayDrilldownAreaSlot)}
            </div>
          )}
        </div>
      )}

      {/* ── AREA DETAIL VIEW ──────────────────────────────────────── */}
      {view.level === "area" && currentArea && (
        <div className="flex flex-col gap-5 pb-6">
          {/* Area summary */}
          <div className={cn(D3_ROUNDED, "p-5", D3_CARD_FRAME_CLASS, ampelBg(currentArea.ampelLevel))}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                {currentDayArea?.hasServiceHours ? ampelDot(currentArea.ampelLevel) : null}
                <span className="font-semibold">
                  {currentDayArea?.hasServiceHours
                    ? ampelLabel(currentArea.ampelLevel)
                    : "Kein Servicezeit-Bedarf"}
                </span>
              </div>
              <span className="text-sm text-muted">{currentArea.shiftCount} Schichten</span>
              {currentArea.openSlots > 0 && (
                <span className="text-sm font-semibold text-red-600">
                  {currentArea.openSlots} {currentArea.openSlots === 1 ? "Stelle offen" : "Stellen offen"}
                </span>
              )}
              {currentArea.criticalWindowLabel && (
                <span className={cn(D3_ROUNDED, "bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700")}>
                  Kritisch: {currentArea.criticalWindowLabel}
                </span>
              )}
            </div>
          </div>

          {/* Issues */}
          {currentAreaIssues.length === 0 ? (
            <div className={cn(D3_ROUNDED, D3_CARD_FRAME_CLASS, "border-dashed border-black/15 bg-surface px-6 py-10 text-center text-sm text-muted")}>
              Keine offenen Probleme in diesem Bereich für diesen Tag ✓
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Offene Punkte ({currentAreaIssues.length})
              </p>
              {currentAreaIssues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </div>
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
          onClose={() => setAssignmentOverviewAreaId(null)}
        />
      ) : null}
    </>
  );
}
