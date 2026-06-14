import { describe, expect, it } from "vitest";
import {
  profileEligibleForShiftConfirmationAssignment,
  resolveConfirmationAssignPatch,
  resolveInitialConfirmationStatus,
  validateProfileForShiftConfirmationAssign,
} from "./shift-confirmation-assign";

const baseProfile = {
  organization_id: "org-1",
  is_active: true,
  schedulable: true,
  app_registered_at: null as string | null,
  email_fallback_mode: false,
};

const baseShift = {
  employee_id: "emp-1",
  location_id: "loc-1",
  location_area_id: "area-1",
  area_shift_template_id: "tpl-1",
  shift_date: "2026-06-10",
  starts_at: "2026-06-10T08:00:00.000Z",
  ends_at: "2026-06-10T16:00:00.000Z",
  notes: null as string | null,
};

describe("resolveInitialConfirmationStatus", () => {
  it("returns proposed when feature enabled", () => {
    expect(resolveInitialConfirmationStatus(true)).toBe("proposed");
  });

  it("returns confirmed when feature disabled", () => {
    expect(resolveInitialConfirmationStatus(false)).toBe("confirmed");
  });
});

describe("profileEligibleForShiftConfirmationAssignment", () => {
  it("requires app registration or email fallback", () => {
    expect(profileEligibleForShiftConfirmationAssignment(baseProfile)).toBe(false);
    expect(
      profileEligibleForShiftConfirmationAssignment({
        ...baseProfile,
        app_registered_at: "2026-01-01T00:00:00Z",
      })
    ).toBe(true);
    expect(
      profileEligibleForShiftConfirmationAssignment({
        ...baseProfile,
        email_fallback_mode: true,
      })
    ).toBe(true);
  });
});

describe("validateProfileForShiftConfirmationAssign", () => {
  it("blocks unregistered employees when feature enabled", () => {
    expect(
      validateProfileForShiftConfirmationAssign(baseProfile, "org-1", true)
    ).toEqual({ ok: false, error: expect.stringContaining("App-Registrierung") });
  });

  it("allows registered employees when feature enabled", () => {
    expect(
      validateProfileForShiftConfirmationAssign(
        { ...baseProfile, app_registered_at: "2026-01-01T00:00:00Z" },
        "org-1",
        true
      )
    ).toEqual({ ok: true });
  });

  it("skips gate when feature disabled", () => {
    expect(
      validateProfileForShiftConfirmationAssign(baseProfile, "org-1", false)
    ).toEqual({ ok: true });
  });
});

describe("resolveConfirmationAssignPatch", () => {
  it("sets proposed on new shift when feature enabled", () => {
    const patch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled: true,
      existing: null,
      next: baseShift,
    });
    expect(patch.confirmation_status).toBe("proposed");
    expect(patch.requested_at).toBeNull();
  });

  it("resets requested to proposed when times change", () => {
    const patch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled: true,
      existing: { ...baseShift, confirmation_status: "requested" },
      next: { ...baseShift, ends_at: "2026-06-10T18:00:00.000Z" },
    });
    expect(patch.confirmation_status).toBe("proposed");
    expect(patch.requested_at).toBeNull();
  });

  it("leaves status unchanged when plan is unchanged", () => {
    const patch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled: true,
      existing: { ...baseShift, confirmation_status: "requested" },
      next: baseShift,
    });
    expect(patch).toEqual({});
  });

  it("does not reset proposed on plan change", () => {
    const patch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled: true,
      existing: { ...baseShift, confirmation_status: "proposed" },
      next: { ...baseShift, ends_at: "2026-06-10T18:00:00.000Z" },
    });
    expect(patch).toEqual({});
  });
});
