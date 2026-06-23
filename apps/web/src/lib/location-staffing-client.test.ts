import { describe, expect, it } from "vitest";
import {
  hasServiceHoursOnDate,
  hasStaffingHeaderServiceHoursOnDate,
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
