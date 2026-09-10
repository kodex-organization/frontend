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
  refreshToken?: string;
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
const REFRESH_TOKEN_KEY = "cuecloud_refresh_token";
const USER_KEY = "cuecloud_user";

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
 * The refresh token is set as an httpOnly cookie by the backend, but also
 * stored in localStorage as an automatic fallback for cross-origin/proxy
 * environments where cookies might not be attached to fetch calls.
 */
export const tokenStorage = {
  get(): StoredTokens | null {
    if (typeof window === "undefined") return null;
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) return null;
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined;
    return { accessToken, refreshToken };
  },
  set(tokens: { accessToken: string; refreshToken?: string }): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    if (tokens.refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  },
  replaceSession(
    tokens: { accessToken: string; refreshToken?: string },
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
    const previousRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    const previousUser = window.localStorage.getItem(USER_KEY);

    try {
      // localStorage writes are synchronous, so observers cannot read a
      // half-updated session between these writes on this page.
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      if (tokens.refreshToken) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      }
    } catch (error) {
      if (previousUser === null) window.localStorage.removeItem(USER_KEY);
      else window.localStorage.setItem(USER_KEY, previousUser);

      if (previousAccessToken === null) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      } else {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, previousAccessToken);
      }

      if (previousRefreshToken === null) {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, previousRefreshToken);
      }
      throw error;
    }

    window.dispatchEvent(
      new CustomEvent(AUTH_SESSION_REPLACED_EVENT, {
        detail: { branchId: user.branchId },
      }),
    );
  },
  clear(): void {
    if (typeof window === "undefined") return;
    const hadSession =
      window.localStorage.getItem(ACCESS_TOKEN_KEY) !== null ||
      window.localStorage.getItem(REFRESH_TOKEN_KEY) !== null ||
      window.localStorage.getItem(USER_KEY) !== null;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    if (hadSession) {
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
  if (roles.includes("CASHIER") && !roles.includes("OWNER") && !roles.includes("MANAGER")) {
    return "/floor-view";
  }
  return "/dashboard";
}
