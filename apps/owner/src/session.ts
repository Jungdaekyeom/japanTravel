import * as SecureStore from "expo-secure-store";

import type { OwnerSession } from "./types";

export const OWNER_SESSION_KEY = "japanTravel.ownerSession.v1";
const keychainOptions = { keychainService: "japanTravel.ownerSession" };

export async function loadSession(): Promise<OwnerSession | null> {
  const value = await SecureStore.getItemAsync(OWNER_SESSION_KEY, keychainOptions);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isSession(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: OwnerSession) {
  return SecureStore.setItemAsync(OWNER_SESSION_KEY, JSON.stringify(session), {
    ...keychainOptions,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function clearSession() {
  return SecureStore.deleteItemAsync(OWNER_SESSION_KEY, keychainOptions);
}

function isSession(value: unknown): value is OwnerSession {
  return typeof value === "object" && value !== null
    && typeof (value as OwnerSession).accessToken === "string"
    && typeof (value as OwnerSession).expiresAt === "string";
}
