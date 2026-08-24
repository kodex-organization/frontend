import { z } from "zod";

export interface PlatformAdmin {
  id: string;
  email: string;
  fullName: string | null;
  role: "SUPER_ADMIN";
}

export interface PlatformAdminAccessContext {
  tokenType: "platform_admin";
  platformAdminId: string;
  role: "SUPER_ADMIN";
  sub: string;
  iat?: number;
  exp?: number;
}

const platformAdminSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.literal("SUPER_ADMIN"),
});

const platformAdminAccessContextSchema = z.object({
  tokenType: z.literal("platform_admin"),
  platformAdminId: z.string().uuid(),
  role: z.literal("SUPER_ADMIN"),
  sub: z.string().uuid(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export const PLATFORM_ADMIN_STORAGE_KEYS = {
  accessToken: "cuecloud_platform_admin_access_token",
  admin: "cuecloud_platform_admin_user",
} as const;

export const PLATFORM_ADMIN_SESSION_CLEARED_EVENT =
  "cuecloud:platform-admin-session-cleared";
export const PLATFORM_ADMIN_SESSION_REPLACED_EVENT =
  "cuecloud:platform-admin-session-replaced";

export function decodePlatformAdminAccessToken(
  accessToken: string,
): PlatformAdminAccessContext | null {
  if (typeof window === "undefined") return null;
  const encodedPayload = accessToken.split(".")[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(window.atob(normalized));
    const result = platformAdminAccessContextSchema.safeParse(payload);
    if (
      !result.success ||
      result.data.sub !== result.data.platformAdminId
    ) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export const platformAdminStorage = {
  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    const token = window.localStorage.getItem(
      PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
    );
    return token && decodePlatformAdminAccessToken(token) ? token : null;
  },
  setAccessToken(accessToken: string): void {
    if (typeof window === "undefined") return;
    if (!decodePlatformAdminAccessToken(accessToken)) {
      throw new Error("The server returned an invalid platform admin token");
    }
    window.localStorage.setItem(
      PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
      accessToken,
    );
  },
  getAdmin(): PlatformAdmin | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PLATFORM_ADMIN_STORAGE_KEYS.admin);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = platformAdminSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  },
  setAdmin(admin: PlatformAdmin): void {
    if (typeof window === "undefined") return;
    const parsed = platformAdminSchema.parse(admin);
    window.localStorage.setItem(
      PLATFORM_ADMIN_STORAGE_KEYS.admin,
      JSON.stringify(parsed),
    );
  },
  replaceSession(accessToken: string, admin: PlatformAdmin): void {
    if (typeof window === "undefined") return;
    const context = decodePlatformAdminAccessToken(accessToken);
    const parsedAdmin = platformAdminSchema.parse(admin);
    if (!context || context.platformAdminId !== parsedAdmin.id) {
      throw new Error("The server returned an inconsistent platform admin session");
    }

    const previousToken = window.localStorage.getItem(
      PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
    );
    const previousAdmin = window.localStorage.getItem(
      PLATFORM_ADMIN_STORAGE_KEYS.admin,
    );

    try {
      window.localStorage.setItem(
        PLATFORM_ADMIN_STORAGE_KEYS.admin,
        JSON.stringify(parsedAdmin),
      );
      window.localStorage.setItem(
        PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
        accessToken,
      );
    } catch (error) {
      if (previousAdmin === null) {
        window.localStorage.removeItem(PLATFORM_ADMIN_STORAGE_KEYS.admin);
      } else {
        window.localStorage.setItem(
          PLATFORM_ADMIN_STORAGE_KEYS.admin,
          previousAdmin,
        );
      }
      if (previousToken === null) {
        window.localStorage.removeItem(
          PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
        );
      } else {
        window.localStorage.setItem(
          PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
          previousToken,
        );
      }
      throw error;
    }

    window.dispatchEvent(new Event(PLATFORM_ADMIN_SESSION_REPLACED_EVENT));
  },
  clear(): void {
    if (typeof window === "undefined") return;
    const hadSession =
      window.localStorage.getItem(PLATFORM_ADMIN_STORAGE_KEYS.accessToken) !==
        null ||
      window.localStorage.getItem(PLATFORM_ADMIN_STORAGE_KEYS.admin) !== null;
    window.localStorage.removeItem(PLATFORM_ADMIN_STORAGE_KEYS.accessToken);
    window.localStorage.removeItem(PLATFORM_ADMIN_STORAGE_KEYS.admin);
    if (hadSession) {
      window.dispatchEvent(new Event(PLATFORM_ADMIN_SESSION_CLEARED_EVENT));
    }
  },
};
