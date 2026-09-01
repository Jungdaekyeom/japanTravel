import * as Device from "expo-device";

export function isSupportedOwnerDevice() {
  return Device.isDevice
    && Device.manufacturer?.toLowerCase() === "samsung"
    && Device.modelName === "SM-S948N"
    && (Device.platformApiLevel ?? 0) >= 36
    && Device.supportedCpuArchitectures?.includes("arm64-v8a") === true;
}
