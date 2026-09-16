// JWT session handling — auth module (Developer 1)

import { z } from "zod";

/**
 * Full-credential-login roles per SRS §3.1 (Owner, Manager, Accountant);
 * Cashier uses PIN login. Team lead confirmed 2026-07-02: follow the SRS,
 * Accountant is in scope even though task.pdf's per-developer breakdown
 * didn't call it out.
 */
export type UserRole = "OWNER" | "MANAGER" | "ACCOUNTANT" | "CASHIER";

export interface SessionUser {
  id: string;
  fullName: string | null;
  email: string | null;
  branchId: string;
  roles: UserRole[];
  language: "en" | "ur";
}

const sessionUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  branchId: z.string().uuid(),
  roles: z.array(
    z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"]),
  ),
  language: z.enum(["en", "ur"]).optional().default("en"),
});

export interface SessionTokens {
  accessToken: string;
  // Still present in the login/refresh API response for backward
  // compatibility (Postman, non-browser clients), but the browser client
  // never reads or persists it — see the hardening note below.
  refreshToken?: string;
  expiresIn: string;
}

export interface StoredTokens {
  accessToken: string;
}

const accessContextSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  deviceId: z.string().uuid(),
  roles: z.array(z.string()),
});

export type AccessContext = z.infer<typeof accessContextSchema>;

const ACCESS_TOKEN_KEY = "cuecloud_access_token";
const USER_KEY = "cuecloud_user";
const SESSION_VERSION_KEY = 'cuecloud_session_version';

export const AUTH_STORAGE_KEYS = {
  accessToken: ACCESS_TOKEN_KEY,
  user: USER_KEY,
  version: SESSION_VERSION_KEY,
} as const;

export const AUTH_SESSION_CLEARED_EVENT = "cuecloud:session-cleared";
export const AUTH_SESSION_REPLACED_EVENT = "cuecloud:session-replaced";

function decodeAccessContext(accessToken: string): AccessContext | null {
  if (typeof window === "undefined") return null;

  const encodedPayload = accessToken.split(".")[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(window.atob(normalized));
    const result = accessContextSchema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Fix (hardening): the refresh token is long-lived (default 7d) and used
 * to be persisted here in localStorage — readable by any injected/XSS
 * script for the full 7 days. It's no longer stored client-side at all;
 * the backend now also sets it as an httpOnly cookie (see
 * backend `modules/auth/lib/tokens.ts` → refreshCookieOptions()), which
 * this browser can never read from JS but which `fetch(..., { credentials:
 * "include" })` sends automatically to `/auth/refresh` and `/auth/logout`.
 * Only the short-lived (15m) access token is kept here, for the
 * Authorization header on API calls.
 */
export const tokenStorage = {
  getSessionVersion(): string | null {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(SESSION_VERSION_KEY);
  },
  get(): StoredTokens | null {
    if (typeof window === "undefined") return null;
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) return null;
    return { accessToken };
  },
  set(tokens: { accessToken: string }): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  },
  setRefreshedToken(accessToken: string): void {
    const previous = this.getAccessContext();
    const next = decodeAccessContext(accessToken);
    if (previous && (!next || previous.userId !== next.userId ||
      previous.tenantId !== next.tenantId || previous.branchId !== next.branchId ||
      previous.deviceId !== next.deviceId)) {
      throw new Error('Refreshed token does not belong to the current session');
    }
    this.set({ accessToken });
  },
  replaceSession(
    tokens: { accessToken: string },
    user: SessionUser,
  ): void {
    if (typeof window === "undefined") return;

    const accessContext = decodeAccessContext(tokens.accessToken);
    if (
      !accessContext ||
      accessContext.userId !== user.id ||
      accessContext.branchId !== user.branchId
    ) {
      throw new Error("The server returned an inconsistent authenticated session");
    }

    const previousAccessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const previousUser = window.localStorage.getItem(USER_KEY);
    const previousVersion = window.localStorage.getItem(SESSION_VERSION_KEY);

    try {
      // localStorage writes are synchronous, so observers cannot read a
      // half-updated session between these writes on this page.
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      window.localStorage.setItem(SESSION_VERSION_KEY, crypto.randomUUID());
    } catch (error) {
      if (previousVersion === null) window.localStorage.removeItem(SESSION_VERSION_KEY);
      else window.localStorage.setItem(SESSION_VERSION_KEY, previousVersion);
      if (previousUser === null) window.localStorage.removeItem(USER_KEY);
      else window.localStorage.setItem(USER_KEY, previousUser);

      if (previousAccessToken === null) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      } else {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, previousAccessToken);
      }
      throw error;
    }

    window.dispatchEvent(
      new CustomEvent(AUTH_SESSION_REPLACED_EVENT, {
        detail: { branchId: user.branchId },
      }),
    );
  },
  clear(options?: { notifyIfEmpty?: boolean }): void {
    if (typeof window === "undefined") return;
    const hadSession =
      window.localStorage.getItem(ACCESS_TOKEN_KEY) !== null ||
      window.localStorage.getItem(USER_KEY) !== null;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    // Publish the completed logout after removing both session fields.
    window.localStorage.setItem(SESSION_VERSION_KEY, crypto.randomUUID());
    // An open page can still hold its user in memory after storage is emptied.
    if (hadSession || options?.notifyIfEmpty) {
      window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
    }
  },
  getUser(): SessionUser | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = sessionUserSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  },
  setUser(user: SessionUser): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getAccessContext(): AccessContext | null {
    const accessToken = this.get()?.accessToken;
    return accessToken ? decodeAccessContext(accessToken) : null;
  },
};

/** Where to send each role after a successful login (task.pdf, Dev 1 scope). */
export function redirectPathForRoles(roles: UserRole[]): string {
  if (roles.includes("OWNER") || roles.includes("MANAGER")) {
    return "/dashboard";
  }
  if (roles.includes("ACCOUNTANT")) {
    return "/reporting";
  }
  if (roles.includes("CASHIER")) {
    return "/floor-view";
  }
  return "/billing";
}

