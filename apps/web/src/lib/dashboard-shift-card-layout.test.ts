import { describe, expect, it } from "vitest";
import {
  DASHBOARD_SHIFT_CARD_MAX_CELL_WIDTH_RATIO,
  dashboardShiftCardTrackWidthPx,
} from "@/lib/planning-calendar-layout";

describe("dashboardShiftCardTrackWidthPx", () => {
  it("caps shift cards at 80% of the cell inner width", () => {
    expect(DASHBOARD_SHIFT_CARD_MAX_CELL_WIDTH_RATIO).toBe(0.8);
    expect(dashboardShiftCardTrackWidthPx(200)).toBe(160);
    expect(dashboardShiftCardTrackWidthPx(0)).toBe(0);
  });
});
