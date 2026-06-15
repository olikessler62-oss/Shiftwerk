import { describe, expect, it } from "vitest";
import { suggestNextServiceHourEntryTimes } from "./location-service-hour-entries";

describe("suggestNextServiceHourEntryTimes", () => {
  it("uses defaults when no rows exist", () => {
    expect(suggestNextServiceHourEntryTimes([])).toEqual({
      start_time: "09:00",
      end_time: "18:00",
    });
  });

  it("starts at latest end and adds one hour", () => {
    expect(
      suggestNextServiceHourEntryTimes([
        { start_time: "09:00", end_time: "12:00" },
        { start_time: "13:00", end_time: "17:00" },
      ])
    ).toEqual({
      start_time: "17:00",
      end_time: "18:00",
    });
  });

  it("continues after overnight window morning end", () => {
    expect(
      suggestNextServiceHourEntryTimes([
        { start_time: "09:00", end_time: "17:00" },
        { start_time: "21:00", end_time: "05:00" },
      ])
    ).toEqual({
      start_time: "05:00",
      end_time: "06:00",
    });
  });

  it("adds one minute when start is after 22:59", () => {
    expect(
      suggestNextServiceHourEntryTimes([{ start_time: "20:00", end_time: "23:00" }])
    ).toEqual({
      start_time: "23:00",
      end_time: "23:01",
    });
  });

  it("adds one hour when start is exactly 22:59", () => {
    expect(
      suggestNextServiceHourEntryTimes([{ start_time: "09:00", end_time: "22:59" }])
    ).toEqual({
      start_time: "22:59",
      end_time: "23:59",
    });
  });

  it("wraps to 01:00 next day when start is 23:59", () => {
    expect(
      suggestNextServiceHourEntryTimes([{ start_time: "09:00", end_time: "23:59" }])
    ).toEqual({
      start_time: "23:59",
      end_time: "01:00",
    });
  });
});
