// JWT session handling — auth module (Developer 1)

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
}

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

const ACCESS_TOKEN_KEY = "cuecloud_access_token";
const USER_KEY = "cuecloud_user";

export const AUTH_SESSION_CLEARED_EVENT = "cuecloud:session-cleared";

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
  clear(): void {
    if (typeof window === "undefined") return;
    const hadSession =
      window.localStorage.getItem(ACCESS_TOKEN_KEY) !== null ||
      window.localStorage.getItem(USER_KEY) !== null;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  },
  setUser(user: SessionUser): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
};

/** Where to send each role after a successful login (task.pdf, Dev 1 scope). */
export function redirectPathForRoles(roles: UserRole[]): string {
  if (roles.includes("CASHIER") && !roles.includes("OWNER") && !roles.includes("MANAGER")) {
    return "/floor-view";
  }
  return "/dashboard";
}
