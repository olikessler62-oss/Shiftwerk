import { describe, expect, it } from "vitest";
import {
  buildBulkStaffingTableRows,
  bulkStaffingTableRowsSupportSpeedActions,
  isBulkShiftStaffingSpeedModeActive,
} from "./bulk-shift-staffing-table";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

describe("isBulkShiftStaffingSpeedModeActive", () => {
  it("requires template, qualification and employee prefill", () => {
    expect(
      isBulkShiftStaffingSpeedModeActive({
        template: true,
        qualification: true,
        employee: true,
      })
    ).toBe(true);
    expect(
      isBulkShiftStaffingSpeedModeActive({
        template: true,
        qualification: true,
        employee: false,
      })
    ).toBe(false);
  });
});

describe("buildBulkStaffingTableRows", () => {
  it("marks header-only rows without qualificationId", () => {
    const entries: TagAreaHeaderStaffingEntry[] = [
      {
        serviceHourId: "hour-1",
        label: "Mo 12–15",
        assigned: 1,
        required: 2,
      },
    ];
    const rows = buildBulkStaffingTableRows(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.qualificationId).toBeNull();
  });

  it("creates per-job rows with qualificationId", () => {
    const entries: TagAreaHeaderStaffingEntry[] = [
      {
        serviceHourId: "hour-1",
        label: "Mo 12–15",
        assigned: 1,
        required: 2,
        qualifications: [
          {
            qualificationId: "job-1",
            name: "Kellner/in",
            assigned: 0,
            required: 1,
          },
        ],
      },
    ];
    const rows = buildBulkStaffingTableRows(entries);
    expect(rows[0]?.qualificationId).toBe("job-1");
    expect(rows[0]?.met).toBe(false);
  });
});

describe("bulkStaffingTableRowsSupportSpeedActions", () => {
  it("is false when only header rows exist", () => {
    expect(
      bulkStaffingTableRowsSupportSpeedActions([
        { qualificationId: null },
      ])
    ).toBe(false);
  });
});
