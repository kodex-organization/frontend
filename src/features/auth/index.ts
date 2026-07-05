// Auth & Identity feature module
// Components, hooks, and API calls for login/session

import { apiFetch } from "@/lib/api/client";
import type { SessionTokens, SessionUser } from "@/lib/auth/session";

export const FEATURE = "auth";

export interface DeviceInfo {
  deviceIdentifier: string;
  deviceName?: string;
  deviceType?: "mobile" | "tablet" | "desktop" | "pos" | "terminal";
  os?: string;
  appVersion?: string;
}

/** Stable per-browser device identifier, persisted so re-login on the same
 *  machine reuses (and doesn't duplicate) its user_devices row. */
export function getDeviceInfo(): DeviceInfo {
  const KEY = "cuecloud_device_id";
  let deviceIdentifier = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
  if (!deviceIdentifier) {
    deviceIdentifier = crypto.randomUUID();
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, deviceIdentifier);
  }
  return {
    deviceIdentifier,
    deviceName: typeof navigator !== "undefined" ? navigator.platform : undefined,
    deviceType: "desktop",
    os: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    appVersion: "0.1.0",
  };
}

interface LoginResponse extends SessionTokens {
  user: SessionUser;
}

export async function loginWithPassword(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device: getDeviceInfo() }),
    skipAuthRetry: true,
  } as RequestInit & { skipAuthRetry: boolean });
}

export async function loginWithPin(pin: string, identifier: { email?: string; userId?: string }) {
  return apiFetch<LoginResponse>("/auth/login/pin", {
    method: "POST",
    body: JSON.stringify({ ...identifier, pin, device: getDeviceInfo() }),
    skipAuthRetry: true,
  } as RequestInit & { skipAuthRetry: boolean });
}

export async function logoutRequest(refreshToken: string) {
  return apiFetch<{ loggedOut: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export interface CreateStaffInput {
  fullName: string;
  email: string;
  phone?: string;
  role: "OWNER" | "MANAGER" | "ACCOUNTANT" | "CASHIER";
  branchId: string;
  password: string;
  pin?: string;
}

export async function createStaff(input: CreateStaffInput) {
  return apiFetch<{ id: string; fullName: string; email: string; roles: string[] }>(
    "/auth/staff",
    { method: "POST", body: JSON.stringify(input) },
  );
}
