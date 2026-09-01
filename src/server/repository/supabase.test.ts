import { describe, expect, it, vi } from "vitest";

import { SupabaseTripRepository } from "./supabase";

describe("SupabaseTripRepository personal-link claims", () => {
  it("calls the owner-only atomic claim RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ participant_id: "daekyeom", participant_role: "admin" }],
      error: null,
    });
    const repository = new SupabaseTripRepository({ rpc } as never);
    const createdAt = new Date("2026-08-31T00:00:00.000Z");
    const expiresAt = new Date("2026-10-13T14:59:59.000Z");

    expect(repository.claimOwnerToken).toBeTypeOf("function");
    await expect(repository.claimOwnerToken("owner-claim-hash", {
      id: "11111111-1111-4111-8111-111111111111",
      tokenHash: "owner-session-hash",
      createdAt,
      expiresAt,
    })).resolves.toEqual({ participantId: "daekyeom", role: "admin" });
    expect(rpc).toHaveBeenCalledWith("claim_owner_token", {
      request_token_hash: "owner-claim-hash",
      request_session_id: "11111111-1111-4111-8111-111111111111",
      request_session_token_hash: "owner-session-hash",
      request_created_at: "2026-08-31T00:00:00.000Z",
      request_expires_at: "2026-10-13T14:59:59.000Z",
    });
  });

  it("uses the atomic claim RPC and maps its participant role", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ participant_id: "gyuyeol", participant_role: "contributor" }],
      error: null,
    });
    const repository = new SupabaseTripRepository({ rpc } as never);
    const createdAt = new Date("2026-08-30T00:00:00.000Z");
    const expiresAt = new Date("2026-10-13T14:59:59.000Z");

    await expect((repository as never as {
      claimPersonalToken(tokenHash: string, session: {
        id: string;
        tokenHash: string;
        createdAt: Date;
        expiresAt: Date;
      }): Promise<unknown>;
    }).claimPersonalToken("claim-hash", {
      id: "11111111-1111-4111-8111-111111111111",
      tokenHash: "session-hash",
      createdAt,
      expiresAt,
    })).resolves.toEqual({ participantId: "gyuyeol", role: "contributor" });
    expect(rpc).toHaveBeenCalledWith("claim_participant_token", {
      request_token_hash: "claim-hash",
      request_session_id: "11111111-1111-4111-8111-111111111111",
      request_session_token_hash: "session-hash",
      request_created_at: "2026-08-30T00:00:00.000Z",
      request_expires_at: "2026-10-13T14:59:59.000Z",
    });
  });
});
