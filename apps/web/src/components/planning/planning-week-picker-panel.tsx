"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlanningSidePanel } from "@/components/planning/planning-side-panel";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { buildHolidayNamesByDate } from "@/lib/german-public-holidays";
import { parseISODate } from "@/lib/dates";
import {
  buildPlanningWeekPickerWeeks,
  resolvePlanningWeekPickerMonthRangeLabel,
} from "@/lib/planning-week-picker-month";
import { earliestPlanningWeekStartISO } from "@schichtwerk/database";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedWeekStart: string;
  todayISO: string;
  onSelectWeek: (weekStart: string) => void;
  disabled?: boolean;
};

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function monthFromWeekStart(weekStartISO: string) {
  const date = parseISODate(weekStartISO);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function monthFromDateISO(dateISO: string) {
  const date = parseISODate(dateISO);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function PlanningWeekPickerPanel({
  open,
  onClose,
  selectedWeekStart,
  todayISO,
  onSelectWeek,
  disabled = false,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const intlLocale = localeKey === "en" ? "en-GB" : "de-DE";

  const [viewMonth, setViewMonth] = useState(() => monthFromWeekStart(selectedWeekStart));

  useEffect(() => {
    if (open) {
      setViewMonth(monthFromWeekStart(selectedWeekStart));
    }
  }, [open, selectedWeekStart]);

  const earliestWeekStart = useMemo(() => earliestPlanningWeekStartISO(), []);

  const weeks = useMemo(
    () =>
      buildPlanningWeekPickerWeeks(
        viewMonth.year,
        viewMonth.month,
        todayISO,
        localeKey
      ),
    [viewMonth.month, viewMonth.year, todayISO, localeKey]
  );

  const holidayNames = useMemo(() => {
    const dates = weeks.flatMap((week) => week.days.map((day) => day.dateISO));
    return buildHolidayNamesByDate(dates, localeKey);
  }, [weeks, localeKey]);

  const monthLabel = useMemo(
    () => resolvePlanningWeekPickerMonthRangeLabel(weeks, viewMonth, intlLocale),
    [weeks, viewMonth, intlLocale]
  );

  const shiftMonth = useCallback((delta: number) => {
    setViewMonth((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }, []);

  const goToTodayMonth = useCallback(() => {
    setViewMonth(monthFromDateISO(todayISO));
  }, [todayISO]);

  const handleSelectWeek = useCallback(
    (weekStartISO: string) => {
      if (disabled || weekStartISO < earliestWeekStart) return;
      onSelectWeek(weekStartISO);
      onClose();
    },
    [disabled, earliestWeekStart, onClose, onSelectWeek]
  );

  if (!open) return null;

  return (
    <PlanningSidePanel
      anchor="left"
      title={t("common.weekPickerTitle")}
      titleId="planning-week-picker-title"
      onClose={onClose}
      closeAriaLabel={t("common.close")}
      dismissOnBackdrop
      dismissOnEscape
      panelClassName="max-w-md"
      bodyClassName="px-3 py-3 sm:px-4 sm:py-4"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm font-semibold capitalize leading-snug text-foreground">
            {monthLabel}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={disabled}
              aria-label={t("common.prevMonth")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={goToTodayMonth}
              disabled={disabled}
              className="rounded-sm px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
            >
              {t("common.today")}
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={disabled}
              aria-label={t("common.nextMonth")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div
            className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-x-0.5 text-center"
            role="presentation"
          >
            <div className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              KW
            </div>
            {weeks[0]?.days.map((day) => (
              <div
                key={`head-${day.weekdayShort}`}
                className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted"
              >
                {day.weekdayShort}
              </div>
            ))}
          </div>

          {weeks.map((week) => {
            const isSelected = week.weekStartISO === selectedWeekStart;
            const isDisabled = week.weekStartISO < earliestWeekStart;

            return (
              <button
                key={week.weekStartISO}
                type="button"
                disabled={disabled || isDisabled}
                aria-current={isSelected ? "date" : undefined}
                aria-label={t("common.weekPickerSelectWeek", {
                  week: String(week.calendarWeek),
                })}
                onClick={() => handleSelectWeek(week.weekStartISO)}
                className={cn(
                  "grid w-full grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-x-0.5 rounded-[5px] text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  isSelected
                    ? "bg-[color-mix(in_srgb,var(--brand-neon-cyan)_14%,white)] ring-1 ring-[color-mix(in_srgb,var(--brand-neon-cyan)_42%,transparent)]"
                    : "hover:bg-subtle/80",
                  isDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
                )}
              >
                <span className="flex items-center justify-center py-2 text-xs font-semibold tabular-nums text-foreground">
                  {week.calendarWeek}
                </span>
                {week.days.map((day) => {
                  const isRedDay = day.isSunday || day.isHoliday;
                  const holidayName = holidayNames[day.dateISO];

                  return (
                    <span
                      key={day.dateISO}
                      title={holidayName ?? undefined}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 py-2",
                        !day.inMonth && "opacity-35",
                        day.isToday &&
                          "rounded-[4px] bg-[color-mix(in_srgb,var(--brand-neon-cyan)_18%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--brand-neon-cyan)_55%,transparent)]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums leading-none",
                          isRedDay ? "text-red-600" : "text-foreground"
                        )}
                      >
                        {day.dayNumber}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase leading-none tracking-wide",
                          isRedDay ? "text-red-600/85" : "text-muted"
                        )}
                      >
                        {day.weekdayShort}
                      </span>
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    </PlanningSidePanel>
  );
}
