import * as SecureStore from "expo-secure-store";

import { clearSession, loadSession, saveSession } from "./session";

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "THIS_DEVICE_ONLY",
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

test("stores the owner session with its dedicated this-device-only keychain settings", async () => {
  await saveSession({ accessToken: "a".repeat(43), expiresAt: "2026-10-01T00:00:00.000Z" });

  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "japanTravel.ownerSession.v1",
    JSON.stringify({ accessToken: "a".repeat(43), expiresAt: "2026-10-01T00:00:00.000Z" }),
    {
      keychainService: "japanTravel.ownerSession",
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
});

test("reads and clears the owner session from the same keychain service", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

  await loadSession();
  await clearSession();

  expect(SecureStore.getItemAsync).toHaveBeenCalledWith("japanTravel.ownerSession.v1", {
    keychainService: "japanTravel.ownerSession",
  });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("japanTravel.ownerSession.v1", {
    keychainService: "japanTravel.ownerSession",
  });
});
