"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import { getAreaCalendarWeekHeaderParts } from "@/lib/planning-utils";

type Props = {
  locationName: string;
  weekStart: string;
  className?: string;
  /** Kompakte Karte — füllt die Dashboard-Kopfzeilen-Spalte (3/10 der Zeile ab sm). */
  compact?: boolean;
  /** Standort in der Kopfzeile — bei Toolbar-Standortauswahl ausblenden. */
  showLocation?: boolean;
};

export function DashboardSummaryHeader({
  locationName,
  weekStart,
  className,
  compact = false,
  showLocation = true,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);

  const weekHeader = useMemo(
    () => getAreaCalendarWeekHeaderParts(weekStart, intlLocale),
    [weekStart, intlLocale]
  );

  return (
    <header
      className={cn(
        "flex min-h-[clamp(2.75rem,6.5dvh,3.5rem)] items-center overflow-hidden border border-border bg-surface px-4 py-[clamp(0.375rem,1.25dvh,0.875rem)] shadow-sm",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        compact && "min-w-0 w-full self-stretch",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-snug [font-size:clamp(0.9375rem,0.4rem+1.35dvh,1.3125rem)]",
          !compact && "min-w-0 flex-1"
        )}
      >
        {showLocation ? (
          <>
            <span
              className={cn(
                "font-semibold text-foreground",
                compact ? "whitespace-nowrap" : "min-w-0 truncate"
              )}
            >
              {locationName}
            </span>
            <span className="shrink-0 text-muted/60" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <span className="shrink-0 font-semibold tracking-tight text-foreground">
          {weekHeader.rangeLabel}
        </span>
        <span className="shrink-0 font-medium tabular-nums text-muted">
          {t("dashboard.headerCalendarWeek", {
            week: String(weekHeader.calendarWeek),
          })}
        </span>
      </div>
    </header>
  );
}
