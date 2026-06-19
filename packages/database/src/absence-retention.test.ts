import { describe, expect, it } from "vitest";
import {
  ABSENCE_RETENTION_MONTHS,
  absencePurgeCutoffISO,
  isAbsenceEligibleForPurge,
} from "./absence-retention";

describe("absence retention", () => {
  it("uses a twelve-month retention window", () => {
    expect(ABSENCE_RETENTION_MONTHS).toBe(12);
  });

  it("computes purge cutoff twelve calendar months before reference date", () => {
    expect(absencePurgeCutoffISO(new Date(2026, 5, 17))).toBe("2025-06-17");
  });

  it("purges closed absences whose end date is before the cutoff", () => {
    expect(
      isAbsenceEligibleForPurge({ end_date: "2025-06-16" }, "2025-06-17")
    ).toBe(true);
    expect(
      isAbsenceEligibleForPurge({ end_date: "2025-06-17" }, "2025-06-17")
    ).toBe(false);
  });

  it("never purges absences without an end date", () => {
    expect(isAbsenceEligibleForPurge({ end_date: null }, "2025-06-17")).toBe(
      false
    );
  });
});
