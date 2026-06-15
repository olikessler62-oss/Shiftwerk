import { describe, expect, it } from "vitest";
import {
  collectDashboardOvernightSpansForArea,
  dashboardOvernightAnchorShiftIds,
  isDashboardOvernightShift,
  isDashboardOvernightSpanRenderable,
  resolveDashboardOvernightSpanDisplayMode,
} from "./dashboard-overnight-shift-display";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";

function overnightShift(
  overrides: Partial<DashboardShiftCard> = {}
): DashboardShiftCard {
  return {
    id: "s1",
    shift_date: "2026-06-02",
    locationAreaId: "a1",
    areaShiftTemplateId: null,
    employeeId: "e1",
    shiftName: "Nacht",
    color: "#000",
    startTime: "22:00",
    endTime: "04:00",
    employeeName: "Max Mustermann",
    employeeColor: "#336699",
    ...overrides,
  };
}

describe("isDashboardOvernightShift", () => {
  it("detects overnight windows", () => {
    expect(isDashboardOvernightShift("22:00", "04:00")).toBe(true);
    expect(isDashboardOvernightShift("08:00", "16:00")).toBe(false);
  });
});

describe("collectDashboardOvernightSpansForArea", () => {
  it("collects spans for overnight shifts on consecutive days", () => {
    const spans = collectDashboardOvernightSpansForArea(
      "a1",
      ["2026-06-02", "2026-06-03"],
      [overnightShift()]
    );

    expect(spans).toHaveLength(1);
    expect(spans[0]?.startDate).toBe("2026-06-02");
    expect(spans[0]?.endDate).toBe("2026-06-03");
  });

  it("omits spans when the next day is outside the week", () => {
    const spans = collectDashboardOvernightSpansForArea(
      "a1",
      ["2026-06-02"],
      [overnightShift()]
    );
    expect(spans).toHaveLength(0);
  });
});

describe("isDashboardOvernightSpanRenderable", () => {
  it("requires both start and end day in the calendar", () => {
    expect(
      isDashboardOvernightSpanRenderable(
        overnightShift(),
        ["2026-06-02", "2026-06-03"]
      )
    ).toBe(true);
    expect(
      isDashboardOvernightSpanRenderable(overnightShift(), ["2026-06-02"])
    ).toBe(false);
  });
});

describe("dashboardOvernightAnchorShiftIds", () => {
  it("returns ids for renderable overnight shifts only", () => {
    const ids = dashboardOvernightAnchorShiftIds(
      [overnightShift(), overnightShift({ id: "s2", startTime: "08:00", endTime: "16:00" })],
      ["2026-06-02", "2026-06-03"]
    );
    expect([...ids]).toEqual(["s1"]);
  });
});

describe("resolveDashboardOvernightSpanDisplayMode", () => {
  const span = {
    areaId: "a1",
    startDate: "2026-06-02",
    endDate: "2026-06-03",
  };

  it("is collapsed when the area row is collapsed", () => {
    expect(
      resolveDashboardOvernightSpanDisplayMode(
        span,
        new Set(["2026-06-02", "2026-06-03"]),
        new Set()
      )
    ).toBe("collapsed");
  });

  it("is expanded when either day is expanded", () => {
    expect(
      resolveDashboardOvernightSpanDisplayMode(
        span,
        new Set(["2026-06-02"]),
        new Set(["a1"])
      )
    ).toBe("expanded");
  });

  it("respects forceAreaExpanded for simple planning", () => {
    expect(
      resolveDashboardOvernightSpanDisplayMode(
        { ...span, areaId: "" },
        new Set(["2026-06-02"]),
        new Set(),
        { forceAreaExpanded: true }
      )
    ).toBe("expanded");
  });
});
