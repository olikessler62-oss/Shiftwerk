import { describe, expect, it } from "vitest";
import {
  resolveCurrentBulkShiftRowId,
  resolveStaffingEntryForBulkPrefill,
} from "./bulk-shift-staffing";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

const staffingEntries: TagAreaHeaderStaffingEntry[] = [
  {
    serviceHourId: "morning",
    required: 2,
    assigned: 0,
    qualificationName: "Kellner/in",
    timeLabel: "08:00 – 10:00",
    hasFormattedTimeRange: true,
    met: false,
  },
  {
    serviceHourId: "afternoon",
    required: 2,
    assigned: 0,
    qualificationName: "Kellner/in",
    timeLabel: "12:00 – 15:00",
    hasFormattedTimeRange: true,
    met: false,
  },
];

describe("resolveCurrentBulkShiftRowId", () => {
  it("returns the unsaved row for the next uncovered demand slot", () => {
    const currentId = resolveCurrentBulkShiftRowId(
      [
        {
          id: "saved",
          existingShiftId: "shift-1",
          demandServiceHourId: "morning",
        },
        {
          id: "current",
          demandServiceHourId: "morning",
        },
        {
          id: "later",
          demandServiceHourId: "afternoon",
        },
      ],
      staffingEntries
    );

    expect(currentId).toBe("current");
  });

  it("keeps highlighting auto-filled but unsaved rows", () => {
    const currentId = resolveCurrentBulkShiftRowId(
      [{ id: "auto-filled", demandServiceHourId: "morning" }],
      staffingEntries
    );

    expect(currentId).toBe("auto-filled");
  });

  it("returns null when every row is already saved", () => {
    const currentId = resolveCurrentBulkShiftRowId(
      [{ id: "saved", existingShiftId: "shift-1", demandServiceHourId: "morning" }],
      staffingEntries
    );

    expect(currentId).toBeNull();
  });
});

describe("resolveStaffingEntryForBulkPrefill", () => {
  const serviceHours: AreaServiceHourRef[] = [
    {
      id: "morning",
      location_area_id: "area-1",
      weekday: 0,
      start_time: "08:00:00",
      end_time: "10:00:00",
    },
    {
      id: "afternoon",
      location_area_id: "area-1",
      weekday: 0,
      start_time: "12:00:00",
      end_time: "15:00:00",
    },
  ];

  it("picks chronologically earliest uncovered demand window", () => {
    const entries: TagAreaHeaderStaffingEntry[] = [
      {
        serviceHourId: "afternoon",
        label: "afternoon",
        required: 1,
        assigned: 0,
      },
      {
        serviceHourId: "morning",
        label: "morning",
        required: 1,
        assigned: 0,
      },
    ];

    const entry = resolveStaffingEntryForBulkPrefill(entries, serviceHours, []);
    expect(entry?.serviceHourId).toBe("morning");
  });
});
