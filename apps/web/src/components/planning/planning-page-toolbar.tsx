"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import type { Location } from "@schichtwerk/types";
import { Button, IconButton } from "@/components/ui";
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
import { useOrgFeatures } from "@/lib/org-features-provider";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { useIsAppShellLocked } from "@/lib/app-shell-modal-lock";
import { APP_PAGE_TOOLBAR_HEADER_CLASS } from "@/lib/app-shell-layout";
import {
  headerToolbarCountBadgeClass,
  headerToolbarPillIconButtonClass,
  headerToolbarWeekNavGroupClass,
  headerToolbarWeekNavIconButtonClass,
  headerToolbarWeekNavTodayButtonClass,
} from "@/lib/header-toolbar-styles";
import { buildPlanningPageUrl, planningWeekStartFromParam } from "@/lib/planning-week";
import { useBeginMainNavPending, useMainNavPendingTarget } from "@/lib/app-shell-main-nav-pending";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { isSettingsModalOpen } from "@/lib/settings-modal-navigation";
import { usePlanningToolbarPageBridgeState } from "@/lib/planning-toolbar-page-bridge";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("select, input, textarea, [contenteditable='true']")
  );
}

type Props = {
  locations: Location[];
};

export function PlanningPageToolbar({ locations }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { locale } = useLocale();
  const t = useTranslations();
  const features = useOrgFeatures();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const shellLocked = useIsAppShellLocked();
  const controlsDisabled = pending || shellLocked;
  const headerRef = useRef<HTMLElement>(null);
  const bridge = usePlanningToolbarPageBridgeState();
  const beginMainNavPending = useBeginMainNavPending();
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
  const weekLabelTitle = `${weekHeader.rangeLabel} ${weekHeader.year} KW ${weekHeader.calendarWeek}`;
  const atEarliestWeek = isPlanningWeekAtEarliest(weekStart);

  const pushPlanningQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
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
    pushPlanningQuery({ week: toISODate(startOfWeek(new Date())) });
  }, [pushPlanningQuery]);

  useEffect(() => {
    if (!isAreaCalendar) return;
    const headerEl = headerRef.current;
    if (!headerEl) return;

    function onKeyDown(event: KeyboardEvent) {
      if (pending || shellLocked || isSettingsModalOpen(searchParams)) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!(event.target instanceof Node) || !headerEl?.contains(event.target)) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      navigateWeek(event.key === "ArrowLeft" ? -1 : 1);
    }

    headerEl.addEventListener("keydown", onKeyDown);
    return () => headerEl.removeEventListener("keydown", onKeyDown);
  }, [isAreaCalendar, navigateWeek, pending, searchParams, shellLocked]);

  const employeeCalendarHref = buildPlanningPageUrl(
    "/mitarbeiter-kalender",
    searchParams
  );
  const areaCalendarHref = buildPlanningPageUrl(
    "/bereich-kalender",
    searchParams
  );

  const calendarNavLinkClass = cn(
    headerToolbarWeekNavTodayButtonClass,
    "inline-flex items-center font-semibold no-underline"
  );

  const weekNavGroup = (
    <div
      role="group"
      aria-label={`${t("common.prevWeek")} / ${t("common.nextWeek")}`}
      tabIndex={isAreaCalendar ? 0 : undefined}
      className={cn(
        headerToolbarWeekNavGroupClass,
        isAreaCalendar &&
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))]"
      )}
      onMouseDown={
        isAreaCalendar
          ? (event) => {
              if (
                event.target instanceof HTMLElement &&
                event.target.closest("button")
              ) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      <IconButton
        size="sm"
        onClick={() => navigateWeek(-1)}
        disabled={controlsDisabled || atEarliestWeek}
        aria-label={t("common.prevWeek")}
        className={headerToolbarWeekNavIconButtonClass}
      >
        <ChevronIcon direction="left" />
      </IconButton>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={goToToday}
        disabled={controlsDisabled}
        className={headerToolbarWeekNavTodayButtonClass}
      >
        {t("common.today")}
      </Button>

      <IconButton
        size="sm"
        onClick={() => navigateWeek(1)}
        disabled={controlsDisabled}
        aria-label={t("common.nextWeek")}
        className={headerToolbarWeekNavIconButtonClass}
      >
        <ChevronIcon direction="right" />
      </IconButton>
    </div>
  );

  const communicationControls = bridge.onOpenCommunication ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => bridge.onOpenCommunication?.()}
          disabled={controlsDisabled || bridge.communicationDisabled}
          className={cn(
            headerToolbarWeekNavTodayButtonClass,
            "relative font-semibold"
          )}
        >
          {t("shiftConfirmation.communication.headerButton")}
          {shiftConfirmationEnabled && (bridge.communicationItemCount ?? 0) > 0 ? (
            <span
              className={cn(
                "ml-1.5 flex h-4 min-w-4 items-center justify-center leading-none",
                headerToolbarCountBadgeClass
              )}
            >
              {(bridge.communicationItemCount ?? 0) > 99
                ? "99+"
                : bridge.communicationItemCount}
            </span>
          ) : null}
        </Button>
        {shiftConfirmationEnabled ? (
          <AreaCalendarNotificationCenter
            enabled={shiftConfirmationEnabled}
            initialNotifications={bridge.managerNotifications ?? []}
            onOpenCommunication={bridge.onOpenCommunication}
            onNavigateToWeek={bridge.onNavigateToWeek}
            triggerClassName={headerToolbarPillIconButtonClass}
          />
        ) : null}
      </>
    ) : null;

  const placementControls =
    isAreaCalendar && features.areas ? (
      <LocationSelect
        locations={locations}
        selectedLocationId={selectedLocationId}
        variant="header"
        className="md:ml-1"
      />
    ) : isEmployeeCalendar && features.areas ? (
      <DashboardHeaderPlacement
        locations={locations}
        selectedLocationId={selectedLocationId}
        areas={bridge.areas ?? []}
        selectedAreaId={bridge.selectedAreaId ?? null}
        disabled={controlsDisabled}
        className="md:ml-1 md:border-l md:border-foreground/10 md:pl-3"
        onAreaChange={(areaId) => bridge.onAreaChange?.(areaId)}
      />
    ) : isDashboard ? (
      <LocationSelect
        locations={locations}
        selectedLocationId={selectedLocationId}
        variant="header"
        className="md:ml-1"
      />
    ) : null;

  const calendarNavLink = isEmployeeCalendar ? (
    <Link
      href={areaCalendarHref}
      onClick={() =>
        beginMainNavPending({ kind: "page", pathname: "/bereich-kalender" })
      }
      className={calendarNavLinkClass}
    >
      {t("nav.areaCalendar")}
    </Link>
  ) : isAreaCalendar ? (
    <Link
      href={employeeCalendarHref}
      onClick={() =>
        beginMainNavPending({ kind: "page", pathname: "/mitarbeiter-kalender" })
      }
      className={calendarNavLinkClass}
    >
      {t("nav.employeeCalendar")}
    </Link>
  ) : isDashboard ? (
    <Link
      href={employeeCalendarHref}
      onClick={() =>
        beginMainNavPending({ kind: "page", pathname: "/mitarbeiter-kalender" })
      }
      className={calendarNavLinkClass}
    >
      {t("nav.employeeCalendar")}
    </Link>
  ) : null;

  return (
    <header
      ref={headerRef}
      className={cn(
        APP_PAGE_TOOLBAR_HEADER_CLASS,
        shellLocked && "pointer-events-none opacity-50"
      )}
      aria-hidden={shellLocked || undefined}
      {...(shellLocked ? { inert: true } : {})}
    >
      <div
        className={cn(
          "planning-toolbar-primary-row flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden md:gap-3",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {weekNavGroup}
        <p
          className="min-w-0 shrink-0 select-none text-sm leading-none text-white"
          title={weekLabelTitle}
        >
          <span className="font-semibold">{weekHeader.monthYearLabel}</span>
          <span className="ml-1.5 text-xs font-normal tabular-nums">
            KW {weekHeader.calendarWeek}
          </span>
        </p>
        {placementControls ? (
          <div className="planning-toolbar-placement-slot flex h-8 shrink-0 items-center">
            {placementControls}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        {communicationControls}
        {calendarNavLink}
        <LanguageSelect variant="header" className="shrink-0" />
      </div>
    </header>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="currentColor"
      aria-hidden
      className={direction === "right" ? "scale-x-[-1]" : undefined}
    >
      <path d="M7 0L1 6l6 6V0z" />
    </svg>
  );
}
