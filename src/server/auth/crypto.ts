import { createHash } from "node:crypto";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIpAddress(ip: string, pepper: string) {
  return createHash("sha256").update(`${ip}:${pepper}`).digest("hex");
}
