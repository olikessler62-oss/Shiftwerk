"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

/**
 * Hinweis unter dem Kalender — absolut im bestehenden Seiten-Padding,
 * damit Kalenderhöhe und Viewport-Layout unverändert bleiben.
 */
export function PlanningCalendarInteractionHint({ className }: Props) {
  const t = useTranslations();

  return (
    <p
      className={cn(
        "pointer-events-none absolute inset-x-0 -bottom-3 z-10 px-1 text-center text-[10px] leading-snug text-muted/75 md:-bottom-4 sm:text-[11px]",
        className
      )}
    >
      {t("areaCalendar.calendarInteractionHint")}
    </p>
  );
}
