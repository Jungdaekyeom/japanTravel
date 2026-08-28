import { describe, expect, it } from "vitest";

import nextConfig, { buildContentSecurityPolicy } from "../next.config";

function directive(policy: string, name: string) {
  return policy.split("; ").find((value) => value.startsWith(`${name} `)) ?? "";
}

describe("Google Maps security headers", () => {
  it("keeps the current Google Maps JavaScript allowlist on trip pages", async () => {
    const rules = await nextConfig.headers?.();
    const mapRule = rules?.find(({ source }) => source === "/t/:path*");
    const productionPolicy = buildContentSecurityPolicy({ development: false, googleMaps: true });
    const script = directive(productionPolicy, "script-src");
    const connect = directive(productionPolicy, "connect-src");

    expect(mapRule).toBeDefined();
    expect(script).toContain("'unsafe-eval'");
    expect(script).toContain("https://*.googleapis.com");
    expect(script).toContain("https://*.gstatic.com");
    expect(script).toContain("*.google.com");
    expect(script).toContain("https://*.ggpht.com");
    expect(script).toContain("*.googleusercontent.com");
    expect(script).toContain("blob:");
    expect(productionPolicy).toContain("frame-src *.google.com");
    expect(connect).toContain("data: blob:");
  });

  it("does not relax non-map production pages", () => {
    const policy = buildContentSecurityPolicy({ development: false, googleMaps: false });

    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("*.googleusercontent.com");
    expect(policy).not.toContain("frame-src *.google.com");
    expect(policy).toContain("frame-src 'none'");
  });
});
