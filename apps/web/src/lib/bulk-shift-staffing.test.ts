import { describe, expect, it } from "vitest";
import {
  resolveAddShiftFormInitialValues,
  resolveCurrentBulkShiftRowId,
  resolveNextOpenStaffingDemand,
  resolveOpenDemandShiftPrefill,
  resolveStaffingEntryForBulkPrefill,
  isStaffingFullyCovered,
} from "./bulk-shift-staffing";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import type { LocationAreaStaffing } from "@schichtwerk/types";

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
          qualificationId: "qual-kellner",
        },
        {
          id: "current",
          demandServiceHourId: "morning",
          qualificationId: "qual-kellner",
        },
        {
          id: "later",
          demandServiceHourId: "afternoon",
          qualificationId: "qual-kellner",
        },
      ],
      [
        {
          serviceHourId: "morning",
          required: 2,
          assigned: 1,
          qualifications: [
            {
              qualificationId: "qual-kellner",
              name: "Kellner/in",
              assigned: 1,
              required: 2,
            },
          ],
        },
        staffingEntries[1]!,
      ],
      [
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
      ]
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

  it("skips demand already represented by a complete unsaved row", () => {
    const entries: TagAreaHeaderStaffingEntry[] = [
      {
        serviceHourId: "morning",
        label: "morning",
        required: 1,
        assigned: 0,
      },
      {
        serviceHourId: "afternoon",
        label: "afternoon",
        required: 1,
        assigned: 0,
      },
    ];

    const entry = resolveStaffingEntryForBulkPrefill(entries, serviceHours, [
      {
        demandServiceHourId: "morning",
        employeeId: "emp-1",
        startTime: "08:00",
        endTime: "10:00",
      },
    ]);

    expect(entry?.serviceHourId).toBe("afternoon");
  });

  it("returns null when every demand slot is already covered", () => {
    const entries: TagAreaHeaderStaffingEntry[] = [
      {
        serviceHourId: "morning",
        label: "morning",
        required: 1,
        assigned: 0,
      },
    ];

    const entry = resolveStaffingEntryForBulkPrefill(entries, serviceHours, [
      {
        demandServiceHourId: "morning",
        employeeId: "emp-1",
        startTime: "08:00",
        endTime: "10:00",
      },
    ]);

    expect(entry).toBeNull();
  });
});

describe("resolveOpenDemandShiftPrefill", () => {
  const areaId = "area-1";
  const serviceHourFrueh = "sh-frueh";
  const serviceHourSpat = "sh-spat";
  const qualKellner = "qual-kellner";
  const qualKoch = "qual-koch";

  const presets: AreaCalendarAssignmentPreset[] = [
    {
      id: "preset-frueh",
      name: "Früh",
      start_time: "08:00",
      end_time: "10:00",
      color: "#0f0",
    },
    {
      id: "preset-spat",
      name: "Spät",
      start_time: "16:00",
      end_time: "20:00",
      color: "#00f",
    },
  ];

  const serviceHours: AreaServiceHourRef[] = [
    {
      id: serviceHourFrueh,
      location_area_id: areaId,
      weekday: 4,
      start_time: "08:00",
      end_time: "12:00",
    },
    {
      id: serviceHourSpat,
      location_area_id: areaId,
      weekday: 4,
      start_time: "16:00",
      end_time: "22:00",
    },
  ];

  const staffingRules: LocationAreaStaffing[] = [
    {
      id: "rule-frueh",
      location_area_id: areaId,
      service_hour_id: serviceHourFrueh,
      qualification_id: qualKellner,
      required_count: 1,
    },
    {
      id: "rule-spat",
      location_area_id: areaId,
      service_hour_id: serviceHourSpat,
      qualification_id: qualKellner,
      required_count: 1,
    },
  ];

  function staffingEntryWithQualifications(
    serviceHourId: string,
    qualifications: TagAreaHeaderStaffingEntry["qualifications"],
    required = 0,
    assigned = 0
  ): TagAreaHeaderStaffingEntry {
    return {
      serviceHourId,
      assigned,
      required,
      qualificationName: "Mixed",
      timeLabel: serviceHourId,
      hasFormattedTimeRange: true,
      met: false,
      qualifications,
    };
  }

  function staffingEntry(
    serviceHourId: string,
    assigned: number,
    required: number
  ): TagAreaHeaderStaffingEntry {
    return {
      serviceHourId,
      assigned,
      required,
      qualificationName: "Kellner/in",
      timeLabel: serviceHourId,
      hasFormattedTimeRange: true,
      met: assigned >= required,
    };
  }

  it("prefills earliest open demand chronologically", () => {
    const result = resolveOpenDemandShiftPrefill({
      areaId,
      staffingEntries: [
        staffingEntry(serviceHourSpat, 0, 1),
        staffingEntry(serviceHourFrueh, 0, 1),
      ],
      serviceHours,
      assignmentPresets: presets,
      staffingRules,
    });

    expect(result).toEqual({
      presetId: "preset-frueh",
      startTime: "08:00",
      endTime: "10:00",
      qualificationId: qualKellner,
    });
  });

  it("skips covered demand and picks next open window", () => {
    const result = resolveOpenDemandShiftPrefill({
      areaId,
      staffingEntries: [
        staffingEntry(serviceHourFrueh, 1, 1),
        staffingEntry(serviceHourSpat, 0, 1),
      ],
      serviceHours,
      assignmentPresets: presets,
      staffingRules,
    });

    expect(result).toEqual({
      presetId: "preset-spat",
      startTime: "16:00",
      endTime: "20:00",
      qualificationId: qualKellner,
    });
  });

  it("returns null when all demand is covered", () => {
    const result = resolveOpenDemandShiftPrefill({
      areaId,
      staffingEntries: [staffingEntry(serviceHourFrueh, 1, 1)],
      serviceHours,
      assignmentPresets: presets,
      staffingRules,
    });

    expect(result).toBeNull();
  });

  it("prefills the next open qualification within the same time window", () => {
    const result = resolveOpenDemandShiftPrefill({
      areaId,
      staffingEntries: [
        staffingEntryWithQualifications(serviceHourFrueh, [
          {
            qualificationId: qualKellner,
            name: "Kellner/in",
            assigned: 2,
            required: 2,
          },
          {
            qualificationId: qualKoch,
            name: "Koch",
            assigned: 0,
            required: 1,
          },
        ]),
      ],
      serviceHours,
      assignmentPresets: presets,
      staffingRules: [
        ...staffingRules,
        {
          id: "rule-koch",
          location_area_id: areaId,
          service_hour_id: serviceHourFrueh,
          qualification_id: qualKoch,
          required_count: 1,
        },
      ],
    });

    expect(result).toEqual({
      presetId: "preset-frueh",
      startTime: "08:00",
      endTime: "10:00",
      qualificationId: qualKoch,
    });
  });
});

describe("resolveNextOpenStaffingDemand", () => {
  it("returns the next open qualification chronologically", () => {
    const demand = resolveNextOpenStaffingDemand(
      [
        {
          serviceHourId: "morning",
          label: "morning",
          required: 3,
          assigned: 2,
          qualifications: [
            {
              qualificationId: "qual-kellner",
              name: "Kellner/in",
              assigned: 2,
              required: 2,
            },
            {
              qualificationId: "qual-koch",
              name: "Koch",
              assigned: 0,
              required: 1,
            },
          ],
        },
      ],
      [
        {
          id: "morning",
          location_area_id: "area-1",
          weekday: 0,
          start_time: "08:00:00",
          end_time: "10:00:00",
        },
      ],
      []
    );

    expect(demand).toEqual({
      serviceHourId: "morning",
      qualificationId: "qual-koch",
    });
  });
});

describe("isStaffingFullyCovered", () => {
  it("requires every qualification row to be covered", () => {
    expect(
      isStaffingFullyCovered([
        {
          serviceHourId: "morning",
          label: "morning",
          required: 3,
          assigned: 2,
          qualifications: [
            {
              qualificationId: "qual-kellner",
              name: "Kellner/in",
              assigned: 2,
              required: 2,
            },
            {
              qualificationId: "qual-koch",
              name: "Koch",
              assigned: 0,
              required: 1,
            },
          ],
        },
      ])
    ).toBe(false);
  });

  it("is not covered when headcount matches but roles differ", () => {
    expect(
      isStaffingFullyCovered([
        {
          serviceHourId: "lunch",
          label: "lunch",
          required: 2,
          assigned: 2,
          qualifications: [
            {
              qualificationId: "qual-koch",
              name: "Koch",
              assigned: 2,
              required: 1,
            },
            {
              qualificationId: "qual-spuel",
              name: "Spülkraft",
              assigned: 0,
              required: 1,
            },
          ],
        },
      ])
    ).toBe(false);
  });
});

describe("resolveAddShiftFormInitialValues", () => {
  const presets: AreaCalendarAssignmentPreset[] = [
    {
      id: "preset-frueh",
      name: "Früh",
      start_time: "08:00",
      end_time: "10:00",
      color: "#0f0",
    },
  ];

  it("falls back to first preset when demand is fully covered", () => {
    expect(
      resolveAddShiftFormInitialValues({
        areaId: "area-1",
        assignmentPresets: presets,
        staffingEntries: [
          {
            serviceHourId: "morning",
            assigned: 1,
            required: 1,
          },
        ],
        serviceHours: [],
        staffingRules: [],
      })
    ).toEqual({
      shiftTypeId: "preset-frueh",
      startTime: "08:00",
      endTime: "10:00",
    });
  });
});
