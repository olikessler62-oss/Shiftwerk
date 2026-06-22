import { describe, expect, it } from "vitest";
import { sanitizeAuthNextPath } from "./auth-callback";

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
