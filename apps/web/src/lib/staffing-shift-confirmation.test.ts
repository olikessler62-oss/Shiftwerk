import { describe, expect, it } from "vitest";
import {
  countsTowardStaffingConfirmation,
  countsTowardStaffingProjection,
} from "./staffing-shift-confirmation";

describe("staffing-shift-confirmation", () => {
  it("treats confirmed and missing status as confirmed coverage", () => {
    expect(countsTowardStaffingConfirmation("confirmed")).toBe(true);
    expect(countsTowardStaffingConfirmation(undefined)).toBe(true);
    expect(countsTowardStaffingConfirmation("proposed")).toBe(false);
  });

  it("includes open planning statuses in projection", () => {
    expect(countsTowardStaffingProjection("confirmed")).toBe(true);
    expect(countsTowardStaffingProjection("proposed")).toBe(true);
    expect(countsTowardStaffingProjection("requested")).toBe(true);
    expect(countsTowardStaffingProjection("pending")).toBe(true);
    expect(countsTowardStaffingProjection("unresolved")).toBe(true);
    expect(countsTowardStaffingProjection("rejected")).toBe(false);
    expect(countsTowardStaffingProjection("canceled")).toBe(false);
  });
});
