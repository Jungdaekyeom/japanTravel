import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./crypto";

describe("session crypto", () => {
  it("hashes session tokens with SHA-256 without preserving the token", () => {
    const token = "test-session-token";

    expect(hashSessionToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashSessionToken(token)).not.toContain(token);
  });
});
