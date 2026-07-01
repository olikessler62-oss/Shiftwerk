import { describe, expect, it } from "vitest";
import type { DashboardExtDaySnapshot } from "@/lib/dashboard-ext-panel-data";
import {
  dayCardAreaRowsMinHeightRem,
  dayCardEstimatedHeightRem,
  dayCardFooterHeightRem,
  dayCardHasShiftContent,
  dayCardMinHeightRem,
  weekTrayEmptyDayCardMinHeightRem,
} from "./dashboard-day-card-layout";

function daySnapshot(
  overrides: Partial<DashboardExtDaySnapshot> = {}
): DashboardExtDaySnapshot {
  return {
    dateISO: "2026-06-29",
    weekdayLabel: "Mo",
    isToday: false,
    isPast: false,
    shiftCount: 0,
    openSlots: 0,
    hasIssues: false,
    hasServiceHours: false,
    areas: [],
    confirmationCounts: {
      proposed: 0,
      requested: 0,
      pending: 0,
      rejected: 0,
      canceled: 0,
      unresolved: 0,
    },
    ...overrides,
  };
}

describe("dayCardAreaRowsMinHeightRem", () => {
  it("returns compact height for empty area list", () => {
    expect(dayCardAreaRowsMinHeightRem(0)).toBe(1.25);
  });

  it("grows linearly with area count", () => {
    expect(dayCardAreaRowsMinHeightRem(1)).toBe(1.5);
    expect(dayCardAreaRowsMinHeightRem(3)).toBe(5.5);
    expect(dayCardAreaRowsMinHeightRem(5)).toBe(9.5);
  });
});

describe("dayCardMinHeightRem", () => {
  it("matches minimum for three work sites including footer gap", () => {
    expect(dayCardMinHeightRem(3)).toBe(14.625);
  });

  it("increases with more work sites", () => {
    expect(dayCardMinHeightRem(5)).toBeGreaterThan(dayCardMinHeightRem(3));
    expect(dayCardMinHeightRem(1)).toBeLessThan(dayCardMinHeightRem(3));
  });
});

describe("dayCardHasShiftContent", () => {
  it("requires service hours and shifts", () => {
    expect(
      dayCardHasShiftContent(
        daySnapshot({ hasServiceHours: true, shiftCount: 2 })
      )
    ).toBe(true);
    expect(
      dayCardHasShiftContent(
        daySnapshot({ hasServiceHours: true, shiftCount: 0 })
      )
    ).toBe(false);
    expect(
      dayCardHasShiftContent(
        daySnapshot({ hasServiceHours: false, shiftCount: 2 })
      )
    ).toBe(false);
  });
});

describe("dayCardFooterHeightRem", () => {
  it("returns zero without sections", () => {
    expect(dayCardFooterHeightRem([])).toBe(0);
  });

  it("grows with footer lines", () => {
    const oneLine = dayCardFooterHeightRem([{ lines: [{}] }]);
    const twoLines = dayCardFooterHeightRem([{ lines: [{}, {}] }]);
    expect(twoLines).toBeGreaterThan(oneLine);
  });
});

describe("dayCardEstimatedHeightRem", () => {
  it("is taller with footer status lines than without", () => {
    const withoutFooter = dayCardEstimatedHeightRem(
      daySnapshot({
        hasServiceHours: true,
        shiftCount: 2,
        areas: [
          {
            areaId: "a1",
            areaName: "Bar",
            shiftCount: 2,
            openSlots: 0,
            ampelLevel: "green",
            staffingGauge: null,
            hasServiceHours: true,
            confirmationCounts: {
              proposed: 0,
              requested: 0,
              pending: 0,
              rejected: 0,
              canceled: 0,
              unresolved: 0,
            },
            swapRequestedCount: 0,
          },
        ],
      }),
      true
    );

    const withFooter = dayCardEstimatedHeightRem(
      daySnapshot({
        hasServiceHours: true,
        shiftCount: 2,
        areas: [
          {
            areaId: "a1",
            areaName: "Bar",
            shiftCount: 2,
            openSlots: 3,
            ampelLevel: "red",
            staffingGauge: null,
            hasServiceHours: true,
            confirmationCounts: {
              proposed: 0,
              requested: 0,
              pending: 0,
              rejected: 0,
              canceled: 0,
              unresolved: 0,
            },
            swapRequestedCount: 0,
          },
        ],
      }),
      true
    );

    expect(withFooter).toBeGreaterThan(withoutFooter);
  });
});

describe("weekTrayEmptyDayCardMinHeightRem", () => {
  it("falls back to planning area count when no shift days exist", () => {
    expect(
      weekTrayEmptyDayCardMinHeightRem(
        [daySnapshot(), daySnapshot({ hasServiceHours: true, shiftCount: 0 })],
        true,
        3
      )
    ).toBe(dayCardMinHeightRem(3));
  });

  it("uses the shortest shift day height as reference", () => {
    const compactShiftDay = daySnapshot({
      hasServiceHours: true,
      shiftCount: 1,
      areas: [
        {
          areaId: "a1",
          areaName: "Bar",
          shiftCount: 1,
          openSlots: 0,
          ampelLevel: "green",
          staffingGauge: null,
          hasServiceHours: true,
          confirmationCounts: {
            proposed: 0,
            requested: 0,
            pending: 0,
            rejected: 0,
            canceled: 0,
            unresolved: 0,
          },
          swapRequestedCount: 0,
        },
      ],
    });

    const tallShiftDay = daySnapshot({
      hasServiceHours: true,
      shiftCount: 4,
      areas: [
        {
          areaId: "a1",
          areaName: "Bar",
          shiftCount: 2,
          openSlots: 2,
          ampelLevel: "red",
          staffingGauge: null,
          hasServiceHours: true,
          confirmationCounts: {
            proposed: 0,
            requested: 0,
            pending: 0,
            rejected: 0,
            canceled: 0,
            unresolved: 0,
          },
          swapRequestedCount: 0,
        },
        {
          areaId: "a2",
          areaName: "Küche",
          shiftCount: 2,
          openSlots: 1,
          ampelLevel: "yellow",
          staffingGauge: null,
          hasServiceHours: true,
          confirmationCounts: {
            proposed: 1,
            requested: 0,
            pending: 0,
            rejected: 0,
            canceled: 0,
            unresolved: 0,
          },
          swapRequestedCount: 0,
        },
      ],
    });

    const reference = weekTrayEmptyDayCardMinHeightRem(
      [compactShiftDay, tallShiftDay, daySnapshot()],
      true,
      5
    );

    expect(reference).toBe(dayCardEstimatedHeightRem(compactShiftDay, true));
    expect(reference).toBeLessThan(dayCardEstimatedHeightRem(tallShiftDay, true));
  });
});
