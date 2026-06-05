"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { getDashboardWeekHeaderParts } from "@/lib/planning-utils";
import { Button, ControlDisplay, IconButton } from "@/components/ui";
import { LanguageSelect } from "@/components/i18n/language-select";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";

/** Gleiche Höhe wie IconButton size="md" (h-9). */
const HEADER_CONTROL_H = "h-9 min-h-9";

type Props = {
  weekStart: string;
};

export function DashboardHeader({ weekStart }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { locale } = useLocale();
  const t = useTranslations();

  const weekHeader = useMemo(
    () => getDashboardWeekHeaderParts(weekStart, toIntlLocale(locale)),
    [weekStart, locale]
  );

  const weekLabelTitle = `${weekHeader.rangeLabel} ${weekHeader.year} KW ${weekHeader.calendarWeek}`;

  function pushDashboardQuery(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, value);
    }
    const q = params.toString();
    startTransition(() => {
      router.push(q ? `/dashboard?${q}` : "/dashboard");
    });
  }

  function navigateWeek(delta: number) {
    const d = parseISODate(weekStart);
    d.setDate(d.getDate() + delta * 7);
    pushDashboardQuery({ week: toISODate(d) });
  }

  function goToToday() {
    pushDashboardQuery({ week: toISODate(startOfWeek(new Date())) });
  }

  return (
    <header className="flex h-20 max-h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="flex min-w-0 select-none items-center gap-2">
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
