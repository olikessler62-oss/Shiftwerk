import { describe, expect, it } from "vitest";
import {
  areaServiceHoursOnDate,
  formatAreaServiceHoursDayTooltipBody,
} from "./location-staffing-client";
import type { AreaServiceHourRef } from "./location-staffing-client";

const SERVICE_HOURS: AreaServiceHourRef[] = [
  {
    id: "h1",
    location_area_id: "kitchen",
    weekday: 0,
    start_time: "08:00",
    end_time: "10:00",
  },
  {
    id: "h2",
    location_area_id: "kitchen",
    weekday: 0,
    start_time: "18:00",
    end_time: "22:00",
  },
  {
    id: "h3",
    location_area_id: "bar",
    weekday: 0,
    start_time: "12:00",
    end_time: "20:00",
  },
];

describe("formatAreaServiceHoursDayTooltipBody", () => {
  it("lists sorted service windows for the area on the date", () => {
    expect(
      areaServiceHoursOnDate(SERVICE_HOURS, "kitchen", "2026-06-01")
    ).toHaveLength(2);
    expect(
      formatAreaServiceHoursDayTooltipBody(
        SERVICE_HOURS,
        "kitchen",
        "2026-06-01"
      )
    ).toBe("08:00 – 10:00\n18:00 – 22:00");
  });

  it("returns empty string when the area has no service hours on the date", () => {
    expect(
      formatAreaServiceHoursDayTooltipBody(
        SERVICE_HOURS,
        "kitchen",
        "2026-06-02"
      )
    ).toBe("");
  });
});
