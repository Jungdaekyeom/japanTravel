import "server-only";

import { getSupabaseEnv } from "../env";

import { createSupabaseRepository } from "./supabase";

export type * from "./types";
export { InMemoryTripRepository } from "./memory";

let repository: ReturnType<typeof createSupabaseRepository> | undefined;

export function getTripRepository() {
  if (!repository) {
    const env = getSupabaseEnv();
    repository = createSupabaseRepository(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  }
  return repository;
}
