import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

describe("owner code issuance", () => {
  it("upserts only daekyeom's hashed token, prints only the raw code, and never touches sessions", async () => {
    const ownerCode = await import("./issue-owner-code").catch(() => ({ createOwnerCode: undefined, persistOwnerCode: undefined }));
    expect(ownerCode.createOwnerCode).toBeTypeOf("function");
    expect(ownerCode.persistOwnerCode).toBeTypeOf("function");
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table !== "participant_claim_tokens") throw new Error(`unexpected table: ${table}`);
      return { upsert };
    });
    const writeLine = vi.fn();
    const rawCode = "z".repeat(43);
    const issued = ownerCode.createOwnerCode!(() => rawCode, new Date("2026-08-31T00:00:00.000Z"));

    await ownerCode.persistOwnerCode!({ client: { from } as never, issued, writeLine });

    expect(upsert).toHaveBeenCalledWith({
      participant_id: "daekyeom",
      token_hash: createHash("sha256").update(`japan-travel:owner-claim:v1:${rawCode}`).digest("hex"),
      issued_at: "2026-08-31T00:00:00.000Z",
      consumed_at: null,
    }, { onConflict: "participant_id" });
    expect(writeLine).toHaveBeenCalledWith(rawCode);
    expect(writeLine).toHaveBeenCalledTimes(1);
    expect(writeLine.mock.calls.flat().join("\n")).not.toMatch(/https?:|daekyeom|#join=/);
  });

  it("prints nothing when the token upsert fails", async () => {
    const ownerCode = await import("./issue-owner-code").catch(() => ({ createOwnerCode: undefined, persistOwnerCode: undefined }));
    expect(ownerCode.createOwnerCode).toBeTypeOf("function");
    expect(ownerCode.persistOwnerCode).toBeTypeOf("function");
    const writeLine = vi.fn();
    const issued = ownerCode.createOwnerCode!(() => "z".repeat(43));

    await expect(ownerCode.persistOwnerCode!({
      client: { from: () => ({ upsert: async () => ({ error: { message: "database unavailable" } }) }) } as never,
      issued,
      writeLine,
    })).rejects.toThrow("database unavailable");
    expect(writeLine).not.toHaveBeenCalled();
  });
});
