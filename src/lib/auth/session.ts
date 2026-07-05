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
  refreshToken: string;
  expiresIn: string;
}

const ACCESS_TOKEN_KEY = "cuecloud_access_token";
const REFRESH_TOKEN_KEY = "cuecloud_refresh_token";
const USER_KEY = "cuecloud_user";

/**
 * localStorage-backed token storage. Access tokens are short-lived (15m)
 * so exposure risk is limited; refresh tokens are opaque + rotated on
 * every use (server revokes the old one immediately), so a stolen value
 * only works once before detection. If this needs to harden further later
 * (e.g. httpOnly cookies via a Next.js route-handler proxy), swap the
 * implementation here — callers only use the functions below.
 */
export const tokenStorage = {
  get(): SessionTokens | null {
    if (typeof window === "undefined") return null;
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken, expiresIn: "" };
  },
  set(tokens: SessionTokens): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
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
