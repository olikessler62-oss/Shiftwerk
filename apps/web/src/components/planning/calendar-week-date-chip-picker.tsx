"use client";

import { formatDayHeader } from "@/lib/planning-utils";
import { cn } from "@/lib/cn";

type Props = {
  weekDates: readonly string[];
  selected: Set<string>;
  disabled?: boolean;
  intlLocale: string;
  onToggle: (date: string) => void;
};

export function CalendarWeekDateChipPicker({
  weekDates,
  selected,
  disabled,
  intlLocale,
  onToggle,
}: Props) {
  return (
    <div className="grid w-full grid-cols-7 gap-1.5">
      {weekDates.map((date) => {
        const { weekday, label } = formatDayHeader(date, intlLocale, "long");
        const isSelected = selected.has(date);
        const ariaLabel = `${weekday}, ${label}`;
        return (
          <button
            key={date}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={ariaLabel}
            className={cn(
              "flex min-w-0 flex-col items-center rounded border px-1 py-1 text-center transition-colors",
              isSelected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/80 bg-surface text-muted hover:bg-subtle hover:text-foreground",
              disabled && "opacity-50"
            )}
            onClick={() => onToggle(date)}
          >
            <span className="text-[11px] font-medium leading-tight">{weekday}</span>
            <span
              className={cn(
                "text-[10px] leading-tight",
                isSelected ? "text-foreground/80" : "text-muted"
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
