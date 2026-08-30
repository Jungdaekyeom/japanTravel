import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL("./202608300001_personal_link_claims.sql", import.meta.url);

describe("personal-link claim migration", () => {
  it("keeps token consumption and session insertion in one least-privilege RPC", async () => {
    const sql = await readFile(migrationUrl, "utf8").catch(() => "");
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();
    const functionBody = normalized.match(/create or replace function public\.claim_participant_token[\s\S]*?\$\$;/)?.[0] ?? "";

    expect(normalized).toContain("create table public.participant_claim_tokens");
    expect(normalized).toMatch(/token_hash text[^,]*\^\[0-9a-f\]\{64\}\$/);
    expect(normalized).toContain("alter table public.participant_claim_tokens enable row level security");
    expect(functionBody).toContain("security definer");
    expect(functionBody).toContain("update public.participant_claim_tokens");
    expect(functionBody).toContain("consumed_at is null");
    expect(functionBody).toContain("insert into public.sessions");
    expect(functionBody.indexOf("update public.participant_claim_tokens")).toBeLessThan(functionBody.indexOf("insert into public.sessions"));
    expect(normalized).toContain("revoke all on function public.claim_participant_token");
    expect(normalized).toContain("grant execute on function public.claim_participant_token");
  });
});
