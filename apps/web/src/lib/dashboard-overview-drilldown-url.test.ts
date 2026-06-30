import { describe, expect, it } from "vitest";
import {
  buildDashboardOverviewDrilldownHref,
  buildDashboardOverviewDrilldownSearchParams,
  readDashboardOverviewDrilldownFromSearchParams,
  resolveDashboardOverviewViewFromSearchParams,
} from "./dashboard-overview-drilldown-url";

const WEEK_DATES = [
  "2026-06-23",
  "2026-06-24",
  "2026-06-25",
  "2026-06-26",
  "2026-06-27",
  "2026-06-28",
  "2026-06-29",
] as const;

function params(input: string): URLSearchParams {
  return new URLSearchParams(input);
}

describe("dashboard-overview-drilldown-url", () => {
  it("returns week view without day param", () => {
    expect(
      resolveDashboardOverviewViewFromSearchParams(
        params("week=2026-06-23"),
        WEEK_DATES
      )
    ).toEqual({ level: "week" });
  });

  it("resolves day drilldown from ISO date in the active week", () => {
    expect(
      resolveDashboardOverviewViewFromSearchParams(
        params("week=2026-06-23&day=2026-06-25"),
        WEEK_DATES
      )
    ).toEqual({ level: "day", dayIndex: 2 });
  });

  it("ignores day params outside the active week", () => {
    expect(
      readDashboardOverviewDrilldownFromSearchParams(
        params("week=2026-06-23&day=2026-07-01"),
        WEEK_DATES
      )
    ).toEqual({ dayISO: null, focusAreaId: null });
  });

  it("builds and clears drilldown query params", () => {
    const base = params("week=2026-06-23&location=loc-1");

    expect(
      buildDashboardOverviewDrilldownHref(pathname, base, {
        dayISO: "2026-06-24",
        focusAreaId: "area-2",
      })
    ).toBe(
      "/dashboard?week=2026-06-23&location=loc-1&day=2026-06-24&focusArea=area-2"
    );

    const cleared = buildDashboardOverviewDrilldownSearchParams(
      buildDashboardOverviewDrilldownSearchParams(base, {
        dayISO: "2026-06-24",
        focusAreaId: "area-2",
      }),
      { dayISO: null, focusAreaId: null }
    );

    expect(cleared.toString()).toBe("week=2026-06-23&location=loc-1");
  });
});

const pathname = "/dashboard";
