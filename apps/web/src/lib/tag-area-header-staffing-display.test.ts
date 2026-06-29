import { describe, expect, it } from "vitest";
import { resolveCalendarStaffingTimeLabel, compactStaffingTimeRangeLabel } from "@/lib/location-staffing-client";
import {
  resolveStaffingHeaderDisplay,
  isTagAreaHeaderStaffingEntryAssignmentMismatch,
  isTagAreaHeaderStaffingEntryOverstaffed,
  isTagAreaHeaderStaffingEntryPlannedCoverage,
  isTagAreaHeaderStaffingEntryUnderstaffed,
  resolveStaffingFillGaugeVariant,
  isTagAreaHeaderStaffingHeaderAlertBadge,
  gaugeCountsForTagAreaHeaderStaffingEntry,
  STAFFING_FILL_GAUGE_SIZE_PX,
  type StaffingHeaderSegment,
} from "./tag-area-header-staffing-display";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";

function entry(
  id: string,
  assigned: number,
  required: number,
  shiftTemplateLabel?: string
): TagAreaHeaderStaffingEntry {
  return {
    serviceHourId: id,
    label: "08:00–12:00",
    calendarTimeLabel: "08:00–12:00",
    shiftTemplateLabel,
    assigned,
    required,
  };
}

describe("resolveCalendarStaffingTimeLabel", () => {
  it("prefers shift template name over time in calendar overlay", () => {
    expect(
      resolveCalendarStaffingTimeLabel({
        label: "Do 08:00–10:00",
        calendarTimeLabel: "08:00-10:00 Uhr",
        shiftTemplateLabel: "Früh",
      })
    ).toBe("Früh");
  });

  it("compacts spaces around time range dashes when no template matches", () => {
    expect(
      resolveCalendarStaffingTimeLabel({
        label: "Do 08:00 - 10:00 Uhr",
        calendarTimeLabel: "08:00 - 10:00 Uhr",
      })
    ).toBe("08:00-10:00 Uhr");
  });

  it("compacts spaces around pipe symbols in combined labels", () => {
    expect(
      compactStaffingTimeRangeLabel("Früh: 0/1 | Spät: 0/1")
    ).toBe("Früh: 0/1|Spät: 0/1");
  });
});

describe("resolveStaffingHeaderDisplay", () => {
  it("shows full gauges with labels when width is sufficient", () => {
    const entries = [entry("a", 0, 1, "Früh")];

    const display = resolveStaffingHeaderDisplay(entries, 120);

    expect(display).toEqual({
      mode: "gauges",
      level: "full-schicht",
      segments: [
        expect.objectContaining({
          serviceHourId: "a",
          timeText: "Früh",
          countText: "0/1",
          assigned: 0,
          required: 1,
          understaffed: true,
          overstaffed: false,
          assignmentMismatch: false,
          plannedCoverage: false,
        }),
      ],
    });
  });

  it("falls back to count-only gauges when labels do not fit", () => {
    const entries = [
      entry("a", 0, 4, "Früh"),
      entry("b", 0, 4, "Spät"),
      entry("c", 0, 4, "Nacht"),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 110);

    expect(display.mode).toBe("gauges");
    if (display.mode === "gauges") {
      expect(display.level).toBe("counts-only");
      expect(display.segments.every((segment) => segment.timeText === null)).toBe(
        true
      );
    }
  });

  it("shows indicator when even count-only gauges would overflow", () => {
    const entries = [
      entry("a", 0, 4),
      entry("b", 0, 4),
      entry("c", 0, 4),
      entry("d", 0, 4),
      entry("e", 0, 4),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 72);

    expect(display).toEqual({
      mode: "indicator",
      allMet: false,
      hasOverstaffed: false,
      hasPlannedCoverage: false,
    });
  });

  it("uses indicator with allMet when fully staffed but cramped", () => {
    const entries = [
      entry("a", 4, 4),
      entry("b", 4, 4),
      entry("c", 4, 4),
      entry("d", 4, 4),
      entry("e", 4, 4),
    ];

    const display = resolveStaffingHeaderDisplay(entries, 72);

    expect(display).toEqual({
      mode: "indicator",
      allMet: true,
      hasOverstaffed: false,
      hasPlannedCoverage: false,
    });
  });
});

describe("isTagAreaHeaderStaffingEntryOverstaffed", () => {
  it("detects aggregate overstaffing", () => {
    expect(isTagAreaHeaderStaffingEntryOverstaffed(entry("a", 3, 2))).toBe(
      true
    );
  });

  it("detects per-qualification overstaffing even when aggregate matches", () => {
    expect(
      isTagAreaHeaderStaffingEntryOverstaffed({
        ...entry("a", 3, 3),
        qualifications: [
          { qualificationId: "k1", name: "Kellner", assigned: 3, required: 2 },
          { qualificationId: "k2", name: "Koch", assigned: 0, required: 1 },
        ],
      })
    ).toBe(true);
  });

  it("ignores zero required qualifications", () => {
    expect(
      isTagAreaHeaderStaffingEntryOverstaffed({
        ...entry("a", 1, 1),
        qualifications: [{ qualificationId: "o1", name: "Optional", assigned: 1, required: 0 }],
      })
    ).toBe(false);
  });
});

describe("isTagAreaHeaderStaffingEntryUnderstaffed", () => {
  it("detects missing qualification even when shift count matches total demand", () => {
    const kitchenLunch = {
      ...entry("lunch", 2, 2, "Mittag"),
      qualifications: [
        { qualificationId: "koch", name: "Köchin", assigned: 2, required: 1 },
        { qualificationId: "spuel", name: "Spülkraft", assigned: 0, required: 1 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryUnderstaffed(kitchenLunch)).toBe(true);
    expect(gaugeCountsForTagAreaHeaderStaffingEntry(kitchenLunch)).toEqual({
      assigned: 2,
      required: 2,
    });

    const display = resolveStaffingHeaderDisplay([kitchenLunch], 120);
    expect(display.mode).toBe("gauges");
    if (display.mode === "gauges") {
      expect(display.segments[0]).toMatchObject({
        countText: "2/2",
        understaffed: true,
        overstaffed: true,
        assignmentMismatch: true,
      });
    }
  });

  it("shows actual shift count when overstaffed on one qualification", () => {
    const lunch = {
      ...entry("lunch", 3, 2, "Mittag"),
      qualifications: [
        { qualificationId: "kellner", name: "Kellner", assigned: 3, required: 2 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryUnderstaffed(lunch)).toBe(false);
    expect(isTagAreaHeaderStaffingEntryOverstaffed(lunch)).toBe(true);
    expect(gaugeCountsForTagAreaHeaderStaffingEntry(lunch)).toEqual({
      assigned: 3,
      required: 2,
    });

    const display = resolveStaffingHeaderDisplay([lunch], 120);
    if (display.mode === "gauges") {
      expect(display.segments[0]).toMatchObject({
        countText: "3/2",
        understaffed: false,
        overstaffed: true,
        assignmentMismatch: false,
      });
    }
  });

  it("uses shift count when only one mapped role is missing", () => {
    const kitchenLunch = {
      ...entry("lunch", 2, 2, "Mittag"),
      qualifications: [
        { qualificationId: "koch", name: "Köchin", assigned: 1, required: 1 },
        { qualificationId: "spuel", name: "Spülkraft", assigned: 0, required: 1 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryUnderstaffed(kitchenLunch)).toBe(true);
    expect(gaugeCountsForTagAreaHeaderStaffingEntry(kitchenLunch)).toEqual({
      assigned: 2,
      required: 2,
    });
  });
});

describe("isTagAreaHeaderStaffingEntryAssignmentMismatch", () => {
  it("detects wrong roles when shift count matches total demand", () => {
    const kitchenLunch = {
      ...entry("lunch", 2, 2, "Mittag"),
      qualifications: [
        { qualificationId: "koch", name: "Köchin", assigned: 2, required: 1 },
        { qualificationId: "spuel", name: "Spülkraft", assigned: 0, required: 1 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryAssignmentMismatch(kitchenLunch)).toBe(
      true
    );
  });

  it("does not flag simple understaffing when headcount is short", () => {
    const kitchenLunch = {
      ...entry("lunch", 1, 2, "Mittag"),
      qualifications: [
        { qualificationId: "koch", name: "Köchin", assigned: 1, required: 1 },
        { qualificationId: "spuel", name: "Spülkraft", assigned: 0, required: 1 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryAssignmentMismatch(kitchenLunch)).toBe(
      false
    );
    expect(isTagAreaHeaderStaffingEntryUnderstaffed(kitchenLunch)).toBe(true);
  });

  it("does not flag overstaffing with matching roles", () => {
    const lunch = {
      ...entry("lunch", 3, 2, "Mittag"),
      qualifications: [
        { qualificationId: "kellner", name: "Kellner", assigned: 3, required: 2 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryAssignmentMismatch(lunch)).toBe(false);
    expect(isTagAreaHeaderStaffingEntryOverstaffed(lunch)).toBe(true);
  });
});

describe("isTagAreaHeaderStaffingHeaderAlertBadge", () => {
  it("includes overstaffing and assignment mismatch", () => {
    const mismatch = {
      ...entry("lunch", 2, 2, "Mittag"),
      qualifications: [
        { qualificationId: "koch", name: "Köchin", assigned: 2, required: 1 },
        { qualificationId: "spuel", name: "Spülkraft", assigned: 0, required: 1 },
      ],
    };
    const overstaffed = {
      ...entry("lunch", 3, 2, "Mittag"),
      qualifications: [
        { qualificationId: "kellner", name: "Kellner", assigned: 3, required: 2 },
      ],
    };

    expect(isTagAreaHeaderStaffingHeaderAlertBadge([mismatch])).toBe(true);
    expect(isTagAreaHeaderStaffingHeaderAlertBadge([overstaffed])).toBe(true);
    expect(isTagAreaHeaderStaffingHeaderAlertBadge([entry("a", 1, 2)])).toBe(
      false
    );
  });
});

describe("resolveStaffingFillGaugeVariant", () => {
  it("uses full red ring for true understaffing", () => {
    expect(
      resolveStaffingFillGaugeVariant({
        understaffed: true,
        overstaffed: false,
        assignmentMismatch: false,
        assigned: 2,
        required: 12,
      } as StaffingHeaderSegment)
    ).toBe("understaffed");
  });

  it("uses full yellow ring for assignment mismatch when headcount matches", () => {
    expect(
      resolveStaffingFillGaugeVariant({
        understaffed: true,
        overstaffed: true,
        assignmentMismatch: true,
        assigned: 2,
        required: 2,
      } as StaffingHeaderSegment)
    ).toBe("overstaffed");
  });

  it("uses full yellow ring for pure overstaffing", () => {
    expect(
      resolveStaffingFillGaugeVariant({
        understaffed: false,
        overstaffed: true,
        assignmentMismatch: false,
        assigned: 3,
        required: 2,
      } as StaffingHeaderSegment)
    ).toBe("overstaffed");
  });

  it("uses light yellow-green when planned shifts would cover demand", () => {
    expect(
      resolveStaffingFillGaugeVariant({
        understaffed: false,
        overstaffed: false,
        assignmentMismatch: false,
        plannedCoverage: true,
        assigned: 0,
        required: 2,
      } as StaffingHeaderSegment)
    ).toBe("planned");
  });

  it("uses full green ring when demand is met", () => {
    expect(
      resolveStaffingFillGaugeVariant({
        understaffed: false,
        overstaffed: false,
        assignmentMismatch: false,
        plannedCoverage: false,
        assigned: 2,
        required: 2,
      } as StaffingHeaderSegment)
    ).toBe("met");
  });
});

describe("isTagAreaHeaderStaffingEntryPlannedCoverage", () => {
  it("is true when only confirmed count is below demand but projection meets it", () => {
    const plannedEntry: TagAreaHeaderStaffingEntry = {
      serviceHourId: "a",
      label: "08:00–12:00",
      assigned: 0,
      projectedAssigned: 2,
      required: 2,
      qualifications: [
        { qualificationId: "k1", name: "Koch", assigned: 0, required: 2 },
      ],
      projectedQualifications: [
        { qualificationId: "k1", name: "Koch", assigned: 2, required: 2 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryUnderstaffed(plannedEntry)).toBe(false);
    expect(isTagAreaHeaderStaffingEntryPlannedCoverage(plannedEntry)).toBe(true);
    expect(gaugeCountsForTagAreaHeaderStaffingEntry(plannedEntry)).toEqual({
      assigned: 2,
      required: 2,
    });
  });

  it("shows uncapped projected count when more shifts are planned than required", () => {
    const overplannedEntry: TagAreaHeaderStaffingEntry = {
      serviceHourId: "frueh",
      label: "08:00–17:00",
      assigned: 0,
      projectedAssigned: 2,
      required: 1,
      qualifications: [
        { qualificationId: "k1", name: "Pflege", assigned: 0, required: 1 },
      ],
      projectedQualifications: [
        { qualificationId: "k1", name: "Pflege", assigned: 2, required: 1 },
      ],
    };

    expect(isTagAreaHeaderStaffingEntryPlannedCoverage(overplannedEntry)).toBe(
      true
    );
    expect(gaugeCountsForTagAreaHeaderStaffingEntry(overplannedEntry)).toEqual({
      assigned: 2,
      required: 1,
    });
  });

  it("stays red when even projected shifts do not cover demand", () => {
    const openEntry: TagAreaHeaderStaffingEntry = {
      serviceHourId: "a",
      label: "08:00–12:00",
      assigned: 0,
      projectedAssigned: 1,
      required: 2,
    };

    expect(isTagAreaHeaderStaffingEntryUnderstaffed(openEntry)).toBe(true);
    expect(isTagAreaHeaderStaffingEntryPlannedCoverage(openEntry)).toBe(false);
  });
});

describe("staffing header segment helpers", () => {
  it("exports segment shape used by overlay", () => {
    const segment: StaffingHeaderSegment = {
      serviceHourId: "x",
      timeText: "Früh",
      countText: "0/4",
      measureText: "Früh: 0/4",
      understaffed: true,
      overstaffed: false,
      assignmentMismatch: false,
      plannedCoverage: false,
      assigned: 0,
      required: 4,
    };
    expect(segment.countText).toBe("0/4");
    expect(STAFFING_FILL_GAUGE_SIZE_PX).toBe(24);
  });
});
