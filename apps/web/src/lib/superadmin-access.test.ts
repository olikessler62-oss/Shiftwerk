import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSuperadminDeveloperEmail,
  isSuperadminDeveloperForEmails,
} from "./superadmin-access";

describe("isSuperadminDeveloperEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when SUPERADMIN_EMAILS is unset", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", "");
    expect(isSuperadminDeveloperEmail("dev@example.com")).toBe(false);
  });

  it("matches allowlisted emails case-insensitively", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", " Dev@Example.com , other@test.de ");
    expect(isSuperadminDeveloperEmail("dev@example.com")).toBe(true);
    expect(isSuperadminDeveloperEmail("other@test.de")).toBe(true);
    expect(isSuperadminDeveloperEmail("admin@example.com")).toBe(false);
  });

  it("returns false for empty email", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", "dev@example.com");
    expect(isSuperadminDeveloperEmail(null)).toBe(false);
    expect(isSuperadminDeveloperEmail("")).toBe(false);
  });
});

describe("isSuperadminDeveloperForEmails", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches when any email in the list is allowlisted", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", "oli.kessler62@gmail.com");
    expect(
      isSuperadminDeveloperForEmails([
        "other@example.com",
        "oli.kessler62@gmail.com",
      ])
    ).toBe(true);
    expect(
      isSuperadminDeveloperForEmails(["other@example.com", null])
    ).toBe(false);
  });
});
