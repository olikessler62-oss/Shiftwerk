import { describe, expect, it } from "vitest";
import {
  buildPlanningShiftsByCellDisplay,
  collectPlanningOvernightSpansForEmployee,
  filterPlanningCellSegmentsForRendering,
  isPlanningOvernightShift,
  isPlanningOvernightSpanRenderable,
  planningCollapsedOvernightSegmentWidthPx,
  planningOvernightShiftEndDateISO,
  planningShiftSegmentMaxWidthPx,
  planningShiftSegmentAlignTimeRight,
  planningShiftSegmentShowsEmployeeStrip,
  canOpenPlanningOvernightShiftContextMenu,
  resolvePlanningOvernightShiftContextMenuDate,
  resolveOvernightSpanDisplayMode,
} from "./planning-overnight-shift-display";

describe("isPlanningOvernightShift", () => {
  it("detects overnight windows", () => {
    expect(isPlanningOvernightShift("22:00", "04:00")).toBe(true);
    expect(isPlanningOvernightShift("08:00", "16:00")).toBe(false);
  });
});

describe("buildPlanningShiftsByCellDisplay", () => {
  const shift = {
    id: "s1",
    employee_id: "e1",
    shift_date: "2026-06-02",
    shiftName: "Nacht",
    color: "#000",
    startTime: "22:00",
    endTime: "04:00",
    location_area_id: "a1",
    area_shift_template_id: null,
  };

  it("splits overnight shifts across start and next day", () => {
    const map = buildPlanningShiftsByCellDisplay(
      ["2026-06-02", "2026-06-03", "2026-06-04"],
      [shift]
    );

    expect(map.get("e1:2026-06-02")).toEqual([
      { shift, part: "overnight-start" },
    ]);
    expect(map.get("e1:2026-06-03")).toEqual([
      { shift, part: "overnight-end" },
    ]);
  });

  it("omits end segment when next day is outside the week", () => {
    const map = buildPlanningShiftsByCellDisplay(["2026-06-02"], [shift]);
    expect(map.get("e1:2026-06-02")).toHaveLength(1);
    expect(map.has("e1:2026-06-03")).toBe(false);
  });
});

describe("planningOvernightShiftEndDateISO", () => {
  it("returns next calendar day for overnight shifts", () => {
    expect(
      planningOvernightShiftEndDateISO("2026-06-02", "22:00", "04:00")
    ).toBe("2026-06-03");
  });
});

describe("planningShiftSegmentMaxWidthPx", () => {
  it("caps split segments at half the layout width", () => {
    expect(planningShiftSegmentMaxWidthPx(200, "overnight-start")).toBe(100);
    expect(planningShiftSegmentMaxWidthPx(200, "full")).toBe(200);
  });
});

describe("planningCollapsedOvernightSegmentWidthPx", () => {
  it("quarters overnight marker width for collapsed cells", () => {
    expect(
      planningCollapsedOvernightSegmentWidthPx(40, 200, "overnight-start")
    ).toBe(10);
    expect(planningCollapsedOvernightSegmentWidthPx(40, 200, "full")).toBe(40);
  });
});

describe("planningShiftSegmentShowsEmployeeStrip", () => {
  it("hides strip on overnight end segments", () => {
    expect(planningShiftSegmentShowsEmployeeStrip("overnight-end")).toBe(false);
    expect(planningShiftSegmentShowsEmployeeStrip("overnight-start")).toBe(true);
    expect(planningShiftSegmentShowsEmployeeStrip("full")).toBe(true);
  });
});

describe("planningShiftSegmentAlignTimeRight", () => {
  it("right-aligns time only on overnight start segments", () => {
    expect(planningShiftSegmentAlignTimeRight("overnight-start")).toBe(true);
    expect(planningShiftSegmentAlignTimeRight("overnight-end")).toBe(false);
    expect(planningShiftSegmentAlignTimeRight("full")).toBe(false);
  });
});

const overnightShift = {
  id: "s1",
  employee_id: "e1",
  shift_date: "2026-06-02",
  shiftName: "Nacht",
  color: "#000",
  startTime: "22:00",
  endTime: "04:00",
  location_area_id: "a1",
  area_shift_template_id: null,
};

describe("isPlanningOvernightSpanRenderable", () => {
  it("requires start and end day in the visible week", () => {
    expect(
      isPlanningOvernightSpanRenderable(overnightShift, [
        "2026-06-02",
        "2026-06-03",
      ])
    ).toBe(true);
    expect(
      isPlanningOvernightSpanRenderable(overnightShift, ["2026-06-02"])
    ).toBe(false);
  });
});

describe("collectPlanningOvernightSpansForEmployee", () => {
  it("collects renderable overnight spans for an employee", () => {
    const spans = collectPlanningOvernightSpansForEmployee(
      "e1",
      ["2026-06-02", "2026-06-03"],
      [overnightShift]
    );
    expect(spans).toHaveLength(1);
    expect(spans[0]?.startDate).toBe("2026-06-02");
    expect(spans[0]?.endDate).toBe("2026-06-03");
  });
});

describe("filterPlanningCellSegmentsForRendering", () => {
  it("removes overnight split segments when span overlay is used", () => {
    const filtered = filterPlanningCellSegmentsForRendering(
      [
        { shift: overnightShift, part: "overnight-start" },
        {
          shift: {
            ...overnightShift,
            id: "s2",
            startTime: "08:00",
            endTime: "16:00",
          },
          part: "full",
        },
      ],
      ["2026-06-02", "2026-06-03"]
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.part).toBe("full");
  });
});

describe("resolveOvernightSpanDisplayMode", () => {
  const span = {
    shift: overnightShift,
    startDate: "2026-06-02",
    endDate: "2026-06-03",
    startDayIndex: 0,
    endDayIndex: 1,
  };

  it("uses expanded card when either day is expanded", () => {
    expect(
      resolveOvernightSpanDisplayMode(span, new Set(["2026-06-02"]))
    ).toBe("expanded");
    expect(
      resolveOvernightSpanDisplayMode(span, new Set(["2026-06-03"]))
    ).toBe("expanded");
    expect(resolveOvernightSpanDisplayMode(span, new Set())).toBe("collapsed");
  });
});

describe("planning overnight shift context menu", () => {
  const span = {
    shift: {
      id: "s1",
      employee_id: "e1",
      shift_date: "2026-06-16",
      shiftName: "Früh",
      color: "#000",
      startTime: "22:00",
      endTime: "06:00",
      location_area_id: "a1",
      area_shift_template_id: "t1",
      confirmationStatus: "pending" as const,
    },
    startDate: "2026-06-16",
    endDate: "2026-06-17",
  };

  it("allows context menu when only the end day is still interactable", () => {
    expect(
      canOpenPlanningOvernightShiftContextMenu(span, {
        todayISO: "2026-06-17",
        isDayReadOnly: () => false,
      })
    ).toBe(true);
  });

  it("prefers the clicked day when it is interactable", () => {
    expect(
      resolvePlanningOvernightShiftContextMenuDate(span, "2026-06-17", {
        todayISO: "2026-06-17",
        isDayReadOnly: () => false,
      })
    ).toBe("2026-06-17");
  });

  it("allows context menu for past unconfirmed overnight shifts", () => {
    expect(
      canOpenPlanningOvernightShiftContextMenu(span, {
        todayISO: "2026-06-18",
        isDayReadOnly: () => true,
        pastUnconfirmedMenu: {
          shiftDate: span.shift.shift_date,
          isPastShiftDate: (date) => date < "2026-06-18",
        },
      })
    ).toBe(true);
  });
});
