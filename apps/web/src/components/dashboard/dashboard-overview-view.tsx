"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { DashboardAreaAmpelCard } from "@/components/dashboard/dashboard-area-ampel-card";
import { DashboardOpsCommandBar } from "@/components/dashboard/dashboard-ops-command-bar";
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
  CALENDAR_HOLIDAY_DAY_HEADER_LABEL_LEFT_CLASS,
} from "@/lib/calendar-day-header-styles";
import {
  DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS,
} from "@/lib/dashboard-panel-styles";
import { dayCardMinHeightRem, weekTrayEmptyDayCardMinHeightRem } from "@/lib/dashboard-day-card-layout";
// Experiment Wochentags-Farben — zum Reaktivieren Import + DayCard-Block unten einkommentieren:
// import {
//   DAY_CARD_WEEKDAY_BODY_SURFACE_CLASS,
//   resolveDayCardWeekdaySurfaces,
// } from "@/lib/dashboard-day-card-weekday-colors";
import { useOrgFeatures, useAllowPastShiftChanges, useOrganization, useShiftConfirmationPendingAfterMinutes } from "@/lib/org-features-provider";
import { buildPlanningPageUrl, planningWeekStartFromParam } from "@/lib/planning-week";
import { APP_SHELL_CONTENT_OFFSET_CLASS } from "@/lib/app-shell-layout";
import { DashboardAreaStatusFooterLines } from "@/components/dashboard/dashboard-area-status-footer-lines";
import { resolveDashboardAreaStatusFooterLines } from "@/lib/dashboard-area-status-footer-lines";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-modal-shell";
import {
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
import { useClearMainNavPendingWhenReady, useBeginMainNavPending } from "@/lib/app-shell-main-nav-pending";
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
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { getAreaCalendarWeekHeaderParts } from "@/lib/planning-utils";
import type { DashboardExtDaySnapshot } from "@/lib/dashboard-ext-panel-data";
import { organizationTodayISO, resolveOrganizationTimeZone } from "@schichtwerk/database";
import { isPastWeek } from "@/lib/planning-readonly";
import {
  STATUS_SPHERE_DOT_FRAME_CLASS,
  statusSphereDotSurfaceClass,
} from "@/lib/status-sphere-dot-styles";
import { StaffingStatusStrokeIcon } from "@/components/dashboard/staffing-status-stroke-icon";
import { StaffingFillGauge } from "@/components/areacalendar/staffing-fill-gauge";

/** Dashboard — Ecken maximal 5px. */
const D3_ROUNDED = "rounded-[5px]";

/** Feiner Rahmen + dezenter Schatten für Content-Karten. */
const D3_CARD_FRAME_CLASS =
  "border border-black/10 shadow-[0_1px_2px_0_rgba(15,23,42,0.06)]";

// ── Ampel helpers ──────────────────────────────────────────────────────────

/** Platzhalter-Slot für Bereichszeilen ohne Servicezeiten (gleiche Breite wie Füllstandsanzeiger). */
const D3_DAY_CARD_AREA_ICON_SLOT_CLASS = "h-5 w-5 shrink-0";

/** Füllstandsanzeiger in Wochentray-Tagkarten — kompakt wie im Mitarbeiter-Kalender. */
const D3_DAY_CARD_WEEK_TRAY_GAUGE_SIZE_PX = 24;

function DayCardAreaStaffingIndicator({
  area,
  embeddedInWeekTray,
  staffingEnabled,
}: {
  area: DashboardExtDaySnapshot["areas"][number];
  embeddedInWeekTray: boolean;
  staffingEnabled: boolean;
}) {
  if (!area.hasServiceHours) {
    return <span className={D3_DAY_CARD_AREA_ICON_SLOT_CLASS} aria-hidden />;
  }

  if (embeddedInWeekTray && staffingEnabled && area.staffingGauge) {
    return (
      <StaffingFillGauge
        assigned={area.staffingGauge.assigned}
        required={area.staffingGauge.required}
        variant={area.staffingGauge.variant}
        sizePx={D3_DAY_CARD_WEEK_TRAY_GAUGE_SIZE_PX}
        className="gap-0"
      />
    );
  }

  return <DayCardAreaAmpelIcon level={area.ampelLevel} muted={false} />;
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

/** Tag-Karten — gemeinsames Raster für Kalender-Button-Ausrichtung. */
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
  const beginMainNavPending = useBeginMainNavPending();

  const employeeCalendarHref = useMemo(
    () => buildDashboardCalendarHref("/mitarbeiter-kalender", weekStart, locationId),
    [weekStart, locationId]
  );
  const areaCalendarHref = useMemo(
    () => buildDashboardCalendarHref("/bereich-kalender", weekStart, locationId),
    [weekStart, locationId]
  );

  const navButtonClass = DASHBOARD_STATUS_BAR_COMPACT_NAV_BUTTON_CLASS;

  function handleCalendarNav(
    pathname: "/bereich-kalender" | "/mitarbeiter-kalender"
  ) {
    beginMainNavPending({ kind: "page", pathname });
  }

  const calendarNavLinks = (
    <>
      <Link
        href={employeeCalendarHref}
        onClick={() => handleCalendarNav("/mitarbeiter-kalender")}
        className={cn(navButtonClass, "shrink-0 justify-center max-sm:px-2")}
      >
        <span className="sm:hidden">{t("dashboard.calendarNavEmployee")}</span>
        <span className="hidden sm:inline">{t("nav.employeeCalendar")}</span>
      </Link>
      <Link
        href={areaCalendarHref}
        onClick={() => handleCalendarNav("/bereich-kalender")}
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

/** Tag-Karten — Schatten (einzeln). */
const D3_DAY_CARD_FRAME_SHADOW_CLASS =
  "shadow-[0_2px_6px_-1px_rgba(15,23,42,0.1),0_1px_3px_0_rgba(15,23,42,0.06)]";

/** Tag-Karten im Wochen-Tray — flacher, der Tray trägt die Tiefe. */
const D3_DAY_CARD_IN_WEEK_TRAY_SHADOW_CLASS =
  "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]";

/** Tag-Karten — einheitlicher schwarzer 1px-Rahmen. */
const D3_DAY_CARD_BORDER_CLASS = "border border-black";

/** Wochen-Tray — wie Ops-Panel: aktiver Kopf, dezenter Rahmen. */
const D3_WEEK_TRAY_HEADER_SURFACE_CLASS = "bg-[#d4dee8]";

const D3_WEEK_TRAY_CLASS = cn(
  D3_ROUNDED,
  "overflow-x-hidden border border-black/15 shadow-sm"
);

const D3_WEEK_TRAY_HEADER_CLASS = cn(
  D3_WEEK_TRAY_HEADER_SURFACE_CLASS,
  "border-b border-black/15 px-2 py-2.5 text-left sm:px-3 sm:py-3"
);

const D3_WEEK_TRAY_CONTENT_SURFACE_CLASS = "bg-[#eff4f7]";

const D3_WEEK_TRAY_BODY_CLASS = cn(D3_WEEK_TRAY_CONTENT_SURFACE_CLASS, "p-2 sm:p-3");

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

const D3_DAY_CARD_AREA_NAME_CLASS =
  "min-h-5 min-w-0 truncate text-[11px] leading-5 text-foreground/75";

/** Wochentray: Bereichsname neben Füllstandsanzeiger — statische Klasse für Tailwind-Scan. */
const D3_DAY_CARD_WEEK_TRAY_AREA_NAME_CLASS =
  "min-h-5 min-w-0 truncate text-[11px] font-bold leading-5 text-foreground";

/** Tag-Karte im Wochen-Tray — Rahmen wie Wochentray; Hover nur am Rand. */
const D3_DAY_CARD_WEEK_TRAY_BORDER_CLASS =
  "border border-black/15 transition-colors hover:border-black";

/** Tag-Karte im Wochen-Tray — dezente abgerundete Einzelkarte. */
const D3_DAY_CARD_WEEK_TRAY_CLASS = cn(
  D3_ROUNDED,
  D3_DAY_CARD_WEEK_TRAY_BORDER_CLASS,
  D3_DAY_CARD_IN_WEEK_TRAY_SHADOW_CLASS
);

/** Datums- + Wochentagszeile — feste Höhe inkl. reservierter Feiertagszeile. */
const D3_DAY_CARD_HEADER_SLOT_CLASS = cn(
  DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS,
  "border-t border-t-black border-b border-b-[#5c6678]",
  "flex min-h-[4.5rem] shrink-0 flex-col justify-start px-3.5 pb-2.5 pt-2.5"
);

/** Tag-Kartenkopf im Wochentray — gleiche Fläche wie Wochentray-Kopf. */
const D3_DAY_CARD_WEEK_TRAY_HEADER_SLOT_CLASS = cn(
  D3_WEEK_TRAY_HEADER_SURFACE_CLASS,
  "border-b border-black/15",
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

/** Wochentray: geschlossene Tage ohne Servicezeiten — zurückhaltend grau. */
const D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_SURFACE_CLASS = "bg-[#eceff3]";

const D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_HEADER_CLASS = cn(
  D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_SURFACE_CLASS,
  "border-b-black/10 text-foreground/80"
);

const D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_BODY_CLASS =
  D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_SURFACE_CLASS;

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

  return statusSphereDotSurfaceClass(hasUncoveredArea ? "danger" : "success");
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

const DAY_CARD_FOOTER_AREAS_CLASS = "flex min-w-0 flex-col gap-1.5";
const DAY_CARD_FOOTER_AREA_HEADING_BASE_CLASS =
  "truncate text-[11px] font-bold leading-none text-foreground/80";
const DAY_CARD_FOOTER_AREA_HEADING_BUTTON_CLASS = cn(
  DAY_CARD_FOOTER_AREA_HEADING_BASE_CLASS,
  "block w-full min-w-0 rounded-sm px-0.5 py-px text-left",
  "cursor-pointer",
  "hover:bg-black/[0.09] active:bg-black/[0.12]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
);
const DAY_CARD_FOOTER_AREA_LINES_CLASS =
  "mt-0.5 flex min-w-0 flex-col gap-0.5 pl-2 sm:pl-2.5";

function resolveDayCardAreaFooterLines(
  area: DashboardExtDaySnapshot["areas"][number],
  shiftConfirmationEnabled: boolean
) {
  return resolveDashboardAreaStatusFooterLines({
    openSlots: area.openSlots,
    shiftConfirmationEnabled,
    shiftCount: area.shiftCount,
    confirmationCounts: area.confirmationCounts,
    swapRequestedCount: area.swapRequestedCount,
  });
}

type DayCardFooterAreaSection = {
  areaId: string;
  areaName: string;
  lines: ReturnType<typeof resolveDayCardAreaFooterLines>;
};

function resolveDayCardFooterAreaSections(
  day: DashboardExtDaySnapshot,
  shiftConfirmationEnabled: boolean
): DayCardFooterAreaSection[] {
  return day.areas
    .map((area) => ({
      areaId: area.areaId,
      areaName: area.areaName,
      lines: resolveDayCardAreaFooterLines(area, shiftConfirmationEnabled),
    }))
    .filter((section) => section.lines.length > 0);
}

function DayCardFooterByArea({
  sections,
  onAreaClick,
  t,
}: {
  sections: readonly DayCardFooterAreaSection[];
  onAreaClick?: (areaId: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (sections.length === 0) return null;

  return (
    <div className={DAY_CARD_FOOTER_AREAS_CLASS}>
      {sections.map((section) => (
        <div key={section.areaId} className="min-w-0">
          {onAreaClick ? (
            <button
              type="button"
              className={DAY_CARD_FOOTER_AREA_HEADING_BUTTON_CLASS}
              aria-label={t("dashboard.dayCardOpenAreaAriaLabel", {
                area: section.areaName,
              })}
              onClick={(event) => {
                event.stopPropagation();
                onAreaClick(section.areaId);
              }}
            >
              {section.areaName}
            </button>
          ) : (
            <p className={DAY_CARD_FOOTER_AREA_HEADING_BASE_CLASS}>
              {section.areaName}
            </p>
          )}
          <div className={DAY_CARD_FOOTER_AREA_LINES_CLASS}>
            <DayCardFooterStatusLines lines={section.lines} t={t} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DayCardFooterStatusLines({
  lines,
  t,
}: {
  lines: ReturnType<typeof resolveDayCardAreaFooterLines>;
  t: ReturnType<typeof useTranslations>;
}) {
  return <DashboardAreaStatusFooterLines lines={lines} t={t} />;
}

function DayCard({
  day,
  areaCount,
  staffingEnabled,
  shiftConfirmationEnabled,
  embeddedInWeekTray = false,
  emptyDayReferenceMinHeightRem,
  holidayName = null,
  onClick,
  onAreaClick,
}: {
  day: DashboardExtDaySnapshot;
  areaCount: number;
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  embeddedInWeekTray?: boolean;
  /** Wochentray: Mindesthöhe für Tage ohne Schichten/Servicezeiten. */
  emptyDayReferenceMinHeightRem?: number;
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
  const isWeekTrayNoServiceDay = embeddedInWeekTray && !day.hasServiceHours;
  const showStatusDot = dayCardShowsStatusDot(day, staffingEnabled);
  // const weekdaySurfaces = resolveDayCardWeekdaySurfaces(weekdayIndexFromDate(day.dateISO), {
  //   isPast: isPastDay,
  // });
  const footerAreaSections = resolveDayCardFooterAreaSections(
    day,
    shiftConfirmationEnabled
  );
  const showAreaRows = day.hasServiceHours && day.shiftCount > 0;
  const cardMinHeightRem = showAreaRows
    ? dayCardMinHeightRem(day.areas.length)
    : (emptyDayReferenceMinHeightRem ?? dayCardMinHeightRem(areaCount));

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
        "group relative flex w-full cursor-pointer flex-col overflow-hidden text-left",
        embeddedInWeekTray ? "min-w-0 h-auto" : "h-full min-h-0 transition-colors",
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
          embeddedInWeekTray
            ? D3_DAY_CARD_WEEK_TRAY_HEADER_SLOT_CLASS
            : D3_DAY_CARD_HEADER_SLOT_CLASS,
          "relative",
          embeddedInWeekTray && "px-2.5 py-2 sm:px-3.5 sm:py-2.5",
          isWeekTrayNoServiceDay && D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_HEADER_CLASS
        )}
      >
        {showStatusDot ? (
          <span
            className={cn(
              STATUS_SPHERE_DOT_FRAME_CLASS,
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
          "flex min-h-0 flex-1 flex-col",
          "min-w-0",
          embeddedInWeekTray
            ? "px-2.5 pb-3 pt-3 sm:px-3.5 sm:pb-4 sm:pt-4"
            : "px-3.5 pb-4 pt-4 transition-colors",
          embeddedInWeekTray
            ? isWeekTrayNoServiceDay
              ? D3_DAY_CARD_WEEK_TRAY_NO_SERVICE_BODY_CLASS
              : isPastDay
                ? "bg-[#e8ebf0]"
                : "bg-white"
            : isPastDay
              ? D3_DAY_CARD_BODY_PAST_SURFACE_CLASS
              : cn("bg-white", D3_DAY_CARD_BODY_HOVER_SURFACE_CLASS)
        )}
      >
        <div className="min-h-0 flex-1">
          {!showAreaRows ? (
            <p
              className={cn(
                "text-[11px] leading-snug",
                !day.hasServiceHours
                  ? "font-medium text-foreground/70"
                  : "text-muted/80"
              )}
            >
              {!day.hasServiceHours ? "Keine Servicezeiten" : "Keine Schichten"}
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
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <DayCardAreaStaffingIndicator
                        area={area}
                        embeddedInWeekTray={embeddedInWeekTray}
                        staffingEnabled={staffingEnabled}
                      />
                    </div>
                    <span
                      className={
                        embeddedInWeekTray
                          ? D3_DAY_CARD_WEEK_TRAY_AREA_NAME_CLASS
                          : D3_DAY_CARD_AREA_NAME_CLASS
                      }
                    >
                      {area.areaName}
                    </span>
                  </button>
                ) : (
                  <div key={area.areaId} className={D3_DAY_CARD_AREA_ROW_STATIC_CLASS}>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <DayCardAreaStaffingIndicator
                        area={area}
                        embeddedInWeekTray={embeddedInWeekTray}
                        staffingEnabled={staffingEnabled}
                      />
                    </div>
                    <span
                      className={
                        embeddedInWeekTray
                          ? D3_DAY_CARD_WEEK_TRAY_AREA_NAME_CLASS
                          : D3_DAY_CARD_AREA_NAME_CLASS
                      }
                    >
                      {area.areaName}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
        {footerAreaSections.length > 0 ? (
          <div className="mt-3 shrink-0 border-t border-black/[0.08] pt-3">
            <DayCardFooterByArea
              sections={footerAreaSections}
              onAreaClick={onAreaClick}
              t={t}
            />
          </div>
        ) : null}
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
  communicationSwapRequests?: CommunicationSwapRequestRow[];
  onOpenSwapRequests?: () => void;
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
  communicationSwapRequests = [],
  onOpenSwapRequests,
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
  const allowPastShiftChanges = useAllowPastShiftChanges();
  const organizationTimeZone = useMemo(
    () => resolveOrganizationTimeZone(organization),
    [organization]
  );
  const pendingAfterMinutes = useShiftConfirmationPendingAfterMinutes();
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

  const employeeColorById = useMemo(
    () => new Map(employees.map((profile) => [profile.id, profile.color] as const)),
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

  const weekTrayEmptyDayCardMinHeight = weekTrayEmptyDayCardMinHeightRem(
    days,
    shiftConfirmationEnabled,
    planningAreas.length
  );

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
          swapRequests: communicationSwapRequests,
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
    communicationSwapRequests,
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
      if (!selectedLocationId || !snapshot.staffingEnabled) {
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
        employeeColorById,
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
      employeeColorById,
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
        employeeColorById,
        shiftConfirmationEnabled,
        pendingAfterMinutes,
        readOnlyWeek: snapshot.readOnlyWeek,
        todayISO,
        timeZone: organizationTimeZone,
        allowPastShiftChanges,
      };
    },
    [
      selectedLocationId,
      shiftConfirmationEnabled,
      pendingAfterMinutes,
      drilldownDateISO,
      activeWeekStart,
      calendarShifts,
      serviceHours,
      employeeNameById,
      employeeColorById,
      snapshot.readOnlyWeek,
      todayISO,
      organizationTimeZone,
      allowPastShiftChanges,
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
        pendingAfterMinutes,
        todayISO,
        timeZone: organizationTimeZone,
        allowPastShiftChanges,
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
      pendingAfterMinutes,
      todayISO,
      organizationTimeZone,
      allowPastShiftChanges,
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
    <div
      key={`${stats.areaId}-${activeWeekStart}-${detailDayISO ?? drilldownDateISO ?? ""}`}
      className="min-w-0 max-w-full"
    >
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
        onOpenSwapRequests={onOpenSwapRequests}
        statusFooterLayout="two-column"
        areaScopeToggle={{
          scope: getAreaDetailScope(stats.areaId),
          dayLabel: areaScopeDayToggleLabel,
          weekLabel: areaScopeWeekLabel,
          weekShortLabel: areaScopeWeekShortLabel,
          onScopeChange: (scope) =>
            setAreaDetailScopeForArea(stats.areaId, scope),
        }}
      />
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
          <DashboardOpsCommandBar
            snapshot={snapshot}
            issueCount={snapshot.issues.length}
          />

          {/* Day cards */}
          {days.length === 0 ? (
            <div
              className={cn(
                D3_WEEK_TRAY_CLASS,
                D3_WEEK_TRAY_CONTENT_SURFACE_CLASS,
                "px-6 py-10 text-center text-sm text-muted"
              )}
            >
              Keine Schichten in dieser Woche
            </div>
          ) : (
            <div className={D3_WEEK_TRAY_CLASS}>
              <div className={D3_WEEK_TRAY_HEADER_CLASS}>
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="shrink-0 font-medium text-muted">
                    {t("dashboard.weekTrayHeaderIntro")}
                  </span>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-foreground sm:text-lg">
                    {t("dashboard.headerCalendarWeek", {
                      week: String(weekTrayHeader.calendarWeek),
                    })}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold text-foreground sm:text-sm">
                    {weekTrayHeader.rangeLabel}
                  </span>
                  {isCurrentWeek ? (
                    <span className="shrink-0 text-[10px] font-semibold leading-none text-blue-600 sm:text-xs">
                      {t("common.currentWeekHint")}
                    </span>
                  ) : null}
                </p>
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
                      emptyDayReferenceMinHeightRem={weekTrayEmptyDayCardMinHeight}
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
