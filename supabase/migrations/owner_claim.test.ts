import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL("./202608310001_owner_claim.sql", import.meta.url);

describe("owner claim migration", () => {
  it("atomically consumes only daekyeom's token and replaces all owner sessions through a service-role-only RPC", async () => {
    const sql = await readFile(migrationUrl, "utf8").catch(() => "");
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();
    const functionBody = normalized.match(/create or replace function public\.claim_owner_token[\s\S]*?\$\$;/)?.[0] ?? "";

    expect(functionBody).toContain("security definer");
    expect(functionBody).toContain("update public.participant_claim_tokens");
    expect(functionBody).toContain("participant_id = 'daekyeom'");
    expect(functionBody).toContain("consumed_at is null");
    expect(functionBody).toContain("delete from public.sessions");
    expect(functionBody).toContain("insert into public.sessions");
    expect(functionBody.indexOf("update public.participant_claim_tokens")).toBeLessThan(functionBody.indexOf("delete from public.sessions"));
    expect(functionBody.indexOf("delete from public.sessions")).toBeLessThan(functionBody.indexOf("insert into public.sessions"));
    expect(normalized).toContain("revoke all on function public.claim_owner_token");
    expect(normalized).toContain("grant execute on function public.claim_owner_token");
    expect(normalized).toContain("to service_role");
    expect(normalized).not.toMatch(/grant execute on function public\.claim_owner_token[^;]+to (public|anon|authenticated)/);
  });
});
