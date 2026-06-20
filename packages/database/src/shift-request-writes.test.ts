import { describe, expect, it } from "vitest";
import {
  enrichShiftRowWithLifecycle,
  lifecycleStatusForConfirmationStatus,
} from "./shift-request-writes";

describe("lifecycleStatusForConfirmationStatus", () => {
  it("maps legacy confirmation statuses to lifecycle", () => {
    expect(lifecycleStatusForConfirmationStatus("proposed")).toBe("planned");
    expect(lifecycleStatusForConfirmationStatus("requested")).toBe("planned");
    expect(lifecycleStatusForConfirmationStatus("pending")).toBe("planned");
    expect(lifecycleStatusForConfirmationStatus("rejected")).toBe("planned");
    expect(lifecycleStatusForConfirmationStatus("confirmed")).toBe("confirmed");
    expect(lifecycleStatusForConfirmationStatus("canceled")).toBe("cancelled");
  });

  it("defaults missing status to confirmed", () => {
    expect(lifecycleStatusForConfirmationStatus(undefined)).toBe("confirmed");
    expect(lifecycleStatusForConfirmationStatus(null)).toBe("confirmed");
  });
});

describe("enrichShiftRowWithLifecycle", () => {
  it("adds lifecycle_status when confirmation_status is set", () => {
    expect(
      enrichShiftRowWithLifecycle({
        confirmation_status: "requested",
        confirmation_status_updated_at: "2026-06-17T12:00:00.000Z",
      })
    ).toMatchObject({
      confirmation_status: "requested",
      lifecycle_status: "planned",
    });
  });

  it("does not override an explicit lifecycle_status", () => {
    expect(
      enrichShiftRowWithLifecycle({
        confirmation_status: "confirmed",
        lifecycle_status: "planned",
      })
    ).toMatchObject({
      lifecycle_status: "planned",
    });
  });

  it("leaves rows without confirmation_status unchanged", () => {
    const row = { location_id: "loc-1" };
    expect(enrichShiftRowWithLifecycle(row)).toBe(row);
  });
});
