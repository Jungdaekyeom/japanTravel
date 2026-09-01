import { randomBytes } from "node:crypto";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { hashOwnerClaimToken } from "../src/server/auth/crypto.ts";
import { getSupabaseEnv } from "../src/server/env.ts";

type OwnerCodeClient = {
  from(table: string): {
    upsert(row: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>;
  };
};

export function createOwnerCode(
  makeToken = () => randomBytes(32).toString("base64url"),
  issuedAt = new Date(),
) {
  const token = makeToken();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid owner code generator output");
  return {
    token,
    row: {
      participant_id: "daekyeom",
      token_hash: hashOwnerClaimToken(token),
      issued_at: issuedAt.toISOString(),
      consumed_at: null,
    },
  };
}

export async function persistOwnerCode({
  client,
  issued,
  writeLine,
}: {
  client: OwnerCodeClient;
  issued: ReturnType<typeof createOwnerCode>;
  writeLine: (line: string) => void;
}) {
  const { error } = await client.from("participant_claim_tokens").upsert(issued.row, { onConflict: "participant_id" });
  if (error) throw new Error(error.message);
  writeLine(issued.token);
}

async function main() {
  try { loadEnvFile(".env.local"); }
  catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const env = getSupabaseEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await persistOwnerCode({ client, issued: createOwnerCode(), writeLine: (line) => console.log(line) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
