import { z } from "zod";

export type ImpersonationScope =
  | "tenant_read"
  | "branch_read"
  | "branch_switch";

export interface ImpersonationSessionSnapshot {
  id: string;
  superAdminId: string;
  tenantId: string;
  branchId: string;
  consentId: string;
  allowedScopes: ImpersonationScope[];
  reason: string;
  startedAt: string;
  expiresAt: string;
  platformAdminEmailSnapshot: string;
  tenantNameSnapshot: string;
  branchNameSnapshot: string;
  consentReasonSnapshot: string;
}

export interface ActiveImpersonation {
  impersonationToken: string;
  session: ImpersonationSessionSnapshot;
  allowedBranchIds: string[];
}

export interface ImpersonationTokenContext {
  tokenType: "impersonation";
  platformAdminId: string;
  tenantId: string;
  branchId: string;
  consentId: string;
  impersonationSessionId: string;
  scopes: ImpersonationScope[];
  sub: string;
  iat?: number;
  exp: number;
}

const scopeSchema = z.enum(["tenant_read", "branch_read", "branch_switch"]);

const tokenContextSchema = z.object({
  tokenType: z.literal("impersonation"),
  platformAdminId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  consentId: z.string().uuid(),
  impersonationSessionId: z.string().uuid(),
  scopes: z.array(scopeSchema),
  sub: z.string().uuid(),
  iat: z.number().optional(),
  exp: z.number(),
});

const sessionSchema = z.object({
  id: z.string().uuid(),
  superAdminId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  consentId: z.string().uuid(),
  allowedScopes: z.array(scopeSchema),
  reason: z.string(),
  startedAt: z.string(),
  expiresAt: z.string(),
  platformAdminEmailSnapshot: z.string(),
  tenantNameSnapshot: z.string(),
  branchNameSnapshot: z.string(),
  consentReasonSnapshot: z.string(),
});

const activeImpersonationSchema = z.object({
  impersonationToken: z.string().min(1),
  session: sessionSchema,
  allowedBranchIds: z.array(z.string().uuid()),
});

export const IMPERSONATION_STORAGE_KEY =
  "cuecloud_platform_admin_impersonation_session";
export const IMPERSONATION_CHANGED_EVENT =
  "cuecloud:platform-admin-impersonation-changed";
export const IMPERSONATION_CLEARED_EVENT =
  "cuecloud:platform-admin-impersonation-cleared";

export function decodeImpersonationToken(
  token: string,
): ImpersonationTokenContext | null {
  if (typeof window === "undefined") return null;
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const parsed: unknown = JSON.parse(window.atob(normalized));
    const result = tokenContextSchema.safeParse(parsed);
    if (
      !result.success ||
      result.data.sub !== result.data.impersonationSessionId ||
      result.data.exp * 1000 <= Date.now()
    ) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

function isConsistentSession(active: ActiveImpersonation) {
  const context = decodeImpersonationToken(active.impersonationToken);
  if (!context) return false;
  const session = active.session;
  const sessionExpiry = new Date(session.expiresAt).getTime();
  return (
    context.platformAdminId === session.superAdminId &&
    context.tenantId === session.tenantId &&
    context.branchId === session.branchId &&
    context.consentId === session.consentId &&
    context.impersonationSessionId === session.id &&
    Number.isFinite(sessionExpiry) &&
    sessionExpiry > Date.now() &&
    context.scopes.length === session.allowedScopes.length &&
    context.scopes.every((scope) => session.allowedScopes.includes(scope))
  );
}

export const impersonationStorage = {
  get(): ActiveImpersonation | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = activeImpersonationSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || !isConsistentSession(parsed.data)) {
        window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        return null;
      }
      return parsed.data;
    } catch {
      window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      return null;
    }
  },
  set(active: ActiveImpersonation): void {
    if (typeof window === "undefined") return;
    const parsed = activeImpersonationSchema.parse(active);
    if (!isConsistentSession(parsed)) {
      throw new Error("The server returned an inconsistent impersonation session");
    }
    window.localStorage.setItem(
      IMPERSONATION_STORAGE_KEY,
      JSON.stringify(parsed),
    );
    window.dispatchEvent(new Event(IMPERSONATION_CHANGED_EVENT));
  },
  clear(): void {
    if (typeof window === "undefined") return;
    const existed =
      window.localStorage.getItem(IMPERSONATION_STORAGE_KEY) !== null;
    window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    if (existed) window.dispatchEvent(new Event(IMPERSONATION_CLEARED_EVENT));
  },
};
