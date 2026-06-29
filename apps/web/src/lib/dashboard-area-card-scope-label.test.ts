import { describe, expect, it } from "vitest";
import {
  formatDashboardAreaCardDayDate,
  formatDashboardAreaCardWeekRange,
  resolveDashboardAreaCardScopeDateISO,
  resolveDashboardAreaCardScopeDateLabel,
  resolveDashboardAreaStatsDates,
} from "./dashboard-area-card-scope-label";

describe("dashboard-area-card-scope-label", () => {
  it("formats a single day for area card headers", () => {
    expect(formatDashboardAreaCardDayDate("2026-06-22", "de")).toBe("Mo. 22. Jun");
    expect(formatDashboardAreaCardDayDate("2026-06-22", "en-GB")).toBe("Mon 22. Jun");
  });

  it("formats a week range for area card headers", () => {
    expect(formatDashboardAreaCardWeekRange("2026-06-22", "de")).toBe(
      "22. Jun - 28.Jun"
    );
  });

  it("resolves day and week labels for the active scope", () => {
    expect(
      resolveDashboardAreaCardScopeDateLabel(
        "day",
        "2026-06-22",
        "2026-06-22",
        "de"
      )
    ).toBe("Mo. 22. Jun");
    expect(
      resolveDashboardAreaCardScopeDateLabel(
        "week",
        "2026-06-22",
        "2026-06-22",
        "de"
      )
    ).toBe("22. Jun - 28.Jun");
  });

  it("uses the drilldown day for day scope", () => {
    expect(
      resolveDashboardAreaCardScopeDateISO("day", {
        drilldownDayISO: "2026-06-24",
        weekStartISO: "2026-06-22",
      })
    ).toBe("2026-06-24");
  });

  it("uses week start for week scope labels", () => {
    expect(
      resolveDashboardAreaCardScopeDateISO("week", {
        drilldownDayISO: "2026-06-24",
        weekStartISO: "2026-06-22",
      })
    ).toBe("2026-06-22");
  });

  it("resolves stats dates for day and week scope", () => {
    const weekDates = ["2026-06-22", "2026-06-23", "2026-06-24"];

    expect(
      resolveDashboardAreaStatsDates("day", {
        drilldownDayISO: "2026-06-24",
        weekDates,
      })
    ).toEqual(["2026-06-24"]);

    expect(
      resolveDashboardAreaStatsDates("week", {
        drilldownDayISO: "2026-06-24",
        weekDates,
      })
    ).toEqual(weekDates);
  });
});
