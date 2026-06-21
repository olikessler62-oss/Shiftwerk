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
        assigned: 3,
        required: 4,
        qualifications: [
          {
            qualificationId: "job-koch",
            name: "Koch",
            assigned: 3,
            required: 2,
          },
          {
            qualificationId: "job-spuel",
            name: "Spülkraft",
            assigned: 0,
            required: 2,
          },
        ],
      },
    ];
    const rows = buildBulkStaffingTableRows(entries);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.qualificationId).toBe("job-koch");
    expect(rows[0]?.shiftLabel).toBe("");
    expect(rows[0]?.assigned).toBe(3);
    expect(rows[0]?.totalAssigned).toBe(3);
    expect(rows[0]?.met).toBe(true);
    expect(rows[1]?.qualificationId).toBe("job-spuel");
    expect(rows[1]?.assigned).toBe(0);
    expect(rows[1]?.totalAssigned).toBe(0);
    expect(rows[1]?.met).toBe(false);
  });

  it("includes shift template label in shift column", () => {
    const rows = buildBulkStaffingTableRows([
      {
        serviceHourId: "hour-1",
        label: "Mo 08–12",
        assigned: 1,
        required: 1,
        timeLabel: "Montag 08:00 bis 12:00 Uhr",
        shiftTemplateLabel: "Frühschicht",
        qualifications: [
          {
            qualificationId: "job-koch",
            name: "Koch",
            assigned: 1,
            required: 1,
          },
        ],
      },
    ]);

    expect(rows[0]?.shiftLabel).toBe("Frühschicht");
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
