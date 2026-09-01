import { createHash } from "node:crypto";

const OWNER_CLAIM_DOMAIN = "japan-travel:owner-claim:v1:";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashOwnerClaimToken(token: string) {
  return createHash("sha256").update(`${OWNER_CLAIM_DOMAIN}${token}`).digest("hex");
}

export function hashIpAddress(ip: string, pepper: string) {
  return createHash("sha256").update(`${ip}:${pepper}`).digest("hex");
}
