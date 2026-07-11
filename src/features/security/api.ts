import { apiFetch } from "@/lib/api/client";

export interface Device {
  id: string;
  userId: string;
  deviceIdentifier: string;
  deviceName: string | null;
  deviceType: string | null;
  os: string | null;
  appVersion: string | null;
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface LoginHistoryItem {
  id: string;
  userId: string;
  deviceId: string | null;
  success: boolean;
  ipAddress: string | null;
  attemptedAt: string;

   device?: {
    deviceName: string | null;
    deviceType: string | null;
    os: string | null;
    appVersion: string | null;
  };
}

export async function getDevices() {
  return apiFetch<Device[]>("/security/devices");
}

export async function getLoginHistory() {
  return apiFetch<LoginHistoryItem[]>("/security/login-history");
}

export async function revokeDevice(deviceId: string) {
  return apiFetch<{ revoked: boolean }>("/security/revoke-device", {
    method: "POST",
    body: JSON.stringify({
      deviceId,
    }),
  });
}