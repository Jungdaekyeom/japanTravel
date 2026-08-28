import { describe, expect, it } from "vitest";

import { isLoginRateLimited } from "./rate-limit";
import { InMemoryTripRepository } from "../repository/memory";

describe("login rate limits", () => {
  it("blocks the sixth failed attempt from one IP within fifteen minutes", async () => {
    const now = new Date("2026-08-28T00:00:00.000Z");
    const repository = new InMemoryTripRepository({
      loginAttempts: Array.from({ length: 5 }, (_, index) => ({
        id: String(index),
        ipHash: "ip-a",
        attemptedAt: new Date(now.getTime() - 60_000),
      })),
    });

    await expect(isLoginRateLimited(repository, "ip-a", now)).resolves.toBe(true);
  });

  it("blocks an IP when fifty failures occurred globally within fifteen minutes", async () => {
    const now = new Date("2026-08-28T00:00:00.000Z");
    const repository = new InMemoryTripRepository({
      loginAttempts: Array.from({ length: 50 }, (_, index) => ({
        id: String(index),
        ipHash: `ip-${index}`,
        attemptedAt: new Date(now.getTime() - 60_000),
      })),
    });

    await expect(isLoginRateLimited(repository, "new-ip", now)).resolves.toBe(true);
  });

  it("allows attempts after the fifteen-minute window expires", async () => {
    const now = new Date("2026-08-28T00:16:00.000Z");
    const repository = new InMemoryTripRepository({
      loginAttempts: [{ id: "1", ipHash: "ip-a", attemptedAt: new Date("2026-08-28T00:00:00.000Z") }],
    });

    await expect(isLoginRateLimited(repository, "ip-a", now)).resolves.toBe(false);
  });
});
