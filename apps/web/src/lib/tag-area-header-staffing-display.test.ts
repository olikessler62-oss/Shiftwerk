import { describe, expect, it } from "vitest";
import {
  resolveStaffingHeaderDisplay,
  type StaffingHeaderSegment,
} from "./tag-area-header-staffing-display";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

function entry(
  id: string,
  assigned: number,
  required: number
): TagAreaHeaderStaffingEntry {
  return {
    serviceHourId: id,
    label: "08:00–12:00",
    calendarTimeLabel: "08:00–12:00",
    assigned,
    required,
  };
}

describe("resolveStaffingHeaderDisplay", () => {
  it("shows indicator when counts-only text would overflow", () => {
    const entries = [
      entry("a", 0, 4),
      entry("b", 0, 4),
      entry("c", 0, 4),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 72, (text) => text.length * 6);

    expect(display).toEqual({ mode: "indicator", allMet: false });
  });

  it("shows text mode when width is sufficient for count groups", () => {
    const entries = [entry("a", 0, 4), entry("b", 0, 4)];

    const display = resolveStaffingHeaderDisplay(entries, 200, (text) => text.length * 6);

    expect(display.mode).toBe("segments");
    if (display.mode === "segments") {
      expect(display.level).toBe("counts-only");
    }
  });

  it("uses indicator when understaffed-only text does not fit", () => {
    const entries = [
      entry("a", 0, 4),
      entry("b", 4, 4),
      entry("c", 0, 4),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 60, (text) => text.length * 6);

    expect(display).toEqual({ mode: "indicator", allMet: false });
  });
});

describe("staffing header segment helpers", () => {
  it("exports segment shape used by overlay", () => {
    const segment: StaffingHeaderSegment = {
      serviceHourId: "x",
      timeText: null,
      countText: "0/4",
      measureText: "0/4",
      understaffed: true,
    };
    expect(segment.countText).toBe("0/4");
  });
});
