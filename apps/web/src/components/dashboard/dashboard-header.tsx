"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { getDashboardWeekHeaderParts } from "@/lib/planning-utils";
import type { Location } from "@schichtwerk/types";
import { Button, ControlDisplay, IconButton } from "@/components/ui";
import { LanguageSelect } from "@/components/i18n/language-select";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { LocationSelect } from "./location-select";

/** Gleiche Höhe wie IconButton size="md" (h-9). */
const HEADER_CONTROL_H = "h-9 min-h-9";

const SETTINGS_MODAL_PARAMS = [
  "standorte",
  "profiles",
  "rollen",
  "schichtarten",
  "qualifikationen",
] as const;

function isSettingsModalOpen(params: URLSearchParams): boolean {
  return SETTINGS_MODAL_PARAMS.some((key) => params.get(key) === "1");
}

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
};

export function DashboardHeader({
  weekStart,
  locations,
  selectedLocationId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { locale } = useLocale();
  const t = useTranslations();
  const headerRef = useRef<HTMLElement>(null);

  const weekHeader = useMemo(
    () => getDashboardWeekHeaderParts(weekStart, toIntlLocale(locale)),
    [weekStart, locale]
  );

  const weekLabelTitle = `${weekHeader.rangeLabel} ${weekHeader.year} KW ${weekHeader.calendarWeek}`;

  const pushDashboardQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const q = params.toString();
      startTransition(() => {
        router.push(q ? `/dashboard?${q}` : "/dashboard");
      });
    },
    [router, searchParams]
  );

  const navigateWeek = useCallback(
    (delta: number) => {
      const d = parseISODate(weekStart);
      d.setDate(d.getDate() + delta * 7);
      pushDashboardQuery({ week: toISODate(d) });
    },
    [pushDashboardQuery, weekStart]
  );

  const goToToday = useCallback(() => {
    pushDashboardQuery({ week: toISODate(startOfWeek(new Date())) });
  }, [pushDashboardQuery]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    function onKeyDown(e: KeyboardEvent) {
      if (pending || isSettingsModalOpen(searchParams)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!header.contains(e.target)) return;
      if (isEditableTarget(e.target)) return;

      e.preventDefault();
      navigateWeek(e.key === "ArrowLeft" ? -1 : 1);
    }

    header.addEventListener("keydown", onKeyDown);
    return () => header.removeEventListener("keydown", onKeyDown);
  }, [navigateWeek, pending, searchParams]);

  return (
    <header
      ref={headerRef}
      className="flex h-20 max-h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6"
    >
      <div className="flex min-w-0 select-none items-center gap-2">
        <div
          role="group"
          aria-label={`${t("common.prevWeek")} / ${t("common.nextWeek")}`}
          tabIndex={0}
          className="flex shrink-0 items-center gap-2 rounded-[var(--radius-control)] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <IconButton
            size="md"
            onClick={() => navigateWeek(-1)}
            disabled={pending}
            aria-label={t("common.prevWeek")}
            className={cn(HEADER_CONTROL_H, "text-muted")}
          >
            <ChevronIcon direction="left" />
          </IconButton>

          <ControlDisplay
            className={cn(
              HEADER_CONTROL_H,
              "!w-[340px] shrink-0 justify-center px-2 py-0"
            )}
            title={weekLabelTitle}
          >
            <span className="w-full text-center text-sm leading-none">
              {weekHeader.rangeLabel}{" "}
              <span className="font-semibold">{weekHeader.year}</span>
              <span className="ml-1 text-xs font-normal text-muted">
                KW {weekHeader.calendarWeek}
              </span>
            </span>
          </ControlDisplay>

          <IconButton
            size="md"
            onClick={() => navigateWeek(1)}
            disabled={pending}
            aria-label={t("common.nextWeek")}
            className={cn(HEADER_CONTROL_H, "text-muted")}
          >
            <ChevronIcon direction="right" />
          </IconButton>

          <Button
            type="button"
            variant="outline"
            size="header"
            onClick={goToToday}
            disabled={pending}
            className="font-semibold"
          >
            {t("common.today")}
          </Button>
        </div>

        <div className="ml-5 flex shrink-0 items-center gap-3">
          <span className="text-sm text-foreground">
            {t("dashboard.location")}
          </span>
          <LocationSelect
            locations={locations}
            selectedLocationId={selectedLocationId}
            className="!mt-0 w-[11rem] shrink-0 font-semibold"
          />
        </div>
      </div>

      <LanguageSelect className="shrink-0" />
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
