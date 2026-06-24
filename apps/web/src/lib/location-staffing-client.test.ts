import { describe, expect, it } from "vitest";
import {
  hasServiceHoursOnDate,
  hasStaffingHeaderServiceHoursOnDate,
  tagAreaHeaderStaffingEntries,
  type AreaServiceHourRef,
} from "./location-staffing-client";

const areaA = "area-a";
const areaB = "area-b";

describe("hasServiceHoursOnDate", () => {
  it("ignores service hours without location_area_id when areaIds are scoped", () => {
    const serviceHours: AreaServiceHourRef[] = [
      {
        id: "hour-orphan",
        location_area_id: "",
        weekday: 0,
        start_time: "08:00",
        end_time: "12:00",
      },
    ];

    expect(
      hasServiceHoursOnDate(serviceHours, "2026-06-22", [areaA])
    ).toBe(false);
  });

  it("matches only the requested area", () => {
    const serviceHours: AreaServiceHourRef[] = [
      {
        id: "hour-b",
        location_area_id: areaB,
        weekday: 0,
        start_time: "08:00",
        end_time: "12:00",
      },
    ];

    expect(
      hasServiceHoursOnDate(serviceHours, "2026-06-22", [areaA])
    ).toBe(false);
    expect(
      hasServiceHoursOnDate(serviceHours, "2026-06-22", [areaB])
    ).toBe(true);
  });
});

describe("hasStaffingHeaderServiceHoursOnDate", () => {
  it("requires id and time range like tagAreaHeaderStaffingEntries", () => {
    const serviceHours: AreaServiceHourRef[] = [
      {
        id: "hour-a",
        location_area_id: areaA,
        weekday: 0,
        start_time: "12:00",
        end_time: "15:00",
      },
      {
        id: "hour-incomplete",
        location_area_id: areaA,
        weekday: 0,
      },
    ];

    expect(
      hasStaffingHeaderServiceHoursOnDate(serviceHours, "2026-06-22", areaA)
    ).toBe(true);
  });
});

describe("tagAreaHeaderStaffingEntries", () => {
  it("maps staffing rules to day hours by matching service window times", () => {
    const monHourId = "hour-mon";
    const tueHourId = "hour-tue";
    const areaId = "area-1";
    const serviceHours: AreaServiceHourRef[] = [
      {
        id: monHourId,
        location_area_id: areaId,
        weekday: 0,
        start_time: "12:00",
        end_time: "15:00",
      },
      {
        id: tueHourId,
        location_area_id: areaId,
        weekday: 1,
        start_time: "12:00",
        end_time: "15:00",
      },
    ];

    const entries = tagAreaHeaderStaffingEntries(
      [
        {
          location_area_id: areaId,
          service_hour_id: monHourId,
          required_count: 2,
        },
      ],
      areaId,
      "2026-06-23",
      serviceHours,
      []
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.serviceHourId).toBe(tueHourId);
    expect(entries[0]!.required).toBe(2);
  });

  it("maps staffing on a parent service window to a single contained day hour", () => {
    const parentHourId = "hour-parent";
    const childHourId = "hour-child";
    const areaId = "area-1";
    const serviceHours: AreaServiceHourRef[] = [
      {
        id: parentHourId,
        location_area_id: areaId,
        weekday: 2,
        start_time: "08:00",
        end_time: "22:00",
      },
      {
        id: childHourId,
        location_area_id: areaId,
        weekday: 0,
        start_time: "12:00",
        end_time: "15:00",
      },
    ];

    const entries = tagAreaHeaderStaffingEntries(
      [
        {
          location_area_id: areaId,
          service_hour_id: parentHourId,
          required_count: 2,
        },
      ],
      areaId,
      "2026-06-22",
      serviceHours,
      []
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.serviceHourId).toBe(childHourId);
    expect(entries[0]!.required).toBe(2);
  });

  it("does not sum staffing rules from other weekdays onto one day", () => {
    const areaId = "area-1";
    const serviceHours: AreaServiceHourRef[] = [];
    const rules: {
      location_area_id: string;
      service_hour_id: string;
      required_count: number;
    }[] = [];

    for (let weekday = 0; weekday < 6; weekday += 1) {
      const hourId = `hour-${weekday}`;
      serviceHours.push({
        id: hourId,
        location_area_id: areaId,
        weekday,
        start_time: "12:00",
        end_time: "15:00",
      });
      rules.push({
        location_area_id: areaId,
        service_hour_id: hourId,
        required_count: 2,
      });
    }

    const entries = tagAreaHeaderStaffingEntries(
      rules,
      areaId,
      "2026-06-22",
      serviceHours,
      []
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.required).toBe(2);
  });

  it("does not double-count when weekday rules and a direct day rule share the same window", () => {
    const monHourId = "hour-mon-spat";
    const tueHourId = "hour-tue-spat";
    const qualKellner = "qual-kellner";
    const areaId = "area-1";
    const serviceHours: AreaServiceHourRef[] = [
      {
        id: monHourId,
        location_area_id: areaId,
        weekday: 0,
        start_time: "18:00",
        end_time: "22:00",
      },
      {
        id: tueHourId,
        location_area_id: areaId,
        weekday: 1,
        start_time: "18:00",
        end_time: "22:00",
      },
    ];

    const entries = tagAreaHeaderStaffingEntries(
      [
        {
          location_area_id: areaId,
          service_hour_id: monHourId,
          qualification_id: qualKellner,
          required_count: 2,
        },
        {
          location_area_id: areaId,
          service_hour_id: tueHourId,
          qualification_id: qualKellner,
          required_count: 2,
        },
      ],
      areaId,
      "2026-06-23",
      serviceHours,
      []
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.serviceHourId).toBe(tueHourId);
    expect(entries[0]!.required).toBe(2);
  });
});
