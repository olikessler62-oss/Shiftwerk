import { describe, expect, it } from "vitest";
import { resolveEffectiveConfirmationStatus } from "./shift-confirmation-pending";

describe("resolveEffectiveConfirmationStatus", () => {
  it("maps overdue requested to pending for display", () => {
    const now = new Date("2025-06-09T13:00:00.000Z");
    expect(
      resolveEffectiveConfirmationStatus(
        "requested",
        "2025-06-09T10:00:00.000Z",
        now
      )
    ).toBe("pending");
  });

  it("keeps recent requested as requested", () => {
    const now = new Date("2025-06-09T11:00:00.000Z");
    expect(
      resolveEffectiveConfirmationStatus(
        "requested",
        "2025-06-09T10:00:00.000Z",
        now
      )
    ).toBe("requested");
  });

  it("passes through other statuses unchanged", () => {
    expect(resolveEffectiveConfirmationStatus("proposed", null)).toBe("proposed");
    expect(resolveEffectiveConfirmationStatus("pending", "2025-06-09T10:00:00.000Z")).toBe(
      "pending"
    );
  });
});
