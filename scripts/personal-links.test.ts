import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createPersonalLinks, persistPersonalLinks, parseIssueLinkMode } from "./personal-links";

describe("personal-link issuance", () => {
  it("builds four fragment URLs while keeping raw tokens out of database rows", () => {
    const participants = ["daekyeom", "gyuyeol", "junsu", "gyujun"].map((id) => ({ id }));
    const tokens = participants.map((_, index) => String.fromCharCode(97 + index).repeat(43));

    const issued = createPersonalLinks(
      participants,
      "https://trip.example.com",
      "invite-token",
      () => tokens.shift()!,
      new Date("2026-08-30T00:00:00.000Z"),
    );

    expect(issued).toHaveLength(4);
    expect(issued[0].url).toBe(`https://trip.example.com/t/invite-token#join=${"a".repeat(43)}`);
    expect(issued.map(({ row }) => row.token_hash)).toEqual(
      ["a", "b", "c", "d"].map((letter) => createHash("sha256").update(letter.repeat(43)).digest("hex")),
    );
    expect(JSON.stringify(issued.map(({ row }) => row))).not.toMatch(/#join=|a{43}|b{43}|c{43}|d{43}/);
  });

  it("requires an explicit flag before replacing existing links", () => {
    expect(parseIssueLinkMode([])).toBe("issue");
    expect(parseIssueLinkMode(["--reissue"])).toBe("reissue");
    expect(() => parseIssueLinkMode(["--rotate"])).toThrow("Usage: pnpm links:issue [--reissue]");
  });

  it("revokes existing participant sessions when links are reissued", async () => {
    const participantIds = ["daekyeom", "gyuyeol", "junsu", "gyujun"];
    const links = createPersonalLinks(
      participantIds.map((id) => ({ id })),
      "https://trip.example.com",
      "invite-token",
      () => "n".repeat(43),
    );
    const database = {
      tokenHashes: ["old-token"],
      sessionParticipantIds: [...participantIds, "observer"],
    };
    const output: string[] = [];

    await persistPersonalLinks({
      mode: "reissue",
      links,
      saveTokens: async (rows) => { database.tokenHashes = rows.map((row) => row.token_hash); },
      revokeSessions: async (ids) => {
        database.sessionParticipantIds = database.sessionParticipantIds.filter((id) => !ids.includes(id));
      },
      writeLine: (line) => output.push(line),
    });

    expect(database.tokenHashes).toEqual(links.map(({ row }) => row.token_hash));
    expect(database.sessionParticipantIds).toEqual(["observer"]);
    expect(output).toHaveLength(4);
  });

  it("prints no links when session revocation fails", async () => {
    const links = createPersonalLinks(
      [{ id: "daekyeom" }],
      "https://trip.example.com",
      "invite-token",
      () => "n".repeat(43),
    );
    const output: string[] = [];

    await expect(persistPersonalLinks({
      mode: "reissue",
      links,
      saveTokens: async () => undefined,
      revokeSessions: async () => { throw new Error("database unavailable"); },
      writeLine: (line) => output.push(line),
    })).rejects.toThrow("database unavailable");
    expect(output).toEqual([]);
  });
});
