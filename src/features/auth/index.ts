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
    // navigator.platform is short and safe as-is, but we still guard it the
    // same way for consistency across browsers.
    deviceName: typeof navigator !== "undefined" ? navigator.platform?.slice(0, 120) : undefined,
    deviceType: "desktop",
    // Issue 6 fix: navigator.userAgent length varies by browser — Chrome's
    // is ~111 chars, but Edge appends an extra "Edg/x.x.x.x" token that
    // pushes it past 120, which the backend's deviceInfoSchema.os field
    // (max length, see schemas.ts) was rejecting with a 400. We truncate
    // here as a safety net in addition to raising the backend limit, so a
    // long user-agent from any browser can never break login again.
    os: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : undefined,
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

export async function logoutRequest() {
  return apiFetch<{ loggedOut: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
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