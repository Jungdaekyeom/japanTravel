import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "../repository/memory";

describe("login rate limits", () => {
  it("atomically allows at most five concurrent reservations from one IP", async () => {
    const now = new Date("2026-08-28T00:00:00.000Z");
    const repository = new InMemoryTripRepository();
    const reservations = await Promise.all(
      Array.from({ length: 10 }, () => repository.reserveLoginAttempt("ip-a", now)),
    );

    expect(reservations.filter(Boolean)).toHaveLength(5);
  });

  it("atomically allows at most fifty global reservations", async () => {
    const now = new Date("2026-08-28T00:00:00.000Z");
    const repository = new InMemoryTripRepository();
    const reservations = await Promise.all(
      Array.from({ length: 55 }, (_, index) => repository.reserveLoginAttempt(`ip-${index}`, now)),
    );

    expect(reservations.filter(Boolean)).toHaveLength(50);
  });

  it("allows attempts after the fifteen-minute window expires", async () => {
    const now = new Date("2026-08-28T00:16:00.000Z");
    const repository = new InMemoryTripRepository({
      loginAttempts: [{ id: "1", ipHash: "ip-a", attemptedAt: new Date("2026-08-28T00:00:00.000Z"), status: "finalized" }],
    });

    await expect(repository.reserveLoginAttempt("ip-a", now)).resolves.toBeTruthy();
  });

  it("expires pending reservations after one minute but keeps finalized invalid attempts for fifteen minutes", async () => {
    const start = new Date("2026-08-28T00:00:00.000Z");
    const pending = new InMemoryTripRepository();
    const pendingIds = await Promise.all(Array.from({ length: 5 }, () => pending.reserveLoginAttempt("ip-a", start)));
    expect(await pending.reserveLoginAttempt("ip-a", new Date("2026-08-28T00:01:00.000Z"))).toBeTruthy();

    const finalized = new InMemoryTripRepository();
    const finalizedIds = await Promise.all(Array.from({ length: 5 }, () => finalized.reserveLoginAttempt("ip-a", start)));
    await Promise.all(finalizedIds.filter(Boolean).map((id) => finalized.finalizeLoginAttempt(id!)));
    expect(await finalized.reserveLoginAttempt("ip-a", new Date("2026-08-28T00:01:00.000Z"))).toBeNull();
    expect(await finalized.reserveLoginAttempt("ip-a", new Date("2026-08-28T00:14:59.000Z"))).toBeNull();
    expect(await finalized.reserveLoginAttempt("ip-a", new Date("2026-08-28T00:15:00.000Z"))).toBeTruthy();
    expect(pendingIds.filter(Boolean)).toHaveLength(5);
  });
});
