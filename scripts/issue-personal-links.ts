import { loadEnvFile } from "node:process";

import { createClient } from "@supabase/supabase-js";

import { getPersonalLinkEnv } from "../src/server/env.ts";
import { TRIP_DEFINITION } from "../src/trip/definition.ts";
import { createPersonalLinks, persistPersonalLinks, parseIssueLinkMode } from "./personal-links.ts";

try {
  loadEnvFile(".env.local");
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}

async function main() {
  const mode = parseIssueLinkMode(process.argv.slice(2));
  const env = getPersonalLinkEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { count, error: lookupError } = await client
    .from("participant_claim_tokens")
    .select("participant_id", { count: "exact", head: true });
  if (lookupError) throw new Error(lookupError.message);
  if (mode === "issue" && count) throw new Error("Personal links were already issued; use --reissue to replace them.");

  const { error: participantError } = await client.from("participants").upsert(
    TRIP_DEFINITION.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      birth_year: participant.birthYear,
      departure_city: participant.departureCity,
      role: participant.role,
    })),
    { onConflict: "id" },
  );
  if (participantError) throw new Error(participantError.message);

  const links = createPersonalLinks(TRIP_DEFINITION.participants, env.APP_ORIGIN, env.INVITE_TOKEN);
  await persistPersonalLinks({
    mode,
    links,
    saveTokens: async (rows) => {
      const { error } = await client.from("participant_claim_tokens").upsert([...rows], { onConflict: "participant_id" });
      if (error) throw new Error(error.message);
    },
    revokeSessions: async (participantIds) => {
      const { error } = await client.from("sessions").delete().in("participant_id", [...participantIds]);
      if (error) throw new Error(error.message);
    },
    writeLine: (line) => console.log(line),
  });
}

void main();
