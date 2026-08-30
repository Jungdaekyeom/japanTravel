import { afterEach, describe, expect, it, vi } from "vitest";

import { getPersonalLinkEnv, getServerEnv } from "./env";

const commonEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_example",
  SESSION_PEPPER: "a-secure-session-pepper",
};

const personalLinkEnv = {
  SUPABASE_URL: commonEnv.SUPABASE_URL,
  SUPABASE_SECRET_KEY: commonEnv.SUPABASE_SECRET_KEY,
  APP_ORIGIN: "https://trip.example.com",
  INVITE_TOKEN: "invite-token",
};

function stubEnvironment(values: Record<string, string>) {
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SESSION_PEPPER", "");
  vi.stubEnv("INVITE_TOKEN", "");
  vi.stubEnv("APP_ORIGIN", "");
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

afterEach(() => vi.unstubAllEnvs());

describe("server environment", () => {
  it("uses only the current Supabase secret key", () => {
    stubEnvironment({ ...commonEnv, INVITE_TOKEN: "invite-token" });

    expect(getServerEnv().SUPABASE_SECRET_KEY).toBe("sb_secret_example");
  });

  it("does not fall back to the legacy service-role variable", () => {
    stubEnvironment({
      SUPABASE_URL: commonEnv.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: "legacy-key",
      SESSION_PEPPER: commonEnv.SESSION_PEPPER,
      INVITE_TOKEN: "invite-token",
    });

    expect(() => getServerEnv()).toThrow("Missing required server environment variables");
  });

  it("requires the app origin and invite token for personal-link issuance", () => {
    stubEnvironment(personalLinkEnv);

    expect(getPersonalLinkEnv()).toEqual(personalLinkEnv);
  });
});
