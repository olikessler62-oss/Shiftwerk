import { describe, expect, it } from "vitest";
import {
  resolveStaffingTableStaffingColumnWidthPx,
  staffingTableOverlapMinWidthPx,
} from "./use-staffing-table-headers-fit";

describe("resolveStaffingTableStaffingColumnWidthPx", () => {
  it("keeps fallback width for short labels", () => {
    expect(resolveStaffingTableStaffingColumnWidthPx(40)).toBe(76);
  });

  it("expands for long labels like Besetzt/Bedarf", () => {
    expect(resolveStaffingTableStaffingColumnWidthPx(100)).toBe(112);
  });
});

describe("staffingTableOverlapMinWidthPx", () => {
  it("requires more width when shift column is shown", () => {
    expect(staffingTableOverlapMinWidthPx(true)).toBeGreaterThan(
      staffingTableOverlapMinWidthPx(false)
    );
  });

  it("uses dynamic staffing column width in overlap calculation", () => {
    expect(staffingTableOverlapMinWidthPx(false, 76)).toBe(230);
    expect(staffingTableOverlapMinWidthPx(false, 112)).toBe(266);
    expect(staffingTableOverlapMinWidthPx(true, 76)).toBe(270);
  });
});
