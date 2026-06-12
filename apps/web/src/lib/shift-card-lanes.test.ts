import { describe, expect, it } from "vitest";
import {
  assignShiftCardLanes,
  assignShiftCardVisualLanes,
  countShiftCardLanes,
  countShiftCardVisualSubRows,
  packShiftCardVisualSubRows,
  shiftClockWindowsOverlap,
} from "./shift-card-lanes";

describe("shift-card-lanes", () => {
  it("treats touching windows as non-overlapping", () => {
    expect(shiftClockWindowsOverlap("06:00", "12:00", "12:00", "15:00")).toBe(
      false
    );
    expect(shiftClockWindowsOverlap("06:00", "12:00", "11:00", "15:00")).toBe(
      true
    );
  });

  it("places non-overlapping shifts on the same lane", () => {
    const shifts = [
      { id: "a", startTime: "06:00", endTime: "12:00" },
      { id: "b", startTime: "12:00", endTime: "15:00" },
      { id: "c", startTime: "08:00", endTime: "17:00" },
    ];
    const lanes = assignShiftCardLanes(shifts);
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(0);
    expect(lanes.get("c")).toBe(1);
    expect(countShiftCardLanes(shifts)).toBe(2);
  });

  it("uses separate lanes for overlapping shifts", () => {
    const shifts = [
      { id: "a", startTime: "08:00", endTime: "12:00" },
      { id: "b", startTime: "10:00", endTime: "14:00" },
    ];
    const lanes = assignShiftCardLanes(shifts);
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(1);
    expect(countShiftCardLanes(shifts)).toBe(2);
  });

  it("separates visual sub-rows when min-width cards overlap in the same time lane", () => {
    const shifts = [
      {
        id: "frueh",
        startTime: "06:00",
        endTime: "12:00",
        marginLeftPx: 4,
        widthPx: 180,
      },
      {
        id: "mittag",
        startTime: "12:00",
        endTime: "15:00",
        marginLeftPx: 120,
        widthPx: 120,
      },
    ];
    const subRows = packShiftCardVisualSubRows(shifts);
    expect(subRows.get("frueh")).toBe(0);
    expect(subRows.get("mittag")).toBe(1);
    expect(countShiftCardVisualSubRows(shifts)).toBe(2);
  });
});
