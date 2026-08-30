import { createHash, randomBytes } from "node:crypto";

export function parseIssueLinkMode(args: string[]) {
  if (args.length === 0) return "issue" as const;
  if (args.length === 1 && args[0] === "--reissue") return "reissue" as const;
  throw new Error("Usage: pnpm links:issue [--reissue]");
}

export function createPersonalLinks(
  participants: readonly { id: string }[],
  appOrigin: string,
  inviteToken: string,
  makeToken = () => randomBytes(32).toString("base64url"),
  issuedAt = new Date(),
) {
  return participants.map((participant) => {
    const token = makeToken();
    const url = new URL(`/t/${encodeURIComponent(inviteToken)}`, appOrigin);
    url.hash = `join=${token}`;
    return {
      id: participant.id,
      url: url.toString(),
      row: {
        participant_id: participant.id,
        token_hash: createHash("sha256").update(token).digest("hex"),
        issued_at: issuedAt.toISOString(),
        consumed_at: null,
      },
    };
  });
}

type PersonalLink = ReturnType<typeof createPersonalLinks>[number];

export async function persistPersonalLinks({
  mode,
  links,
  saveTokens,
  revokeSessions,
  writeLine,
}: {
  mode: ReturnType<typeof parseIssueLinkMode>;
  links: readonly PersonalLink[];
  saveTokens: (rows: readonly PersonalLink["row"][]) => Promise<void>;
  revokeSessions: (participantIds: readonly string[]) => Promise<void>;
  writeLine: (line: string) => void;
}) {
  await saveTokens(links.map(({ row }) => row));
  if (mode === "reissue") await revokeSessions(links.map(({ id }) => id));
  for (const { id, url } of links) writeLine(`${id}: ${url}`);
}
