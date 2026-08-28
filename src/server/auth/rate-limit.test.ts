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
      loginAttempts: [{ id: "1", ipHash: "ip-a", attemptedAt: new Date("2026-08-28T00:00:00.000Z") }],
    });

    await expect(repository.reserveLoginAttempt("ip-a", now)).resolves.toBeTruthy();
  });
});
