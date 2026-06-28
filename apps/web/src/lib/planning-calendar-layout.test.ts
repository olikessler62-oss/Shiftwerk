import { describe, expect, it } from "vitest";
import {
  resolveDashboardExpandedDayDates,
  resolveEmployeeCalendarLayoutDayDates,
} from "./planning-calendar-layout";

const CURRENT_WEEK_START = "2026-06-23";
const WEEK_DATES = [
  "2026-06-23",
  "2026-06-24",
  "2026-06-25",
  "2026-06-26",
  "2026-06-27",
  "2026-06-28",
  "2026-06-29",
];
const TODAY = "2026-06-25";

function shiftsByDate(entries: Record<string, number>) {
  return new Map(Object.entries(entries));
}

describe("resolveEmployeeCalendarLayoutDayDates", () => {
  const dayHasServiceHours = WEEK_DATES.map(() => true);

  it("collapses past days on first visit to the current week", () => {
    const expanded = resolveEmployeeCalendarLayoutDayDates(
      WEEK_DATES,
      dayHasServiceHours,
      shiftsByDate({}),
      new Set(),
      {
        weekStart: CURRENT_WEEK_START,
        currentWeekStart: CURRENT_WEEK_START,
        todayISO: TODAY,
        savedWeekExpansion: undefined,
      }
    );

    expect([...expanded]).toEqual([
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
    ]);
  });

  it("restores explicitly expanded days when returning to a week", () => {
    const savedWeekExpansion = new Set([
      "2026-06-23",
      "2026-06-25",
      "2026-06-27",
    ]);

    const expanded = resolveEmployeeCalendarLayoutDayDates(
      WEEK_DATES,
      dayHasServiceHours,
      shiftsByDate({}),
      new Set(),
      {
        weekStart: CURRENT_WEEK_START,
        currentWeekStart: CURRENT_WEEK_START,
        todayISO: TODAY,
        savedWeekExpansion,
      }
    );

    expect([...expanded].sort()).toEqual([...savedWeekExpansion].sort());
  });

  it("keeps all eligible days expanded on first visit to other weeks", () => {
    const nextWeekDates = [
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
    ];

    const expanded = resolveEmployeeCalendarLayoutDayDates(
      nextWeekDates,
      nextWeekDates.map(() => true),
      shiftsByDate({}),
      new Set(),
      {
        weekStart: "2026-06-30",
        currentWeekStart: CURRENT_WEEK_START,
        todayISO: TODAY,
        savedWeekExpansion: undefined,
      }
    );

    expect([...expanded]).toEqual(nextWeekDates);
  });

  it("still expands days with shifts even without service hours", () => {
    const dayHasServiceHours = WEEK_DATES.map(() => false);
    const expanded = resolveEmployeeCalendarLayoutDayDates(
      WEEK_DATES,
      dayHasServiceHours,
      shiftsByDate({ "2026-06-23": 1 }),
      new Set(),
      {
        weekStart: CURRENT_WEEK_START,
        currentWeekStart: CURRENT_WEEK_START,
        todayISO: TODAY,
        savedWeekExpansion: undefined,
      }
    );

    expect([...expanded]).not.toContain("2026-06-23");
    expect(resolveDashboardExpandedDayDates(
      WEEK_DATES,
      dayHasServiceHours,
      shiftsByDate({ "2026-06-23": 1 }),
      new Set()
    ).has("2026-06-23")).toBe(true);
  });
});
