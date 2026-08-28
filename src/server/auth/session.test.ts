import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./crypto";
import { SESSION_EXPIRES_AT, issueSession } from "./session";

describe("issueSession", () => {
  it("issues a 256-bit raw token while retaining only its SHA-256 hash in the record", () => {
    const issued = issueSession("gyuyeol", new Date("2026-08-28T00:00:00.000Z"));

    expect(Buffer.from(issued.token, "base64url")).toHaveLength(32);
    expect(issued.session.tokenHash).toBe(hashSessionToken(issued.token));
    expect(issued.session.tokenHash).not.toBe(issued.token);
    expect(issued.session.participantId).toBe("gyuyeol");
    expect(issued.session.expiresAt.toISOString()).toBe(SESSION_EXPIRES_AT.toISOString());
  });
});
