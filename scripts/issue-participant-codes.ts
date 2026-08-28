import { randomInt, randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { hashParticipantCode } from "../src/server/auth/crypto.ts";
import { getServerEnv } from "../src/server/env.ts";
import { TRIP_DEFINITION } from "../src/trip/definition.ts";

function makeCode(issued: Set<string>) {
  let code = "";
  do code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  while (issued.has(code));
  issued.add(code);
  return code;
}

async function main() {
  const env = getServerEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existing, error: lookupError } = await client.from("participants").select("id, code_hash");
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.some((participant) => participant.code_hash)) {
    throw new Error("Participant codes were already issued; refusing to replace them.");
  }

  const issued = new Set<string>();
  const rows = await Promise.all(
    TRIP_DEFINITION.participants.map(async (participant) => {
      const code = makeCode(issued);
      const codeSalt = randomBytes(16).toString("base64url");
      return {
        id: participant.id,
        name: participant.name,
        birth_year: participant.birthYear,
        departure_city: participant.departureCity,
        role: participant.role,
        code_salt: codeSalt,
        code_hash: await hashParticipantCode(code, codeSalt, env.SESSION_PEPPER),
        code,
      };
    }),
  );
  const { error: upsertError } = await client.from("participants").upsert(
    rows.map(({ code, ...row }) => row),
    { onConflict: "id" },
  );
  if (upsertError) throw new Error(upsertError.message);

  for (const { id, code } of rows) console.log(`${id}: ${code}`);
}

void main();
