import { describe, expect, it } from "vitest";
import {
  PROFILE_DUPLICATE_FULL_NAME_ERROR,
  validateProfileFullNameUniqueness,
} from "./profile-name-validation";

describe("validateProfileFullNameUniqueness", () => {
  const existing = [
    { id: "p1", full_name: "Max Mustermann" },
    { id: "p2", full_name: "Anna Schmidt" },
  ];

  it("accepts a unique name", () => {
    expect(
      validateProfileFullNameUniqueness(existing, { full_name: "Lisa Meyer" })
    ).toEqual({ ok: true });
  });

  it("rejects duplicate names case-insensitively", () => {
    expect(
      validateProfileFullNameUniqueness(existing, { full_name: "max mustermann" })
    ).toEqual({ ok: false, error: PROFILE_DUPLICATE_FULL_NAME_ERROR });
  });

  it("allows keeping the same name when editing the same profile", () => {
    expect(
      validateProfileFullNameUniqueness(existing, {
        full_name: "Max Mustermann",
        excludeId: "p1",
      })
    ).toEqual({ ok: true });
  });

  it("rejects renaming to another profile's name", () => {
    expect(
      validateProfileFullNameUniqueness(existing, {
        full_name: "Anna Schmidt",
        excludeId: "p1",
      })
    ).toEqual({ ok: false, error: PROFILE_DUPLICATE_FULL_NAME_ERROR });
  });
});
