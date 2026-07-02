import { describe, expect, it } from "vitest";
import { applyPendingEmployeeCancellationToShiftTooltip } from "./shift-card-tooltip-confirmation";

describe("applyPendingEmployeeCancellationToShiftTooltip", () => {
  const baseTooltip = {
    employeeName: "Klaus Mustermann",
    confirmationStatusLine: "Bestätigt",
    confirmationStatus: "confirmed" as const,
  };

  it("replaces confirmed tooltip status when employee cancellation is pending", () => {
    const result = applyPendingEmployeeCancellationToShiftTooltip(
      baseTooltip,
      {
        lifecycle: "confirmed",
        legacyConfirmationStatus: "confirmed",
        openCancellation: {
          requestId: "cancel-1",
          status: "pending",
          cancelledBy: "employee",
          reason: "Kurzfristig krank",
        },
      },
      "Absage angefragt",
      "Kurzfristig krank"
    );

    expect(result.confirmationStatusLine).toBe("Absage angefragt");
    expect(result.employeeCancellationPending).toBe(true);
    expect(result.employeeCancellationReason).toBe("Kurzfristig krank");
  });

  it("leaves tooltip unchanged without open employee cancellation", () => {
    const result = applyPendingEmployeeCancellationToShiftTooltip(
      baseTooltip,
      {
        lifecycle: "confirmed",
        legacyConfirmationStatus: "confirmed",
      },
      "Absage angefragt"
    );

    expect(result).toEqual(baseTooltip);
  });
});
