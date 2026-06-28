"use client";

// Responsive layout — see apps/web/RESPONSIVE_ROLLBACK.md to revert.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { isPlanningWeekAtEarliest } from "@schichtwerk/database";
import { getAreaCalendarWeekHeaderParts } from "@/lib/planning-utils";
import type { Location, ManagerNotification } from "@schichtwerk/types";
import { Button, IconButton } from "@/components/ui";
import { LanguageSelect } from "@/components/i18n/language-select";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { useOrgFeatures } from "@/lib/org-features-provider";
import { LocationSelect } from "./location-select";
import { AreaCalendarNotificationCenter } from "./areacalendar-notification-center";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";

import { isSettingsModalOpen } from "@/lib/settings-modal-navigation";
import { useIsAppShellLocked } from "@/lib/app-shell-modal-lock";
import { APP_PAGE_TOOLBAR_HEADER_CLASS } from "@/lib/app-shell-layout";
import {
  headerToolbarPillButtonClass,
  headerToolbarPillIconButtonClass,
  headerToolbarPillPrimaryClass,
  headerToolbarCountBadgeClass,
  headerToolbarWeekNavGroupClass,
  headerToolbarWeekNavIconButtonClass,
  headerToolbarWeekNavTodayButtonClass,
} from "@/lib/header-toolbar-styles";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("select, input, textarea, [contenteditable='true']")
  );
}

type Props = {
  weekStart: string;
  locations: Location[];
  selectedLocationId: string | null;
  communicationItemCount?: number;
  shiftConfirmationEnabled?: boolean;
  managerNotifications?: ManagerNotification[];
  onOpenCommunication?: (options?: CommunicationOpenOptions) => void;
  onNavigateToWeek?: (weekStart: string) => void;
};

export function AreaCalendarHeader({
  weekStart,
  locations,
  selectedLocationId,
  communicationItemCount = 0,
  shiftConfirmationEnabled = false,
  managerNotifications = [],
  onOpenCommunication,
  onNavigateToWeek,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { locale } = useLocale();
  const t = useTranslations();
  const features = useOrgFeatures();
  const headerRef = useRef<HTMLElement>(null);
  const shellLocked = useIsAppShellLocked();
  const controlsDisabled = pending || shellLocked;

  const weekHeader = useMemo(
    () => getAreaCalendarWeekHeaderParts(weekStart, toIntlLocale(locale)),
    [weekStart, locale]
  );

  const weekLabelTitle = `${weekHeader.rangeLabel} KW ${weekHeader.calendarWeek}`;
  const atEarliestWeek = isPlanningWeekAtEarliest(weekStart);

  const pushAreaCalendarQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const q = params.toString();
      startTransition(() => {
        router.push(q ? `${pathname}?${q}` : pathname);
      });
    },
    [pathname, router, searchParams]
  );

  const navigateWeek = useCallback(
    (delta: number) => {
      if (delta < 0 && atEarliestWeek) return;
      const d = parseISODate(weekStart);
      d.setDate(d.getDate() + delta * 7);
      pushAreaCalendarQuery({ week: toISODate(d) });
    },
    [atEarliestWeek, pushAreaCalendarQuery, weekStart]
  );

  const goToToday = useCallback(() => {
    pushAreaCalendarQuery({ week: toISODate(startOfWeek(new Date())) });
  }, [pushAreaCalendarQuery]);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;
    const headerNode: HTMLElement = headerEl;

    function onKeyDown(e: KeyboardEvent) {
      if (pending || shellLocked || isSettingsModalOpen(searchParams)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!(e.target instanceof Node) || !headerNode.contains(e.target)) return;
      if (isEditableTarget(e.target)) return;

      e.preventDefault();
      navigateWeek(e.key === "ArrowLeft" ? -1 : 1);
    }

    headerNode.addEventListener("keydown", onKeyDown);
    return () => headerNode.removeEventListener("keydown", onKeyDown);
  }, [navigateWeek, pending, searchParams, shellLocked]);

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
      <div className="flex min-w-0 flex-wrap items-center gap-3 md:gap-4">
        <div
          role="group"
          aria-label={`${t("common.prevWeek")} / ${t("common.nextWeek")}`}
          tabIndex={0}
          className={cn(
            headerToolbarWeekNavGroupClass,
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))]"
          )}
          onMouseDown={(event) => {
            if (event.target instanceof HTMLElement && event.target.closest("button")) {
              event.preventDefault();
            }
          }}
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

        <p
          className="min-w-0 select-none text-sm leading-none text-white"
          title={weekLabelTitle}
        >
          <span className="font-semibold">{weekHeader.rangeLabel}</span>
          <span className="ml-1.5 text-xs font-normal">
            KW {weekHeader.calendarWeek}
          </span>
        </p>

        {features.areas ? (
          <LocationSelect
            locations={locations}
            selectedLocationId={selectedLocationId}
            variant="header"
            className="md:ml-1"
          />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
        {onOpenCommunication ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenCommunication()}
            disabled={controlsDisabled}
            className={cn(
              communicationItemCount > 0
                ? headerToolbarPillPrimaryClass
                : headerToolbarPillButtonClass,
              "relative font-semibold"
            )}
          >
            {t("shiftConfirmation.communication.headerButton")}
            {shiftConfirmationEnabled && communicationItemCount > 0 ? (
              <span
                className={cn(
                  "ml-1.5 flex h-4 min-w-4 items-center justify-center leading-none",
                  headerToolbarCountBadgeClass
                )}
              >
                {communicationItemCount > 99 ? "99+" : communicationItemCount}
              </span>
            ) : null}
          </Button>
        ) : null}
        {shiftConfirmationEnabled && onOpenCommunication ? (
          <AreaCalendarNotificationCenter
            enabled={shiftConfirmationEnabled}
            initialNotifications={managerNotifications}
            onOpenCommunication={onOpenCommunication}
            onNavigateToWeek={onNavigateToWeek}
            triggerClassName={headerToolbarPillIconButtonClass}
          />
        ) : null}
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
