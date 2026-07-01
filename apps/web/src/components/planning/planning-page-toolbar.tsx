"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Location } from "@schichtwerk/types";
import { LanguageSelect } from "@/components/i18n/language-select";
import { LocationSelect } from "@/components/areacalendar/location-select";
import { AreaCalendarNotificationCenter } from "@/components/areacalendar/areacalendar-notification-center";
import { DashboardHeaderPlacement } from "@/components/dashboard/dashboard-header-placement";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { parseISODate, startOfWeek, toISODate } from "@/lib/dates";
import { isPlanningWeekAtEarliest } from "@schichtwerk/database";
import { getAreaCalendarWeekHeaderParts } from "@/lib/planning-utils";
import { PlanningWeekPickerPanel } from "@/components/planning/planning-week-picker-panel";
import { useOrganization, useOrgFeatures } from "@/lib/org-features-provider";
import { organizationTodayISO } from "@schichtwerk/database";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { useIsAppShellLocked } from "@/lib/app-shell-modal-lock";
import { APP_PAGE_TOOLBAR_HEADER_CLASS } from "@/lib/app-shell-layout";
import {
  headerToolbarBellTriggerClass,
  headerToolbarCommunicationButtonClass,
  headerToolbarCommunicationButtonCompactClass,
  headerToolbarCountBadgeClass,
  headerToolbarBellTriggerCompactClass,
  headerToolbarSegmentClass,
  headerToolbarSegmentDividerClass,
  headerToolbarWeekNavChevronButtonClass,
  headerToolbarWeekNavTodayTextButtonClass,
} from "@/lib/header-toolbar-styles";
import { planningWeekStartFromParam } from "@/lib/planning-week";
import { useMainNavPendingTarget } from "@/lib/app-shell-main-nav-pending";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { isSettingsModalOpen } from "@/lib/settings-modal-navigation";
import { usePlanningToolbarPageBridgeState } from "@/lib/planning-toolbar-page-bridge";
import { usePlanningToolbarCompactLayout } from "@/lib/use-planning-toolbar-compact-layout";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("select, input, textarea, [contenteditable='true']")
  );
}

function HeaderToolbarDivider() {
  return <div className={headerToolbarSegmentDividerClass} aria-hidden />;
}

function HeaderToolbarSegment({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(headerToolbarSegmentClass, className)}>{children}</div>;
}

/** Schicht-Stati-Label — auf schmalen Viewports am Bindestrich umbrechen. */
function HeaderLabelHyphenBreak({
  label,
  compact,
  className,
  maxWidthClass = "max-w-[2.85rem]",
}: {
  label: string;
  compact: boolean;
  className?: string;
  maxWidthClass?: string;
}) {
  if (!compact) {
    return <span className={className}>{label}</span>;
  }

  const dashIndex = label.indexOf("-");
  if (dashIndex === -1) {
    return (
      <span
        className={cn(
          "block text-center text-[11px] leading-tight",
          maxWidthClass,
          className
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center text-center text-[11px] leading-tight",
        maxWidthClass,
        className
      )}
    >
      <span>{label.slice(0, dashIndex + 1)}</span>
      <span>{label.slice(dashIndex + 1)}</span>
    </span>
  );
}

function ShiftStatiHeaderLabel({ label, compact }: { label: string; compact: boolean }) {
  return <HeaderLabelHyphenBreak label={label} compact={compact} />;
}

type Props = {
  locations: Location[];
};

export function PlanningPageToolbar({ locations }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = useTranslations();
  const features = useOrgFeatures();
  const organization = useOrganization();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const shellLocked = useIsAppShellLocked();
  const controlsDisabled = shellLocked;
  const compactToolbar = usePlanningToolbarCompactLayout();
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  useAppShellModalLockActive(weekPickerOpen);
  const todayISO = useMemo(
    () => organizationTodayISO(organization.timezone),
    [organization.timezone]
  );
  const headerRef = useRef<HTMLElement>(null);
  const scrollRowRef = useRef<HTMLDivElement>(null);
  const bridge = usePlanningToolbarPageBridgeState();
  const pendingTarget = useMainNavPendingTarget();
  const frozenToolbarPathnameRef = useRef(pathname);

  useEffect(() => {
    if (!pendingTarget) {
      frozenToolbarPathnameRef.current = pathname;
    }
  }, [pendingTarget, pathname]);

  const toolbarPathname = pendingTarget
    ? frozenToolbarPathnameRef.current
    : pathname;

  const isDashboard = toolbarPathname === "/dashboard";
  const isEmployeeCalendar = toolbarPathname === "/mitarbeiter-kalender";
  const isAreaCalendar = toolbarPathname === "/bereich-kalender";

  const weekStart = useMemo(
    () => planningWeekStartFromParam(searchParams.get("week") ?? undefined),
    [searchParams]
  );
  const selectedLocationId = useMemo(
    () => resolveSelectedLocationId(locations, searchParams.get("location") ?? undefined),
    [locations, searchParams]
  );
  const intlLocale = toIntlLocale(locale);
  const weekHeader = useMemo(
    () => getAreaCalendarWeekHeaderParts(weekStart, intlLocale),
    [weekStart, intlLocale]
  );
  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(parseISODate(todayISO))),
    [todayISO]
  );
  const isCurrentWeek = weekStart === currentWeekStart;
  const weekLabelTitle = `${weekHeader.rangeLabel} KW ${weekHeader.calendarWeek}`;
  const atEarliestWeek = isPlanningWeekAtEarliest(weekStart);

  const pushPlanningQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    },
    [pathname, router, searchParams]
  );

  const navigateWeek = useCallback(
    (delta: number) => {
      if (delta < 0 && atEarliestWeek) return;
      const date = parseISODate(weekStart);
      date.setDate(date.getDate() + delta * 7);
      pushPlanningQuery({ week: toISODate(date) });
    },
    [atEarliestWeek, pushPlanningQuery, weekStart]
  );

  const goToToday = useCallback(() => {
    pushPlanningQuery({
      week: toISODate(startOfWeek(parseISODate(todayISO))),
    });
  }, [pushPlanningQuery, todayISO]);

  const openWeekPicker = useCallback(() => {
    if (controlsDisabled) return;
    setWeekPickerOpen(true);
  }, [controlsDisabled]);

  const closeWeekPicker = useCallback(() => {
    setWeekPickerOpen(false);
  }, []);

  const selectWeekFromPicker = useCallback(
    (nextWeekStart: string) => {
      pushPlanningQuery({ week: nextWeekStart });
    },
    [pushPlanningQuery]
  );

  useEffect(() => {
    if (!isAreaCalendar) return;
    const headerEl = headerRef.current;
    if (!headerEl) return;

    function onKeyDown(event: KeyboardEvent) {
      if (shellLocked || isSettingsModalOpen(searchParams)) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!(event.target instanceof Node) || !headerEl?.contains(event.target)) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      navigateWeek(event.key === "ArrowLeft" ? -1 : 1);
    }

    headerEl.addEventListener("keydown", onKeyDown);
    return () => headerEl.removeEventListener("keydown", onKeyDown);
  }, [isAreaCalendar, navigateWeek, searchParams, shellLocked]);

  const hasLocationPlacement =
    isDashboard ||
    (features.areas && (isAreaCalendar || isEmployeeCalendar));
  const showLocationSelect =
    hasLocationPlacement && shouldShowLocationInPlanningUi(locations.length);
  const hasEmployeeAreaPlacement =
    isEmployeeCalendar && features.areas && (bridge.areas?.length ?? 0) > 0;
  const hasCommunication = Boolean(bridge.onOpenCommunication);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    function resetHorizontalScrollIfFits() {
      const node = headerRef.current;
      if (!node) return;
      if (node.scrollWidth <= node.clientWidth + 1) {
        node.scrollLeft = 0;
      }
    }

    resetHorizontalScrollIfFits();
    window.addEventListener("resize", resetHorizontalScrollIfFits);
    const observer = new ResizeObserver(resetHorizontalScrollIfFits);
    observer.observe(headerEl);
    return () => {
      window.removeEventListener("resize", resetHorizontalScrollIfFits);
      observer.disconnect();
    };
  }, [
    compactToolbar,
    showLocationSelect,
    hasEmployeeAreaPlacement,
    hasCommunication,
    shiftConfirmationEnabled,
    locale,
    weekHeader.rangeLabel,
    weekHeader.compactRangeLabel,
    locations.length,
    bridge.communicationItemCount,
  ]);

  const prevWeekButton = (
    <button
      type="button"
      onClick={() => navigateWeek(-1)}
      disabled={controlsDisabled || atEarliestWeek}
      aria-label={t("common.prevWeek")}
      className={headerToolbarWeekNavChevronButtonClass}
    >
      <ChevronIcon direction="left" compact={compactToolbar} />
    </button>
  );

  const todayButton = (
    <button
      type="button"
      onClick={goToToday}
      disabled={controlsDisabled}
      className={headerToolbarWeekNavTodayTextButtonClass}
    >
      {t("common.today")}
    </button>
  );

  const nextWeekButton = (
    <button
      type="button"
      onClick={() => navigateWeek(1)}
      disabled={controlsDisabled}
      aria-label={t("common.nextWeek")}
      className={headerToolbarWeekNavChevronButtonClass}
    >
      <ChevronIcon direction="right" compact={compactToolbar} />
    </button>
  );

  const dateLabel = (
    <button
      type="button"
      onClick={openWeekPicker}
      disabled={controlsDisabled}
      aria-label={t("common.weekPickerOpenDate")}
      aria-haspopup="dialog"
      aria-expanded={weekPickerOpen}
      title={weekLabelTitle}
      className={cn(
        "header-toolbar-date-trigger relative min-w-0 shrink-0 cursor-pointer rounded-sm px-1 py-0.5 text-center text-sm leading-tight text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))] disabled:cursor-not-allowed disabled:opacity-50",
        compactToolbar && "max-md:px-0.5"
      )}
    >
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold tabular-nums leading-none">
          {t("dashboard.headerCalendarWeek", {
            week: String(weekHeader.calendarWeek),
          })}
        </span>
        <span className="font-semibold tabular-nums leading-snug">
          <span className="lg:hidden">
            <HeaderLabelHyphenBreak
              label={weekHeader.compactRangeLabel}
              compact={compactToolbar}
              className="font-semibold tabular-nums"
              maxWidthClass="max-w-[3.1rem]"
            />
          </span>
          <span className="hidden whitespace-nowrap lg:inline">{weekHeader.rangeLabel}</span>
        </span>
      </span>
      {isCurrentWeek ? (
        <span
          className="pointer-events-none absolute left-1/2 top-full -mt-px -translate-x-1/2 whitespace-nowrap text-[10px] font-normal leading-none text-white/75"
          aria-hidden
        >
          {t("common.currentWeekHint")}
        </span>
      ) : null}
    </button>
  );

  const employeePlacementProps = {
    locations,
    selectedLocationId,
    areas: bridge.areas ?? [],
    selectedAreaId: bridge.selectedAreaId ?? null,
    disabled: controlsDisabled,
    onAreaChange: (areaId: string) => bridge.onAreaChange?.(areaId),
    showLocationSelect,
  };

  const shiftStatiLabel = t("shiftConfirmation.communication.headerButton");

  const shiftStatiButton = hasCommunication ? (
    <button
      type="button"
      onClick={() => bridge.onOpenCommunication?.()}
      disabled={controlsDisabled || bridge.communicationDisabled}
      className={cn(
        headerToolbarCommunicationButtonClass,
        compactToolbar && headerToolbarCommunicationButtonCompactClass
      )}
    >
      <ShiftStatiHeaderLabel label={shiftStatiLabel} compact={compactToolbar} />
      {shiftConfirmationEnabled && (bridge.communicationItemCount ?? 0) > 0 ? (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center leading-none",
            headerToolbarCountBadgeClass,
            compactToolbar && "max-md:absolute max-md:right-0 max-md:top-0 max-md:h-3.5 max-md:min-w-3.5 max-md:text-[9px]"
          )}
        >
          {(bridge.communicationItemCount ?? 0) > 99
            ? "99+"
            : bridge.communicationItemCount}
        </span>
      ) : null}
    </button>
  ) : null;

  const bellControl =
    hasCommunication && shiftConfirmationEnabled ? (
      <AreaCalendarNotificationCenter
        enabled={shiftConfirmationEnabled}
        initialNotifications={bridge.managerNotifications ?? []}
        onOpenCommunication={bridge.onOpenCommunication!}
        onNavigateToWeek={bridge.onNavigateToWeek}
        triggerClassName={cn(
          headerToolbarBellTriggerClass,
          compactToolbar && headerToolbarBellTriggerCompactClass
        )}
      />
    ) : null;

  const placementControl =
    isEmployeeCalendar && features.areas ? (
      <DashboardHeaderPlacement {...employeePlacementProps} />
    ) : showLocationSelect ? (
      <div className="planning-toolbar-placement-slot flex h-8 shrink-0 items-center">
        <LocationSelect
          locations={locations}
          selectedLocationId={selectedLocationId}
          variant="header"
        />
      </div>
    ) : null;

  const showsTodayButton = !compactToolbar;

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          APP_PAGE_TOOLBAR_HEADER_CLASS,
          "min-w-0 w-full",
          shellLocked && "pointer-events-none opacity-50"
        )}
        aria-hidden={shellLocked || undefined}
        {...(shellLocked ? { inert: true } : {})}
      >
        <div ref={scrollRowRef} className="planning-toolbar-scroll-row">
          <HeaderToolbarDivider />
          <HeaderToolbarSegment className="pl-3 md:pl-6">{prevWeekButton}</HeaderToolbarSegment>
          <HeaderToolbarDivider />
          <HeaderToolbarSegment className="overflow-visible">{dateLabel}</HeaderToolbarSegment>
          <HeaderToolbarDivider />
          <HeaderToolbarSegment>{nextWeekButton}</HeaderToolbarSegment>
          {showsTodayButton ? (
            <>
              <HeaderToolbarDivider />
              <HeaderToolbarSegment>{todayButton}</HeaderToolbarSegment>
              <HeaderToolbarDivider />
            </>
          ) : null}
          {placementControl ? (
            <>
              <HeaderToolbarSegment className="min-w-max">{placementControl}</HeaderToolbarSegment>
              <HeaderToolbarDivider />
            </>
          ) : null}

          <div className="planning-toolbar-row-spacer hidden md:block" aria-hidden />

          {shiftStatiButton ? (
            <>
              <HeaderToolbarDivider />
              <HeaderToolbarSegment className="relative min-w-max">
                {shiftStatiButton}
              </HeaderToolbarSegment>
              <HeaderToolbarDivider />
            </>
          ) : !placementControl && !showsTodayButton ? (
            <HeaderToolbarDivider />
          ) : null}
          {bellControl ? (
            <>
              <HeaderToolbarSegment className="min-w-max px-1.5 md:px-2">
                {bellControl}
              </HeaderToolbarSegment>
              <HeaderToolbarDivider />
            </>
          ) : null}
          <HeaderToolbarSegment
            className={cn(
              "min-w-max",
              compactToolbar ? "max-w-none" : "max-w-[7.5rem]"
            )}
          >
            <LanguageSelect variant="header" compact={compactToolbar} className="shrink-0" />
          </HeaderToolbarSegment>
          <HeaderToolbarDivider />
          <div className="w-3 shrink-0 self-stretch md:w-6" aria-hidden />
        </div>
      </header>
      <PlanningWeekPickerPanel
        open={weekPickerOpen}
        onClose={closeWeekPicker}
        selectedWeekStart={weekStart}
        todayISO={todayISO}
        onSelectWeek={selectWeekFromPicker}
      />
    </>
  );
}

function ChevronIcon({ direction, compact }: { direction: "left" | "right"; compact?: boolean }) {
  const width = compact ? 6 : 8;
  const height = compact ? 9 : 12;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 8 12"
      fill="currentColor"
      aria-hidden
      className={direction === "right" ? "scale-x-[-1]" : undefined}
    >
      <path d="M7 0L1 6l6 6V0z" />
    </svg>
  );
}
