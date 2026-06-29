import { describe, expect, it } from "vitest";
import {
  shiftNetWorkHours,
  shiftNetWorkMinutes,
  totalBreakMinutesOnShiftTimeline,
} from "./shift-type-break-rules";

describe("shift net work hours", () => {
  it("subtracts break minutes from gross shift duration", () => {
    const breaks = [{ break_start: "13:00", break_end: "14:00" }];
    expect(totalBreakMinutesOnShiftTimeline(breaks, "08:00", "17:00")).toBe(60);
    expect(shiftNetWorkMinutes("08:00", "17:00", breaks)).toBe(480);
    expect(shiftNetWorkHours("08:00", "17:00", breaks)).toBe(8);
  });

  it("returns gross duration when no breaks are defined", () => {
    expect(shiftNetWorkHours("09:00", "17:00")).toBe(8);
  });
});
