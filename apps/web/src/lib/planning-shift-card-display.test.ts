import { describe, expect, it } from "vitest";
import {
  buildPlanningShiftSegmentCardContent,
  buildPlanningShiftSegmentTimeLabel,
} from "./planning-shift-card-display";

const presets = [
  {
    id: "t1",
    name: "Nacht",
    start_time: "22:00",
    end_time: "04:00",
  },
] as const;

const overnightShift = {
  id: "s1",
  employee_id: "e1",
  shift_date: "2026-06-02",
  shiftName: null,
  color: "#000",
  startTime: "22:00",
  endTime: "04:00",
  location_area_id: "a1",
  area_shift_template_id: "t1",
};

describe("buildPlanningShiftSegmentTimeLabel", () => {
  it("shows start time with trailing dash on overnight start", () => {
    expect(
      buildPlanningShiftSegmentTimeLabel("overnight-start", "22:00:00", "04:00:00")
    ).toBe("22:00 -");
  });

  it("shows only end time on overnight end", () => {
    expect(
      buildPlanningShiftSegmentTimeLabel("overnight-end", "22:00:00", "04:00:00")
    ).toBe("04:00");
  });

  it("shows full range for same-day shifts", () => {
    expect(
      buildPlanningShiftSegmentTimeLabel("full", "08:00:00", "16:00:00")
    ).toBe("08:00 – 16:00");
  });
});

describe("buildPlanningShiftSegmentCardContent", () => {
  it("keeps template name on overnight end when present on start", () => {
    const content = buildPlanningShiftSegmentCardContent(
      overnightShift,
      presets,
      "overnight-end"
    );
    expect(content.templateName).toBe("Nacht");
    expect(content.timeLabel).toBe("04:00");
    expect(content.tooltipBody).toContain("Schicht: Nacht");
  });

  it("includes work site between employee name and shift in tooltip", () => {
    const content = buildPlanningShiftSegmentCardContent(
      overnightShift,
      presets,
      "full",
      {
        employeeName: "Alexa Bello",
        areaName: "Tour 1",
      }
    );

    expect(content.tooltip.areaName).toBe("Tour 1");
    expect(content.tooltipBody.indexOf("Alexa Bello")).toBeLessThan(
      content.tooltipBody.indexOf("Tour 1")
    );
    expect(content.tooltipBody.indexOf("Tour 1")).toBeLessThan(
      content.tooltipBody.indexOf("Schicht: Nacht")
    );
  });
});
