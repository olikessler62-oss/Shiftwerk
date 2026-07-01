import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthCallbackRedirectUrl,
  sanitizeAuthNextPath,
} from "./auth-callback";

describe("sanitizeAuthNextPath", () => {
  it("returns fallback for invalid paths", () => {
    expect(sanitizeAuthNextPath(null)).toBe("/dashboard");
    expect(sanitizeAuthNextPath("")).toBe("/dashboard");
    expect(sanitizeAuthNextPath("https://evil.com")).toBe("/dashboard");
    expect(sanitizeAuthNextPath("//evil.com")).toBe("/dashboard");
  });

  it("accepts safe relative paths", () => {
    expect(sanitizeAuthNextPath("/reset-password")).toBe("/reset-password");
    expect(sanitizeAuthNextPath("/app-only")).toBe("/app-only");
  });
});

describe("buildAuthCallbackRedirectUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects untrusted x-forwarded-host in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");

    const request = new Request("https://app.example.com/auth/callback", {
      headers: { "x-forwarded-host": "evil.example.com" },
    });

    expect(
      buildAuthCallbackRedirectUrl(request, "/dashboard")
    ).toBe("https://app.example.com/dashboard");
  });

  it("uses trusted x-forwarded-host when it matches NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");

    const request = new Request("https://internal.example.com/auth/callback", {
      headers: { "x-forwarded-host": "app.example.com" },
    });

    expect(
      buildAuthCallbackRedirectUrl(request, "/dashboard")
    ).toBe("https://app.example.com/dashboard");
  });
});
