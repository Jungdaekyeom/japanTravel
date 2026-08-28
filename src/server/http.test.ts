import { afterEach, describe, expect, it, vi } from "vitest";

import { getClientIp } from "./http";

afterEach(() => vi.unstubAllEnvs());

describe("getClientIp", () => {
  it("uses Vercel's trusted client-IP header in production", () => {
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://example.test", {
      headers: { "x-vercel-forwarded-for": "198.51.100.8", "x-forwarded-for": "203.0.113.4" },
    });

    expect(getClientIp(request)).toBe("198.51.100.8");
  });

  it("fails closed to one unknown identity when Vercel's header is missing", () => {
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.4" } });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("uses x-forwarded-for only outside Vercel", () => {
    vi.stubEnv("VERCEL", "");
    const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" } });

    expect(getClientIp(request)).toBe("203.0.113.4");
  });
});
