import type { TripRepository } from "../repository/types";

export function reserveLoginAttempt(repository: TripRepository, ipHash: string, now = new Date()) {
  return repository.reserveLoginAttempt(ipHash, now);
}
