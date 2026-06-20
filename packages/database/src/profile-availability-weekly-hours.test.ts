import { describe, expect, it } from "vitest";
import {
  evaluateProfileAvailabilityWeeklyLimits,
  formatLegalWeeklyHoursExceededError,
  sumProfileAvailabilityMaxWeeklyHours,
  validateProfileWeeklyHoursLegalLimit,
} from "./profile-availability-weekly-hours";

describe("profile availability weekly hours", () => {
  it("sums availability slot durations across the week", () => {
    expect(
      sumProfileAvailabilityMaxWeeklyHours([
        { start_time: "07:00:00", end_time: "15:00:00" },
        { start_time: "07:00:00", end_time: "15:00:00" },
      ])
    ).toBe(16);
  });

  it("blocks weekly hours above the legal maximum", () => {
    const result = validateProfileWeeklyHoursLegalLimit({ weeklyHours: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        formatLegalWeeklyHoursExceededError({ hours: 50, legalMax: 48 })
      );
    }
  });

  it("flags availability that exceeds the legal maximum", () => {
    const evaluation = evaluateProfileAvailabilityWeeklyLimits({
      availabilities: Array.from({ length: 7 }, () => ({
        start_time: "07:00:00",
        end_time: "15:00:00",
      })),
      weeklyHoursTarget: 40,
    });
    expect(evaluation.availabilityHours).toBe(56);
    expect(evaluation.violations[0]?.kind).toBe("availability_exceeds_legal");
  });

  it("warns when availability exceeds the target but stays legal", () => {
    const evaluation = evaluateProfileAvailabilityWeeklyLimits({
      availabilities: [
        { start_time: "07:00:00", end_time: "15:00:00" },
        { start_time: "07:00:00", end_time: "15:00:00" },
        { start_time: "07:00:00", end_time: "15:00:00" },
        { start_time: "07:00:00", end_time: "15:00:00" },
        { start_time: "07:00:00", end_time: "15:00:00" },
      ],
      weeklyHoursTarget: 38,
    });
    expect(evaluation.violations[0]?.kind).toBe("availability_exceeds_target");
  });
});
