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
    expect(display.tooltipBody).toContain("Tätigkeit: Kellner/in");
  });

  it("shows Einsatzzeit label when times do not match a template", () => {
    const display = buildShiftCardDisplayContent(
      {
        employeeName: "Alexa Bello",
        startTime: "08:00",
        endTime: "16:00",
        shiftName: "Sonderschicht",
      },
      ""
    );

    expect(display.tooltipBody).toContain("Einsatzzeit:");
    expect(display.tooltipBody).toContain("08:00 – 16:00");
    expect(display.tooltipBody).not.toContain("Schicht:");
    expect(display.tooltipBody).not.toContain("Sonder");
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
    expect(display.tooltipBody).toContain("Einsatzzeit:");
    expect(display.tooltipBody).not.toContain("Tätigkeit:");
  });
});
