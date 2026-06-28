import { describe, expect, it } from "vitest";
import { communicationHubShiftHorizonEnd } from "@/lib/communication-hub-scope-data";

describe("communicationHubShiftHorizonEnd", () => {
  it("extends the horizon by two years", () => {
    expect(communicationHubShiftHorizonEnd("2026-06-25")).toBe("2028-06-25");
  });
});
