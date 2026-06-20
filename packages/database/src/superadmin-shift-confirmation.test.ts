import { describe, expect, it } from "vitest";
import { buildSuperadminConfirmationStatusPatch } from "./superadmin-shift-confirmation";

describe("buildSuperadminConfirmationStatusPatch", () => {
  const now = "2026-06-17T12:00:00.000Z";

  it("clears pending fields for proposed and confirmed", () => {
    expect(buildSuperadminConfirmationStatusPatch("proposed", now)).toEqual({
      confirmation_status: "proposed",
      confirmation_status_updated_at: now,
      lifecycle_status: "planned",
      requested_at: null,
      pending_since: null,
      pending_reminder_sent_at: null,
    });
    expect(buildSuperadminConfirmationStatusPatch("confirmed", now).requested_at).toBe(
      null
    );
  });

  it("sets requested and pending timestamps for matching statuses", () => {
    expect(buildSuperadminConfirmationStatusPatch("requested", now).requested_at).toBe(
      now
    );
    expect(buildSuperadminConfirmationStatusPatch("pending", now)).toMatchObject({
      requested_at: now,
      pending_since: now,
    });
  });
});
