import { afterEach, describe, expect, it, vi } from "vitest";
import { isSuperadminDeveloperEmail } from "./superadmin-access";

describe("isSuperadminDeveloperEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when SUPERADMIN_EMAILS is unset", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", "");
    vi.resetModules();
    return import("./superadmin-access").then(({ isSuperadminDeveloperEmail }) => {
      expect(isSuperadminDeveloperEmail("dev@example.com")).toBe(false);
    });
  });

  it("matches allowlisted emails case-insensitively", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", " Dev@Example.com , other@test.de ");
    vi.resetModules();
    return import("./superadmin-access").then(({ isSuperadminDeveloperEmail }) => {
      expect(isSuperadminDeveloperEmail("dev@example.com")).toBe(true);
      expect(isSuperadminDeveloperEmail("other@test.de")).toBe(true);
      expect(isSuperadminDeveloperEmail("admin@example.com")).toBe(false);
    });
  });
});

describe("isSuperadminDeveloperEmail (module default)", () => {
  it("returns false for empty email", () => {
    expect(isSuperadminDeveloperEmail(null)).toBe(false);
    expect(isSuperadminDeveloperEmail("")).toBe(false);
  });
});
