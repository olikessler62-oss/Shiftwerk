import { describe, expect, it } from "vitest";
import {
  communicationTabActions,
  communicationTabShowsSelection,
} from "@/lib/communication-tab-actions";

describe("communicationTabActions", () => {
  it("maps each tab to the expected button bar actions", () => {
    expect(communicationTabActions("conflicts")).toEqual([
      "reassign",
      "cancel",
      "delete",
    ]);
    expect(communicationTabActions("swaps")).toEqual([]);
    expect(communicationTabActions("proposed")).toEqual([
      "requestConfirmation",
      "delete",
    ]);
    expect(communicationTabActions("requested")).toEqual(["cancel"]);
    expect(communicationTabActions("rejected")).toEqual(["reassign", "delete"]);
    expect(communicationTabActions("pending")).toEqual([
      "cancel",
      "requestConfirmation",
    ]);
    expect(communicationTabActions("canceled")).toEqual(["reassign", "delete"]);
    expect(communicationTabActions("unresolved")).toEqual(["delete"]);
  });

  it("shows selection for every actionable tab", () => {
    for (const tab of [
      "conflicts",
      "proposed",
      "requested",
      "rejected",
      "pending",
      "canceled",
      "unresolved",
    ] as const) {
      expect(communicationTabShowsSelection(tab)).toBe(true);
    }

    expect(communicationTabShowsSelection("swaps")).toBe(false);
  });
});
