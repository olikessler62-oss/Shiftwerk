import { describe, expect, it } from "vitest";
import {
  aggregateConfirmationCountsForDay,
  buildStaffingWindowConfirmationCountsByKey,
  collectAreaConfirmationConflictStatuses,
  hasActionableConfirmationCounts,
  staffingWindowConfirmationCountsKey,
} from "./dashboard-day-confirmation-counts";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { weekdayIndexFromDate } from "@/lib/location-staffing-client";

function shift(
  date: string,
  status: PlanningShift["confirmationStatus"],
  overrides: Partial<PlanningShift> = {}
): PlanningShift {
  return {
    id: `shift-${date}-${status ?? "confirmed"}`,
    shift_date: date,
    confirmationStatus: status,
    startTime: "11:00",
    endTime: "15:00",
    location_area_id: "area-1",
    ...overrides,
  } as PlanningShift;
}

describe("aggregateConfirmationCountsForDay", () => {
  it("counts shifts per confirmation status on the given day", () => {
    const counts = aggregateConfirmationCountsForDay(
      [
        shift("2026-06-23", "proposed"),
        shift("2026-06-23", "requested"),
        shift("2026-06-23", "pending"),
        shift("2026-06-24", "rejected"),
      ],
      "2026-06-23"
    );

    expect(counts.proposed).toBe(1);
    expect(counts.requested).toBe(1);
    expect(counts.pending).toBe(1);
    expect(counts.rejected).toBe(0);
    expect(hasActionableConfirmationCounts(counts)).toBe(true);
  });

  it("treats missing status as confirmed", () => {
    const counts = aggregateConfirmationCountsForDay(
      [shift("2026-06-23", undefined)],
      "2026-06-23"
    );

    expect(counts.confirmed).toBe(1);
    expect(hasActionableConfirmationCounts(counts)).toBe(false);
  });
});

describe("collectAreaConfirmationConflictStatuses", () => {
  const serviceHours = [
    {
      id: "hour-1",
      location_area_id: "area-1",
      weekday: weekdayIndexFromDate("2026-06-23"),
      start_time: "11:00",
      end_time: "15:00",
    },
    {
      id: "hour-2",
      location_area_id: "area-1",
      weekday: weekdayIndexFromDate("2026-06-24"),
      start_time: "11:00",
      end_time: "15:00",
    },
  ];

  it("returns unique actionable statuses for the area and date scope", () => {
    const shifts = [
      {
        ...shift("2026-06-23", "pending", { id: "p1", employee_id: "e1" }),
        location_area_id: "area-1",
      },
      {
        ...shift("2026-06-23", "pending", { id: "p2", employee_id: "e2" }),
        location_area_id: "area-1",
      },
      {
        ...shift("2026-06-23", "canceled", { id: "c1", employee_id: "e3" }),
        location_area_id: "area-1",
      },
      {
        ...shift("2026-06-23", "rejected", { id: "r1", employee_id: "e4" }),
        location_area_id: "area-2",
      },
      {
        ...shift("2026-06-24", "rejected", {
          id: "r2",
          employee_id: "e5",
        }),
        location_area_id: "area-1",
        startTime: "11:00",
        endTime: "15:00",
      },
    ] as PlanningShift[];

    expect(
      collectAreaConfirmationConflictStatuses(
        shifts,
        "area-1",
        ["2026-06-23"],
        serviceHours
      )
    ).toEqual(["pending", "canceled"]);

    expect(
      collectAreaConfirmationConflictStatuses(
        shifts,
        "area-1",
        ["2026-06-23", "2026-06-24"],
        serviceHours
      )
    ).toEqual(["pending", "rejected", "canceled"]);
  });

  it("deduplicates conflicting statuses for the same employee in one window", () => {
    const shifts = [
      {
        ...shift("2026-06-23", "pending", {
          id: "pending",
          employee_id: "patricia",
        }),
        location_area_id: "area-1",
      },
      {
        ...shift("2026-06-23", "rejected", {
          id: "rejected",
          employee_id: "patricia",
        }),
        location_area_id: "area-1",
      },
    ] as PlanningShift[];

    expect(
      collectAreaConfirmationConflictStatuses(
        shifts,
        "area-1",
        ["2026-06-23"],
        serviceHours
      )
    ).toEqual(["rejected"]);
  });

  it("tolerates missing service hours input", () => {
    const shifts = [
      {
        ...shift("2026-06-23", "pending", {
          id: "pending",
          employee_id: "patricia",
        }),
        location_area_id: "area-1",
      },
      {
        ...shift("2026-06-23", "rejected", {
          id: "rejected",
          employee_id: "patricia",
        }),
        location_area_id: "area-1",
      },
    ] as PlanningShift[];

    expect(
      collectAreaConfirmationConflictStatuses(
        shifts,
        "area-1",
        ["2026-06-23"],
        undefined
      )
    ).toEqual(["rejected"]);
  });
});

describe("buildStaffingWindowConfirmationCountsByKey", () => {
  it("aggregates actionable confirmation counts per service-hour window", () => {
    const firstDate = "2026-06-23";
    const secondDate = "2026-06-24";

    const countsByKey = buildStaffingWindowConfirmationCountsByKey({
      shifts: [
        shift(firstDate, "pending", { id: "s1", employee_id: "e1" }),
        shift(firstDate, "pending", { id: "s2", employee_id: "e2" }),
        shift(firstDate, "requested", { id: "s3", employee_id: "e3" }),
        shift(secondDate, "rejected", {
          id: "s4",
          employee_id: "e4",
          startTime: "17:00",
          endTime: "21:00",
        }),
      ],
      areaId: "area-1",
      dates: [firstDate, secondDate],
      serviceHours: [
        {
          id: "hour-1",
          location_area_id: "area-1",
          weekday: weekdayIndexFromDate(firstDate),
          start_time: "11:00",
          end_time: "15:00",
        },
        {
          id: "hour-2",
          location_area_id: "area-1",
          weekday: weekdayIndexFromDate(secondDate),
          start_time: "17:00",
          end_time: "21:00",
        },
      ],
    });

    expect(
      countsByKey.get(staffingWindowConfirmationCountsKey(firstDate, "hour-1"))
    ).toEqual({
      pending: 2,
      requested: 1,
    });
    expect(
      countsByKey.get(staffingWindowConfirmationCountsKey(secondDate, "hour-2"))
    ).toEqual({
      rejected: 1,
    });
  });

  it("counts only one actionable status per employee in the same window", () => {
    const dateISO = "2026-06-28";
    const countsByKey = buildStaffingWindowConfirmationCountsByKey({
      shifts: [
        shift(dateISO, "pending", { id: "pending", employee_id: "patricia" }),
        shift(dateISO, "rejected", { id: "rejected", employee_id: "patricia" }),
      ],
      areaId: "area-1",
      dates: [dateISO],
      serviceHours: [
        {
          id: "hour-1",
          location_area_id: "area-1",
          weekday: weekdayIndexFromDate(dateISO),
          start_time: "11:00",
          end_time: "15:00",
        },
      ],
    });

    expect(
      countsByKey.get(staffingWindowConfirmationCountsKey(dateISO, "hour-1"))
    ).toEqual({
      rejected: 1,
    });
  });
});
