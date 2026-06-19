import { describe, expect, it } from "vitest";
import {
  earliestAssignmentPreset,
  prefillBulkRowWithEarliestAssignmentPreset,
  type AreaCalendarAssignmentPreset,
} from "./areacalendar-assignment-presets";

function preset(
  overrides: Partial<AreaCalendarAssignmentPreset> &
    Pick<AreaCalendarAssignmentPreset, "id" | "start_time" | "end_time">
): AreaCalendarAssignmentPreset {
  return {
    name: overrides.id,
    color: "#000000",
    ...overrides,
  };
}

describe("areacalendar-assignment-presets", () => {
  it("picks the earliest template by start time", () => {
    const presets = [
      preset({ id: "late", start_time: "14:00:00", end_time: "22:00:00" }),
      preset({ id: "early", start_time: "08:00:00", end_time: "16:00:00" }),
      preset({ id: "mid", start_time: "10:00:00", end_time: "18:00:00" }),
    ];
    expect(earliestAssignmentPreset(presets)?.id).toBe("early");
  });

  it("prefills bulk row fields from the earliest template", () => {
    const row = {
      shiftTypeId: "",
      startTime: "00:00",
      endTime: "00:00",
    };
    const applied = prefillBulkRowWithEarliestAssignmentPreset(row, [
      preset({ id: "early", start_time: "08:00:00", end_time: "16:00:00" }),
    ]);
    expect(applied).toBe(true);
    expect(row).toMatchObject({
      shiftTypeId: "early",
      startTime: "08:00",
      endTime: "16:00",
      requestedStartTime: "08:00",
      requestedEndTime: "16:00",
    });
  });
});
