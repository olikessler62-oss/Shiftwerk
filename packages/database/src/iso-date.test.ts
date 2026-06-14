import { describe, expect, it } from "vitest";
import { dayAfter, dayBefore } from "./profile-hourly-rate-validation";

describe("dayBefore / dayAfter", () => {
  it("steps calendar days without server timezone drift", () => {
    expect(dayBefore("2026-06-14")).toBe("2026-06-13");
    expect(dayAfter("2026-06-14")).toBe("2026-06-15");
  });

  it("handles month boundaries", () => {
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayAfter("2026-02-28")).toBe("2026-03-01");
  });
});
