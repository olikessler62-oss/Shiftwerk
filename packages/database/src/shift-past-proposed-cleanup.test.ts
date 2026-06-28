import { describe, expect, it } from "vitest";
import { shouldAutoRemovePastProposedShift } from "./shift-past-proposed-cleanup";

describe("shouldAutoRemovePastProposedShift", () => {
  const now = new Date("2026-06-25T12:00:00.000Z");

  it("removes past proposed shifts from planning calendars", () => {
    expect(
      shouldAutoRemovePastProposedShift("proposed", "2026-06-22", now)
    ).toBe(true);
  });

  it("keeps future proposed and other past statuses", () => {
    expect(
      shouldAutoRemovePastProposedShift("proposed", "2026-06-26", now)
    ).toBe(false);
    expect(
      shouldAutoRemovePastProposedShift("requested", "2026-06-22", now)
    ).toBe(false);
    expect(
      shouldAutoRemovePastProposedShift("rejected", "2026-06-22", now)
    ).toBe(false);
    expect(
      shouldAutoRemovePastProposedShift("canceled", "2026-06-22", now)
    ).toBe(false);
    expect(
      shouldAutoRemovePastProposedShift("confirmed", "2026-06-22", now)
    ).toBe(false);
  });
});
