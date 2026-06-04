"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { startOfWeek, toISODate, parseISODate } from "@/lib/dates";
import { getDashboardWeekHeaderParts } from "@/lib/planning-utils";
import { Button, ControlDisplay, IconButton } from "@/components/ui";

type Props = {
  weekStart: string;
};

export function DashboardHeader({ weekStart }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const weekHeader = useMemo(
    () => getDashboardWeekHeaderParts(weekStart),
    [weekStart]
  );

  function navigateWeek(delta: number) {
    const d = parseISODate(weekStart);
    d.setDate(d.getDate() + delta * 7);
    startTransition(() => {
      router.push(`/dashboard?week=${toISODate(d)}`);
    });
  }

  function goToToday() {
    startTransition(() => {
      router.push(`/dashboard?week=${toISODate(startOfWeek(new Date()))}`);
    });
  }

  return (
    <header className="flex h-20 max-h-20 shrink-0 items-center border-b border-border bg-surface px-6">
      <div className="flex items-center gap-2">
        <IconButton
          size="md"
          onClick={() => navigateWeek(-1)}
          disabled={pending}
          aria-label="Vorherige Woche"
          className="text-muted"
        >
          <ChevronIcon direction="left" />
        </IconButton>

        <ControlDisplay className="w-fit shrink-0 whitespace-nowrap px-3 py-2">
          <span className="text-sm">
            {weekHeader.rangeLabel}{" "}
            <span className="font-semibold">{weekHeader.year}</span>
            <span className="ml-1.5 text-xs font-normal text-muted">
              KW {weekHeader.calendarWeek}
            </span>
          </span>
        </ControlDisplay>

        <IconButton
          size="md"
          onClick={() => navigateWeek(1)}
          disabled={pending}
          aria-label="Nächste Woche"
          className="text-muted"
        >
          <ChevronIcon direction="right" />
        </IconButton>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={goToToday}
          disabled={pending}
          className="font-semibold"
        >
          Heute
        </Button>
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
