import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./crypto";
import { getViewer } from "./session";
import { InMemoryTripRepository } from "../repository/memory";

describe("getViewer", () => {
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
