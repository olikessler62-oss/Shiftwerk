import { describe, expect, it } from "vitest";
import {
  resolveStaffingTableStaffingColumnWidthPx,
  staffingTableOverlapMinWidthPx,
} from "./use-staffing-table-headers-fit";

describe("resolveStaffingTableStaffingColumnWidthPx", () => {
  it("keeps fallback width for short labels", () => {
    expect(resolveStaffingTableStaffingColumnWidthPx(40)).toBe(84);
  });

  it("expands for long labels like Besetzt/Bedarf", () => {
    expect(resolveStaffingTableStaffingColumnWidthPx(100)).toBe(116);
  });
});

describe("staffingTableOverlapMinWidthPx", () => {
  it("requires more width when shift column is shown", () => {
    expect(staffingTableOverlapMinWidthPx(true)).toBeGreaterThan(
      staffingTableOverlapMinWidthPx(false)
    );
  });

  it("uses dynamic staffing column width in overlap calculation", () => {
    expect(staffingTableOverlapMinWidthPx(false, 84)).toBe(232);
    expect(staffingTableOverlapMinWidthPx(false, 116)).toBe(264);
    expect(staffingTableOverlapMinWidthPx(true, 84)).toBe(272);
  });
});
