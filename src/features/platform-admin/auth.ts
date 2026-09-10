import { platformAdminFetch } from "@/lib/platform-admin/client";
import {
  platformAdminStorage,
  type PlatformAdmin,
} from "@/lib/platform-admin/session";

export interface PlatformAdminLoginResult {
  admin: PlatformAdmin;
  accessToken: string;
  refreshToken?: string;
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
  platformAdminStorage.replaceSession(
    session.accessToken,
    session.admin,
    session.refreshToken,
  );
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
  const refreshToken = platformAdminStorage.getRefreshToken();
  return platformAdminFetch<{ loggedOut: boolean }>(
    "/super-admin/auth/logout",
    {
      method: "POST",
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    },
  );
}

export async function endPlatformAdminSession(
  requestLogout: () => Promise<unknown> = logoutPlatformAdminRequest,
) {
  try {
    await requestLogout();
  } finally {
    platformAdminStorage.clear();
  }
}
