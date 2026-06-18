import { describe, expect, it } from "vitest";
import { resolveCalendarStaffingTimeLabel, compactStaffingTimeRangeLabel } from "@/lib/location-staffing-client";
import {
  resolveStaffingHeaderDisplay,
  STAFFING_FILL_GAUGE_SIZE_PX,
  type StaffingHeaderSegment,
} from "./tag-area-header-staffing-display";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

function entry(
  id: string,
  assigned: number,
  required: number,
  shiftTemplateLabel?: string
): TagAreaHeaderStaffingEntry {
  return {
    serviceHourId: id,
    label: "08:00–12:00",
    calendarTimeLabel: "08:00–12:00",
    shiftTemplateLabel,
    assigned,
    required,
  };
}

describe("resolveCalendarStaffingTimeLabel", () => {
  it("prefers shift template name over time in calendar overlay", () => {
    expect(
      resolveCalendarStaffingTimeLabel({
        label: "Do 08:00–10:00",
        calendarTimeLabel: "08:00-10:00 Uhr",
        shiftTemplateLabel: "Früh",
      })
    ).toBe("Früh");
  });

  it("compacts spaces around time range dashes when no template matches", () => {
    expect(
      resolveCalendarStaffingTimeLabel({
        label: "Do 08:00 - 10:00 Uhr",
        calendarTimeLabel: "08:00 - 10:00 Uhr",
      })
    ).toBe("08:00-10:00 Uhr");
  });

  it("compacts spaces around pipe symbols in combined labels", () => {
    expect(
      compactStaffingTimeRangeLabel("Früh: 0/1 | Spät: 0/1")
    ).toBe("Früh: 0/1|Spät: 0/1");
  });
});

describe("resolveStaffingHeaderDisplay", () => {
  it("shows full gauges with labels when width is sufficient", () => {
    const entries = [entry("a", 0, 1, "Früh")];

    const display = resolveStaffingHeaderDisplay(entries, 120);

    expect(display).toEqual({
      mode: "gauges",
      level: "full-schicht",
      segments: [
        expect.objectContaining({
          serviceHourId: "a",
          timeText: "Früh",
          countText: "0/1",
          assigned: 0,
          required: 1,
          understaffed: true,
        }),
      ],
    });
  });

  it("falls back to count-only gauges when labels do not fit", () => {
    const entries = [
      entry("a", 0, 4, "Früh"),
      entry("b", 0, 4, "Spät"),
      entry("c", 0, 4, "Nacht"),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 110);

    expect(display.mode).toBe("gauges");
    if (display.mode === "gauges") {
      expect(display.level).toBe("counts-only");
      expect(display.segments.every((segment) => segment.timeText === null)).toBe(
        true
      );
    }
  });

  it("shows indicator when even count-only gauges would overflow", () => {
    const entries = [
      entry("a", 0, 4),
      entry("b", 0, 4),
      entry("c", 0, 4),
      entry("d", 0, 4),
      entry("e", 0, 4),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 72);

    expect(display).toEqual({ mode: "indicator", allMet: false });
  });

  it("uses indicator with allMet when fully staffed but cramped", () => {
    const entries = [
      entry("a", 4, 4),
      entry("b", 4, 4),
      entry("c", 4, 4),
      entry("d", 4, 4),
      entry("e", 4, 4),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 72);

    expect(display).toEqual({ mode: "indicator", allMet: true });
  });
});

describe("staffing header segment helpers", () => {
  it("exports segment shape used by overlay", () => {
    const segment: StaffingHeaderSegment = {
      serviceHourId: "x",
      timeText: "Früh",
      countText: "0/4",
      measureText: "Früh: 0/4",
      understaffed: true,
      assigned: 0,
      required: 4,
    };
    expect(segment.countText).toBe("0/4");
    expect(STAFFING_FILL_GAUGE_SIZE_PX).toBe(24);
  });
});
