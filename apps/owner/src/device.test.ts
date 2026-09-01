import { isSupportedOwnerDevice } from "./device";

const mockDevice = {
  isDevice: true,
  manufacturer: "samsung",
  modelName: "SM-S948N",
  platformApiLevel: 36,
  supportedCpuArchitectures: ["arm64-v8a"],
};

jest.mock("expo-device", () => ({
  __esModule: true,
  get isDevice() {
    return mockDevice.isDevice;
  },
  get manufacturer() {
    return mockDevice.manufacturer;
  },
  get modelName() {
    return mockDevice.modelName;
  },
  get platformApiLevel() {
    return mockDevice.platformApiLevel;
  },
  get supportedCpuArchitectures() {
    return mockDevice.supportedCpuArchitectures;
  },
}));

describe("isSupportedOwnerDevice", () => {
  beforeEach(() => {
    Object.assign(mockDevice, {
      isDevice: true,
      manufacturer: "samsung",
      modelName: "SM-S948N",
      platformApiLevel: 36,
      supportedCpuArchitectures: ["arm64-v8a"],
    });
  });

  it("accepts the exact supported device at the minimum API level", () => {
    expect(isSupportedOwnerDevice()).toBe(true);
  });

  it.each([
    ["a simulator", { isDevice: false }],
    ["a non-Samsung manufacturer", { manufacturer: "Google" }],
    ["a different model", { modelName: "SM-S938N" }],
    ["an older Android API", { platformApiLevel: 35 }],
    ["a device without arm64-v8a", { supportedCpuArchitectures: ["armeabi-v7a"] }],
  ])("rejects %s", (_condition, override) => {
    Object.assign(mockDevice, override);

    expect(isSupportedOwnerDevice()).toBe(false);
  });

  it("matches Samsung manufacturers case-insensitively and allows additional ABIs", () => {
    Object.assign(mockDevice, {
      manufacturer: "SaMsUnG",
      supportedCpuArchitectures: ["armeabi-v7a", "arm64-v8a"],
    });

    expect(isSupportedOwnerDevice()).toBe(true);
  });
});
