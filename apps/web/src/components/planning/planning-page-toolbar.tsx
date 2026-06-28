"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
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
  headerToolbarCountBadgeClass,
  headerToolbarWeekNavChevronButtonClass,
  headerToolbarWeekNavTodayTextButtonClass,
} from "@/lib/header-toolbar-styles";
import { planningWeekStartFromParam } from "@/lib/planning-week";
import { useMainNavPendingTarget } from "@/lib/app-shell-main-nav-pending";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { isSettingsModalOpen } from "@/lib/settings-modal-navigation";
import { usePlanningToolbarPageBridgeState } from "@/lib/planning-toolbar-page-bridge";
import { useHeaderLanguageShadeGeometry } from "@/lib/use-header-language-shade-geometry";
import { useHeaderLeadingShadeChainGeometry } from "@/lib/use-header-leading-shade-chain-geometry";
import { useHeaderTrailingShadeChainGeometry } from "@/lib/use-header-trailing-shade-chain-geometry";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";

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
  const organization = useOrganization();
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const shellLocked = useIsAppShellLocked();
  const controlsDisabled = pending || shellLocked;
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  useAppShellModalLockActive(weekPickerOpen);
  const todayISO = useMemo(
    () => organizationTodayISO(organization.timezone),
    [organization.timezone]
  );
  const headerRef = useRef<HTMLElement>(null);
  const beforeLanguageRef = useRef<HTMLDivElement>(null);
  const prevWeekMeasureRef = useRef<HTMLDivElement>(null);
  const todayMeasureRef = useRef<HTMLDivElement>(null);
  const nextWeekMeasureRef = useRef<HTMLDivElement>(null);
  const dateMeasureRef = useRef<HTMLDivElement>(null);
  const locationMeasureRef = useRef<HTMLDivElement>(null);
  const areaMeasureRef = useRef<HTMLDivElement>(null);
  const shiftStatiMeasureRef = useRef<HTMLDivElement>(null);
  const bellMeasureRef = useRef<HTMLDivElement>(null);
  const languageMeasureRef = useRef<HTMLDivElement>(null);
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
  const weekLabelTitle = `${weekHeader.rangeLabel} KW ${weekHeader.calendarWeek}`;
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

  const hasLocationPlacement =
    isDashboard ||
    (features.areas && (isAreaCalendar || isEmployeeCalendar));
  const showLocationSelect =
    hasLocationPlacement && shouldShowLocationInPlanningUi(locations.length);
  const hasEmployeeAreaPlacement =
    isEmployeeCalendar && features.areas && (bridge.areas?.length ?? 0) > 0;

  const prevWeekButton = (
    <button
      type="button"
      onClick={() => navigateWeek(-1)}
      disabled={controlsDisabled || atEarliestWeek}
      aria-label={t("common.prevWeek")}
      className={headerToolbarWeekNavChevronButtonClass}
    >
      <ChevronIcon direction="left" />
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
      <ChevronIcon direction="right" />
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
        "header-toolbar-date-trigger min-w-0 shrink-0 cursor-pointer rounded-sm px-1 py-0.5 text-left text-sm leading-none text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))] disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <span className="font-semibold">{weekHeader.rangeLabel}</span>
      <span className="ml-1.5 text-xs font-normal tabular-nums">
        {t("dashboard.headerCalendarWeek", {
          week: String(weekHeader.calendarWeek),
        })}
      </span>
    </button>
  );

  const employeePlacementProps = {
    locations,
    selectedLocationId,
    areas: bridge.areas ?? [],
    selectedAreaId: bridge.selectedAreaId ?? null,
    disabled: controlsDisabled,
    onAreaChange: (areaId: string) => bridge.onAreaChange?.(areaId),
    locationMeasureRef,
    areaMeasureRef,
    showLocationSelect,
  };

  const locationSelectControl = showLocationSelect ? (
    isEmployeeCalendar && features.areas ? (
      <DashboardHeaderPlacement
        {...employeePlacementProps}
        presentation="locationOnly"
      />
    ) : (
      <LocationSelect
        locations={locations}
        selectedLocationId={selectedLocationId}
        variant="header"
      />
    )
  ) : null;

  const areaSelectControl =
    hasEmployeeAreaPlacement ? (
      <DashboardHeaderPlacement
        {...employeePlacementProps}
        presentation="areaOnly"
      />
    ) : null;

  const leadingMeasureSlots = useMemo(
    () => [
      { key: "prevWeek", ref: prevWeekMeasureRef, enabled: true },
      { key: "date", ref: dateMeasureRef, enabled: true },
      { key: "nextWeek", ref: nextWeekMeasureRef, enabled: true },
      { key: "today", ref: todayMeasureRef, enabled: true },
      {
        key: "location",
        ref: locationMeasureRef,
        enabled: showLocationSelect,
      },
      { key: "area", ref: areaMeasureRef, enabled: hasEmployeeAreaPlacement },
    ],
    [hasEmployeeAreaPlacement, showLocationSelect]
  );

  const placementTrailingLightAfterKey = useMemo((): "location" | "area" | null => {
    if (isEmployeeCalendar && hasEmployeeAreaPlacement) return "area";
    if (showLocationSelect) return "location";
    return null;
  }, [hasEmployeeAreaPlacement, isEmployeeCalendar, showLocationSelect]);

  const leadingShadeChainGeometry = useHeaderLeadingShadeChainGeometry(
    headerRef,
    leadingMeasureSlots,
    [
      locale,
      weekHeader.rangeLabel,
      weekHeader.calendarWeek,
      selectedLocationId,
      bridge.selectedAreaId,
      bridge.areas?.length,
      locations.length,
      controlsDisabled,
      atEarliestWeek,
      toolbarPathname,
      features.areas,
    ],
    { placementTrailingLightAfterKey, leadingLightBeforeFirst: true, alwaysLightAfterKey: "today" }
  );

  const useLeadingShadeOverlays = Boolean(leadingShadeChainGeometry?.slots.length);

  const renderLeadingOverlayControl = useCallback(
    (key: string) => {
      switch (key) {
        case "prevWeek":
          return prevWeekButton;
        case "today":
          return todayButton;
        case "nextWeek":
          return nextWeekButton;
        case "date":
          return dateLabel;
        case "location":
          return locationSelectControl;
        case "area":
          return areaSelectControl;
        default:
          return null;
      }
    },
    [
      atEarliestWeek,
      bridge.areas,
      bridge.onAreaChange,
      bridge.selectedAreaId,
      controlsDisabled,
      dateLabel,
      openWeekPicker,
      weekPickerOpen,
      features.areas,
      hasEmployeeAreaPlacement,
      hasLocationPlacement,
      isEmployeeCalendar,
      locationSelectControl,
      areaSelectControl,
      locations,
      nextWeekButton,
      prevWeekButton,
      selectedLocationId,
      todayButton,
    ]
  );

  const hasCommunication = Boolean(bridge.onOpenCommunication);

  const shiftStatiButton = hasCommunication ? (
    <button
      type="button"
      onClick={() => bridge.onOpenCommunication?.()}
      disabled={controlsDisabled || bridge.communicationDisabled}
      className={headerToolbarCommunicationButtonClass}
    >
      {t("shiftConfirmation.communication.headerButton")}
      {shiftConfirmationEnabled && (bridge.communicationItemCount ?? 0) > 0 ? (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center leading-none",
            headerToolbarCountBadgeClass
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
        triggerClassName={headerToolbarBellTriggerClass}
      />
    ) : null;

  const languageShadeGeometry = useHeaderLanguageShadeGeometry(
    headerRef,
    beforeLanguageRef,
    languageMeasureRef,
    [
      bridge.onOpenCommunication,
      shiftConfirmationEnabled,
      locale,
      bridge.communicationItemCount,
    ]
  );

  const trailingShadeChainGeometry = useHeaderTrailingShadeChainGeometry(
    headerRef,
    languageShadeGeometry?.left ?? null,
    shiftStatiMeasureRef,
    bellMeasureRef,
    {
      hasBell: Boolean(bellControl),
      hasStati: Boolean(shiftStatiButton),
    },
    [
      bridge.onOpenCommunication,
      shiftConfirmationEnabled,
      locale,
      bridge.communicationItemCount,
      bridge.communicationDisabled,
      controlsDisabled,
      bridge.managerNotifications?.length,
    ]
  );

  const useTrailingShadeOverlays = Boolean(
    languageShadeGeometry && trailingShadeChainGeometry
  );

  const placementMeasureRow =
    isEmployeeCalendar && features.areas ? (
      <div
        className={cn(useLeadingShadeOverlays && "pointer-events-none opacity-0")}
        aria-hidden={useLeadingShadeOverlays ? true : undefined}
      >
        <DashboardHeaderPlacement {...employeePlacementProps} />
      </div>
    ) : showLocationSelect ? (
      <div
        ref={locationMeasureRef}
        className={cn(
          "planning-toolbar-placement-slot flex h-8 shrink-0 items-center",
          useLeadingShadeOverlays && "pointer-events-none opacity-0"
        )}
        aria-hidden={useLeadingShadeOverlays ? true : undefined}
      >
        <LocationSelect
          locations={locations}
          selectedLocationId={selectedLocationId}
          variant="header"
        />
      </div>
    ) : null;

  return (
    <>
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
          "planning-toolbar-primary-row relative z-[1] flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden md:gap-3",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <div
          ref={prevWeekMeasureRef}
          className={cn(useLeadingShadeOverlays && "pointer-events-none opacity-0")}
          aria-hidden={useLeadingShadeOverlays ? true : undefined}
        >
          {prevWeekButton}
        </div>
        <div
          ref={dateMeasureRef}
          className={cn(useLeadingShadeOverlays && "pointer-events-none opacity-0")}
          aria-hidden={useLeadingShadeOverlays ? true : undefined}
        >
          {dateLabel}
        </div>
        <div
          ref={nextWeekMeasureRef}
          className={cn(useLeadingShadeOverlays && "pointer-events-none opacity-0")}
          aria-hidden={useLeadingShadeOverlays ? true : undefined}
        >
          {nextWeekButton}
        </div>
        <div
          ref={todayMeasureRef}
          className={cn(useLeadingShadeOverlays && "pointer-events-none opacity-0")}
          aria-hidden={useLeadingShadeOverlays ? true : undefined}
        >
          {todayButton}
        </div>
        {placementMeasureRow}
      </div>

      {leadingShadeChainGeometry ? (
        <>
          {leadingShadeChainGeometry.leadingLight ? (
            <div
              aria-hidden
              className="planning-toolbar-leading-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
              style={{ left: leadingShadeChainGeometry.leadingLight.left }}
            />
          ) : null}
          {leadingShadeChainGeometry.slots.map((slot) => (
            <Fragment key={slot.key}>
              <div
                className="planning-toolbar-shade-zone absolute inset-y-0"
                style={{
                  left: slot.shade.left,
                  width: slot.shade.width,
                }}
              >
                <div
                  aria-hidden
                  className="planning-toolbar-leading-shade pointer-events-none absolute inset-0"
                />
                <div className="relative z-[1] flex h-full items-center justify-center">
                  {renderLeadingOverlayControl(slot.key)}
                </div>
              </div>
              {slot.lightAfter ? (
                <div
                  aria-hidden
                  className="planning-toolbar-leading-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
                  style={{ left: slot.lightAfter.left }}
                />
              ) : null}
            </Fragment>
          ))}
          {leadingShadeChainGeometry.alwaysLightAfter ? (
            <div
              aria-hidden
              className="planning-toolbar-leading-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
              style={{ left: leadingShadeChainGeometry.alwaysLightAfter.left }}
            />
          ) : null}
          {leadingShadeChainGeometry.placementTrailingLight ? (
            <div
              aria-hidden
              className="planning-toolbar-leading-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
              style={{
                left: leadingShadeChainGeometry.placementTrailingLight.left,
              }}
            />
          ) : null}
        </>
      ) : null}

      {trailingShadeChainGeometry ? (
        <>
          {trailingShadeChainGeometry.lightAfterLastShade ? (
            <div
              aria-hidden
              className="planning-toolbar-language-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
              style={{
                left: trailingShadeChainGeometry.lightAfterLastShade.left,
              }}
            />
          ) : null}
          {trailingShadeChainGeometry.statiShade ? (
            <div
              className="planning-toolbar-shade-zone absolute inset-y-0"
              style={{
                left: trailingShadeChainGeometry.statiShade.left,
                width: trailingShadeChainGeometry.statiShade.width,
              }}
            >
              <div
                aria-hidden
                className="planning-toolbar-language-shade pointer-events-none absolute inset-0"
              />
              <div className="relative z-[1] flex h-full items-center justify-center">
                {shiftStatiButton}
              </div>
            </div>
          ) : null}
          {trailingShadeChainGeometry.lightBeforeBell ? (
            <div
              aria-hidden
              className="planning-toolbar-language-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
              style={{
                left: trailingShadeChainGeometry.lightBeforeBell.left,
              }}
            />
          ) : null}
          {trailingShadeChainGeometry.bellShade ? (
            <div
              className="planning-toolbar-shade-zone absolute inset-y-0"
              style={{
                left: trailingShadeChainGeometry.bellShade.left,
                width: trailingShadeChainGeometry.bellShade.width,
              }}
            >
              <div
                aria-hidden
                className="planning-toolbar-language-shade pointer-events-none absolute inset-0"
              />
              <div className="relative z-[1] flex h-full items-center justify-center">
                {bellControl}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {languageShadeGeometry ? (
        <>
          <div
            aria-hidden
            className="planning-toolbar-language-light-overlay pointer-events-none absolute inset-y-0 w-[2px]"
            style={{ left: languageShadeGeometry.left - 2 }}
          />
          <div
            className="planning-toolbar-shade-zone absolute inset-y-0 -right-4 md:-right-6"
            style={{ left: languageShadeGeometry.left }}
          >
            <div
              aria-hidden
              className="planning-toolbar-language-shade pointer-events-none absolute inset-0"
            />
            <div className="relative z-[1] flex h-full items-center justify-center">
              <LanguageSelect variant="header" className="shrink-0" />
            </div>
          </div>
        </>
      ) : null}

      <div className="relative z-[1] flex shrink-0 items-center gap-2">
        <div
          ref={beforeLanguageRef}
          className="flex shrink-0 items-center gap-2"
        >
          {hasCommunication ? (
            <>
              {shiftStatiButton ? (
                <div
                  ref={shiftStatiMeasureRef}
                  className={cn(
                    useTrailingShadeOverlays && "pointer-events-none opacity-0"
                  )}
                  aria-hidden={useTrailingShadeOverlays ? true : undefined}
                >
                  {shiftStatiButton}
                </div>
              ) : null}
              {bellControl ? (
                <div
                  ref={bellMeasureRef}
                  className={cn(
                    "shrink-0",
                    useTrailingShadeOverlays && "pointer-events-none opacity-0"
                  )}
                  aria-hidden={useTrailingShadeOverlays ? true : undefined}
                >
                  {bellControl}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div
          ref={languageMeasureRef}
          className={cn(
            "pointer-events-none w-[7.5rem] max-w-[7.5rem] shrink-0",
            languageShadeGeometry && "opacity-0"
          )}
          aria-hidden={languageShadeGeometry ? true : undefined}
        >
          <LanguageSelect variant="header" className="shrink-0" />
        </div>
      </div>
    </header>
    <PlanningWeekPickerPanel
      open={weekPickerOpen}
      onClose={closeWeekPicker}
      selectedWeekStart={weekStart}
      todayISO={todayISO}
      onSelectWeek={selectWeekFromPicker}
      disabled={pending}
    />
  </>
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
