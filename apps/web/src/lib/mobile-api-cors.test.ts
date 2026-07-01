import { afterEach, describe, expect, it, vi } from "vitest";
import { mobileApiCorsHeaders } from "./mobile-api-cors";

describe("mobileApiCorsHeaders", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
    vi.unstubAllEnvs();
  });

  it("allows localhost origins only in development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");

    const request = new Request("https://app.example.com/api/mobile/ping", {
      headers: { origin: "http://localhost:8081" },
    });

    expect(mobileApiCorsHeaders(request)).toEqual({});
  });

  it("allows localhost origins in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");

    const request = new Request("https://app.example.com/api/mobile/ping", {
      headers: { origin: "http://localhost:8081" },
    });

    expect(mobileApiCorsHeaders(request)).toMatchObject({
      "Access-Control-Allow-Origin": "http://localhost:8081",
    });
  });
});
