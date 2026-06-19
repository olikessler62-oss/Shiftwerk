import { describe, expect, it } from "vitest";
import {
  buildAreaCalendarCellShiftRows,
  collectAreaCalendarIncomingOvernightTailRowsByIndex,
  collectAreaCalendarOvernightSpansForArea,
  countAreaCalendarCellVisualRows,
  areaCalendarOvernightAnchorShiftIds,
  isAreaCalendarOvernightShift,
  isAreaCalendarOvernightSpanRenderable,
  resolveAreaCalendarOvernightSpanDisplayMode,
  resolveAreaCalendarOvernightStartDayRowIndex,
} from "./areacalendar-overnight-shift-display";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";

function overnightShift(
  overrides: Partial<AreaCalendarShiftCard> = {}
): AreaCalendarShiftCard {
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

describe("isAreaCalendarOvernightShift", () => {
  it("detects overnight windows", () => {
    expect(isAreaCalendarOvernightShift("22:00", "04:00")).toBe(true);
    expect(isAreaCalendarOvernightShift("08:00", "16:00")).toBe(false);
  });
});

describe("collectAreaCalendarOvernightSpansForArea", () => {
  it("collects spans for overnight shifts on consecutive days", () => {
    const spans = collectAreaCalendarOvernightSpansForArea(
      "a1",
      ["2026-06-02", "2026-06-03"],
      [overnightShift()]
    );

    expect(spans).toHaveLength(1);
    expect(spans[0]?.startDate).toBe("2026-06-02");
    expect(spans[0]?.endDate).toBe("2026-06-03");
  });

  it("omits spans when the next day is outside the week", () => {
    const spans = collectAreaCalendarOvernightSpansForArea(
      "a1",
      ["2026-06-02"],
      [overnightShift()]
    );
    expect(spans).toHaveLength(0);
  });
});

describe("isAreaCalendarOvernightSpanRenderable", () => {
  it("requires both start and end day in the calendar", () => {
    expect(
      isAreaCalendarOvernightSpanRenderable(
        overnightShift(),
        ["2026-06-02", "2026-06-03"]
      )
    ).toBe(true);
    expect(
      isAreaCalendarOvernightSpanRenderable(overnightShift(), ["2026-06-02"])
    ).toBe(false);
  });
});

describe("areaCalendarOvernightAnchorShiftIds", () => {
  it("returns ids for renderable overnight shifts only", () => {
    const ids = areaCalendarOvernightAnchorShiftIds(
      [overnightShift(), overnightShift({ id: "s2", startTime: "08:00", endTime: "16:00" })],
      ["2026-06-02", "2026-06-03"]
    );
    expect([...ids]).toEqual(["s1"]);
  });
});

describe("resolveAreaCalendarOvernightSpanDisplayMode", () => {
  const span = {
    areaId: "a1",
    startDate: "2026-06-02",
    endDate: "2026-06-03",
  };

  it("is collapsed when the area row is collapsed", () => {
    expect(
      resolveAreaCalendarOvernightSpanDisplayMode(
        span,
        new Set(["2026-06-02", "2026-06-03"]),
        new Set()
      )
    ).toBe("collapsed");
  });

  it("is expanded when either day is expanded", () => {
    expect(
      resolveAreaCalendarOvernightSpanDisplayMode(
        span,
        new Set(["2026-06-02"]),
        new Set(["a1"])
      )
    ).toBe("expanded");
  });

  it("respects forceAreaExpanded for simple planning", () => {
    expect(
      resolveAreaCalendarOvernightSpanDisplayMode(
        { ...span, areaId: "" },
        new Set(["2026-06-02"]),
        new Set(),
        { forceAreaExpanded: true }
      )
    ).toBe("expanded");
  });
});

describe("buildAreaCalendarCellShiftRows", () => {
  const dayShift = (id: string, startTime: string, endTime: string) =>
    overnightShift({
      id,
      startTime,
      endTime,
      shift_date: "2026-06-03",
    });

  it("places same-day shifts below incoming overnight tail row", () => {
    const overnight = overnightShift();
    const morning = dayShift("s2", "08:00", "12:00");
    const rows = buildAreaCalendarCellShiftRows([morning], {
      incomingOvernightTailRowsByIndex: new Map([[0, overnight.id]]),
    });

    expect(rows.map((row) => row.kind)).toEqual([
      "overnight-tail-spacer",
      "shift",
    ]);
  });

  it("inserts row gaps before a higher tail row when needed", () => {
    const overnight = overnightShift();
    const rows = buildAreaCalendarCellShiftRows([], {
      incomingOvernightTailRowsByIndex: new Map([[1, overnight.id]]),
    });

    expect(rows.map((row) => row.kind)).toEqual(["row-gap", "overnight-tail-spacer"]);
  });

  it("keeps overnight anchor in sorted position on start day", () => {
    const overnight = overnightShift();
    const morning = dayShift("s2", "08:00", "12:00");
    const rows = buildAreaCalendarCellShiftRows([morning, overnight], {
      overnightAnchorShiftIds: new Set([overnight.id]),
    });

    expect(rows.map((row) => row.kind)).toEqual(["shift", "overnight-anchor"]);
  });
});

describe("collectAreaCalendarIncomingOvernightTailRowsByIndex", () => {
  it("maps end-day tail rows from start-day order", () => {
    const overnight = overnightShift();
    const morning = overnightShift({
      id: "s2",
      startTime: "08:00",
      endTime: "16:00",
      shift_date: "2026-06-02",
    });
    const spans = collectAreaCalendarOvernightSpansForArea(
      "a1",
      ["2026-06-02", "2026-06-03"],
      [morning, overnight]
    );

    expect(
      resolveAreaCalendarOvernightStartDayRowIndex(spans[0]!, [morning, overnight])
    ).toBe(1);

    const tailRows = collectAreaCalendarIncomingOvernightTailRowsByIndex(
      "a1",
      "2026-06-03",
      spans,
      (startDate) =>
        startDate === "2026-06-02" ? [morning, overnight] : []
    );

    expect([...tailRows.entries()]).toEqual([[1, overnight.id]]);
    expect(
      countAreaCalendarCellVisualRows(
        [
          overnightShift({
            id: "s3",
            startTime: "09:00",
            endTime: "13:00",
            shift_date: "2026-06-03",
          }),
        ],
        {
          incomingOvernightTailRowsByIndex: tailRows,
        }
      )
    ).toBe(2);
  });
});
