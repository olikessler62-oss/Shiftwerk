import { describe, expect, it } from "vitest";
import { buildShiftCardDisplayContent } from "./shift-card-display-content";

const presets = [
  {
    id: "t1",
    name: "Nacht",
    color: "#000",
    start_time: "22:00",
    end_time: "04:00",
  },
] as const;

describe("buildShiftCardDisplayContent tooltips", () => {
  it("prefixes matching shift template with Schicht:", () => {
    const display = buildShiftCardDisplayContent(
      {
        employeeName: "Alexa Bello",
        startTime: "22:00",
        endTime: "04:00",
        shiftName: "Nacht",
        areaShiftTemplateId: "t1",
      },
      "Kellner/in",
      { assignmentPresets: presets }
    );

    expect(display.tooltipBody).toContain("Schicht: Nacht");
    expect(display.tooltipBody).toContain("Job: Kellner/in");
  });

  it("does not prefix shift name without matching template", () => {
    const display = buildShiftCardDisplayContent(
      {
        employeeName: "Alexa Bello",
        startTime: "08:00",
        endTime: "16:00",
        shiftName: "Sonderschicht",
      },
      ""
    );

    expect(display.tooltipBody).toContain("Sonder");
    expect(display.tooltipBody).not.toContain("Schicht:");
  });

  it("accepts null jobsLabel", () => {
    const display = buildShiftCardDisplayContent(
      {
        employeeName: "Alexa Bello",
        startTime: "08:00",
        endTime: "10:00",
        shiftName: "Früh",
      },
      null
    );

    expect(display.jobsLabel).toBe("");
    expect(display.tooltipBody).not.toContain("Job:");
  });
});
