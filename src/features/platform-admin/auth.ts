import { platformAdminFetch, refreshPlatformAdminAccessToken } from "@/lib/platform-admin/client";
import { ApiError } from '@/lib/api/client';
import {
  platformAdminStorage,
  type PlatformAdmin,
} from "@/lib/platform-admin/session";

export interface PlatformAdminLoginResult {
  admin: PlatformAdmin;
  accessToken: string;
  expiresIn: string;
}

interface CurrentPlatformAdmin {
  platformAdminId: string;
  email: string;
  fullName: string | null;
  role: "SUPER_ADMIN";
}

export function loginPlatformAdmin(email: string, password: string) {
  return platformAdminFetch<PlatformAdminLoginResult>(
    "/super-admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuthRetry: true,
      skipPlatformAuth: true,
    },
  );
}

export function establishPlatformAdminSession(
  session: PlatformAdminLoginResult,
) {
  platformAdminStorage.replaceSession(session.accessToken, session.admin);
  return session.admin;
}

export async function getCurrentPlatformAdmin(): Promise<PlatformAdmin> {
  const current = await platformAdminFetch<CurrentPlatformAdmin>(
    "/super-admin/auth/me",
  );
  return {
    id: current.platformAdminId,
    email: current.email,
    fullName: current.fullName,
    role: current.role,
  };
}

export function logoutPlatformAdminRequest() {
  return platformAdminFetch<{ loggedOut: boolean }>(
    "/super-admin/auth/logout",
    { method: "POST", body: JSON.stringify({}) },
  );
}

/** Keep a late startup /me or refresh response from replacing a newer login. */
export async function restorePlatformAdminSession(isCurrent: () => boolean = () => true): Promise<PlatformAdmin | null> {
  const version = platformAdminStorage.getSessionVersion();
  const canApply = () => isCurrent() && platformAdminStorage.getSessionVersion() === version;
  try {
    if (!platformAdminStorage.getAccessToken()) {
      const refreshed = await refreshPlatformAdminAccessToken();
      if (!canApply() || !refreshed) return null;
    }
    const current = await getCurrentPlatformAdmin();
    if (!canApply()) return null;
    platformAdminStorage.setAdmin(current);
    return current;
  } catch (error) {
    if (canApply() && error instanceof ApiError && error.status === 401) {
      platformAdminStorage.clear();
    }
    return null;
  }
}

export async function endPlatformAdminSession(
  requestLogout: () => Promise<unknown> = logoutPlatformAdminRequest,
) {
  const version = platformAdminStorage.getSessionVersion();
  try {
    await requestLogout();
  } finally {
    if (platformAdminStorage.getSessionVersion() === version) platformAdminStorage.clear();
  }
}
