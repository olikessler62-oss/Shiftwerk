import { describe, expect, it } from "vitest";

import { createPlanningPastShiftChecker } from "@/lib/planning-past-shift-time";
import {
  isPlanningDayEditLocked,
  isPlanningEditHardBlocked,
  requiresPastPlanningConfirm,
} from "@/lib/planning-past-day-edit-guard";

const timeZone = "Europe/Berlin";
const now = new Date("2026-06-17T14:00:00.000Z");

describe("planning-past-day-edit-guard", () => {
  const checkerAllowPast = createPlanningPastShiftChecker(true, timeZone, now);
  const checkerBlockPast = createPlanningPastShiftChecker(false, timeZone, now);
  const pastMoment = { shiftDateISO: "2026-06-10", startTime: "08:00" };
  const futureMoment = { shiftDateISO: "2026-06-20", startTime: "08:00" };

  it("hard-blocks past moments when org setting is off", () => {
    expect(
      isPlanningEditHardBlocked(checkerBlockPast, false, pastMoment)
    ).toBe(true);
    expect(
      isPlanningEditHardBlocked(checkerAllowPast, true, pastMoment)
    ).toBe(false);
  });

  it("requires confirm when past edits are allowed but session is fresh", () => {
    expect(
      requiresPastPlanningConfirm(checkerAllowPast, true, false, pastMoment)
    ).toBe(true);
    expect(
      requiresPastPlanningConfirm(checkerAllowPast, true, true, pastMoment)
    ).toBe(false);
    expect(
      requiresPastPlanningConfirm(checkerAllowPast, true, false, futureMoment)
    ).toBe(false);
  });

  it("locks day edits until confirm or after session confirm", () => {
    expect(
      isPlanningDayEditLocked(checkerAllowPast, true, false, pastMoment)
    ).toBe(true);
    expect(
      isPlanningDayEditLocked(checkerAllowPast, true, true, pastMoment)
    ).toBe(false);
    expect(
      isPlanningDayEditLocked(checkerBlockPast, false, false, pastMoment)
    ).toBe(true);
  });
});
