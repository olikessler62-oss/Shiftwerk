import { describe, expect, it } from "vitest";
import {
  findAreaShiftTemplatesMatchingTimes,
  resolveAreaShiftTemplateIdByTimes,
  shiftAssignmentTimeKey,
} from "./area-shift-template-match";

const templates = [
  {
    id: "fruh",
    location_area_id: "area-1",
    start_time: "08:00:00",
    end_time: "10:00:00",
  },
  {
    id: "spat",
    location_area_id: "area-1",
    start_time: "18:00:00",
    end_time: "22:00:00",
  },
  {
    id: "other-area",
    location_area_id: "area-2",
    start_time: "08:00:00",
    end_time: "10:00:00",
  },
] as const;

describe("shiftAssignmentTimeKey", () => {
  it("normalizes to HH:MM", () => {
    expect(shiftAssignmentTimeKey("8:0")).toBe("08:00");
    expect(shiftAssignmentTimeKey("08:00:00")).toBe("08:00");
  });
});

describe("resolveAreaShiftTemplateIdByTimes", () => {
  it("returns template id for exact match in area", () => {
    expect(
      resolveAreaShiftTemplateIdByTimes("area-1", "08:00", "10:00", templates)
    ).toBe("fruh");
  });

  it("returns null when no template matches", () => {
    expect(
      resolveAreaShiftTemplateIdByTimes("area-1", "09:00", "11:00", templates)
    ).toBeNull();
  });

  it("returns null when multiple templates would match", () => {
    const ambiguous = [
      ...templates,
      {
        id: "fruh-dup",
        location_area_id: "area-1",
        start_time: "08:00",
        end_time: "10:00",
      },
    ];
    expect(
      resolveAreaShiftTemplateIdByTimes("area-1", "08:00", "10:00", ambiguous)
    ).toBeNull();
  });

  it("ignores templates from other areas", () => {
    expect(
      findAreaShiftTemplatesMatchingTimes("area-2", "08:00", "10:00", templates)
    ).toHaveLength(1);
    expect(
      findAreaShiftTemplatesMatchingTimes("area-2", "08:00", "10:00", templates)[0]
        ?.id
    ).toBe("other-area");
  });
});
