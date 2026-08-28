import { createHash, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);

export async function hashParticipantCode(code: string, salt: string, pepper: string) {
  const derived = (await scrypt(`${code}:${pepper}`, salt, 64)) as Buffer;
  return derived.toString("base64url");
}

export async function verifyParticipantCode(code: string, salt: string, hash: string, pepper: string) {
  const expected = Buffer.from(hash, "base64url");
  const actual = Buffer.from(await hashParticipantCode(code, salt, pepper), "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIpAddress(ip: string, pepper: string) {
  return createHash("sha256").update(`${ip}:${pepper}`).digest("hex");
}
