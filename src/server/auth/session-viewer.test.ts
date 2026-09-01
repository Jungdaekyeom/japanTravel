import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./crypto";
import { getViewer } from "./session";
import { InMemoryTripRepository } from "../repository/memory";

describe("getViewer", () => {
  const activeToken = "a".repeat(43);
  const participant = {
    id: "daekyeom",
    name: "정대겸",
    birthYear: 1993,
    departureCity: "부산" as const,
    role: "admin" as const,
    codeSalt: "salt",
    codeHash: "hash",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  it("resolves an exact bearer token without a cookie", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant],
      sessions: [{
        id: "owner-session",
        participantId: "daekyeom",
        tokenHash: hashSessionToken(activeToken),
        createdAt: new Date("2026-08-30T00:00:00.000Z"),
        expiresAt: new Date("2026-10-13T14:59:59.000Z"),
      }],
    });

    await expect(getViewer(
      new Request("https://example.test", { headers: { authorization: `Bearer ${activeToken}` } }),
      repository,
      new Date("2026-08-31T00:00:00.000Z"),
    )).resolves.toEqual({ id: "daekyeom", role: "admin" });
  });

  it.each([
    "bearer " + activeToken,
    "Bearer short",
    "Bearer  " + activeToken,
    "Basic " + activeToken,
  ])("does not fall back to a valid cookie when Authorization is malformed: %s", async (authorization) => {
    const repository = new InMemoryTripRepository({
      participants: [participant],
      sessions: [{
        id: "cookie-session",
        participantId: "daekyeom",
        tokenHash: hashSessionToken("cookie-token"),
        createdAt: new Date("2026-08-30T00:00:00.000Z"),
        expiresAt: new Date("2026-10-13T14:59:59.000Z"),
      }],
    });

    await expect(getViewer(new Request("https://example.test", {
      headers: { authorization, cookie: "jt_session=cookie-token" },
    }), repository)).resolves.toEqual({ role: "observer" });
  });

  it("treats an expired valid token as an observer", async () => {
    const repository = new InMemoryTripRepository({
      participants: [
        {
          id: "gyuyeol",
          name: "이규열",
          birthYear: 1998,
          departureCity: "인천",
          role: "contributor",
          codeSalt: "salt",
          codeHash: "hash",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
      sessions: [
        {
          id: "session-1",
          participantId: "gyuyeol",
          tokenHash: hashSessionToken("expired-token"),
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          expiresAt: new Date("2026-08-02T00:00:00.000Z"),
        },
      ],
    });

    const viewer = await getViewer(
      new Request("https://example.test", { headers: { cookie: "jt_session=expired-token" } }),
      repository,
      new Date("2026-08-03T00:00:00.000Z"),
    );

    expect(viewer).toEqual({ role: "observer" });
  });
});
