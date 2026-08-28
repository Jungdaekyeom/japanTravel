import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashParticipantCode, hashSessionToken, verifyParticipantCode } from "./crypto";

describe("participant code crypto", () => {
  it("verifies the original six-digit code but not a different code", async () => {
    const salt = randomBytes(16).toString("base64url");
    const hash = await hashParticipantCode("123456", salt, "test-pepper");

    await expect(verifyParticipantCode("123456", salt, hash, "test-pepper")).resolves.toBe(true);
    await expect(verifyParticipantCode("123457", salt, hash, "test-pepper")).resolves.toBe(false);
  });

  it("hashes session tokens with SHA-256 without preserving the token", () => {
    const token = "test-session-token";

    expect(hashSessionToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashSessionToken(token)).not.toContain(token);
  });
});
