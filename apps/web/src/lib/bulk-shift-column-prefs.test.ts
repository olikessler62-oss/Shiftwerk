import { describe, expect, it } from "vitest";
import {
  cycleBulkShiftSortPrefs,
  DEFAULT_BULK_SHIFT_COLUMN_PREFS,
  toggleBulkShiftPrefillColumn,
} from "@/lib/bulk-shift-column-prefs";

describe("bulk-shift-column-prefs", () => {
  it("cycles sort asc → desc → off", () => {
    const asc = cycleBulkShiftSortPrefs(DEFAULT_BULK_SHIFT_COLUMN_PREFS, "template");
    expect(asc.sort).toEqual({ column: "template", direction: "asc" });

    const desc = cycleBulkShiftSortPrefs(asc, "template");
    expect(desc.sort).toEqual({ column: "template", direction: "desc" });

    const off = cycleBulkShiftSortPrefs(desc, "template");
    expect(off.sort).toEqual({ column: null, direction: null });
  });

  it("switches sort column exclusively", () => {
    const active = cycleBulkShiftSortPrefs(
      {
        ...DEFAULT_BULK_SHIFT_COLUMN_PREFS,
        sort: { column: "employee", direction: "desc" },
      },
      "startTime"
    );
    expect(active.sort).toEqual({ column: "startTime", direction: "asc" });
  });

  it("defaults all prefill columns on", () => {
    expect(DEFAULT_BULK_SHIFT_COLUMN_PREFS.prefill).toEqual({
      template: true,
      qualification: true,
      employee: true,
    });
  });

  it("toggles prefill columns independently", () => {
    const next = toggleBulkShiftPrefillColumn(
      DEFAULT_BULK_SHIFT_COLUMN_PREFS,
      "qualification"
    );
    expect(next.prefill.qualification).toBe(false);
    expect(next.prefill.template).toBe(true);
    expect(next.prefill.employee).toBe(true);
  });
});
