import type { TripRepository } from "../repository/types";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_FAILURES = 5;
const MAX_GLOBAL_FAILURES = 50;

export async function isLoginRateLimited(repository: TripRepository, ipHash: string, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_MS);
  const [ipFailures, globalFailures] = await Promise.all([
    repository.countFailedLoginAttempts(since, ipHash),
    repository.countFailedLoginAttempts(since),
  ]);
  return ipFailures >= MAX_IP_FAILURES || globalFailures >= MAX_GLOBAL_FAILURES;
}
