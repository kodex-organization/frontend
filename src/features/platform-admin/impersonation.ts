import { ApiError } from "@/lib/api/client";
import {
  impersonationStorage,
  type ActiveImpersonation,
  type ImpersonationScope,
  type ImpersonationSessionSnapshot,
} from "@/lib/platform-admin/impersonation-session";
import { platformAdminFetch } from "@/lib/platform-admin/client";

export interface ImpersonationConsent {
  id: string;
  tenantId: string;
  grantedByUserId: string;
  allowedScopes: ImpersonationScope[];
  allowedBranchIds: string[];
  reason: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  tenantNameSnapshot: string;
  createdAt: string;
  updatedAt: string;
  grantedByUser: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
}

export interface StartImpersonationInput {
  consentId: string;
  tenantId: string;
  branchId: string;
  reason: string;
}

interface StartImpersonationResponse {
  impersonationToken: string;
  tokenType: "impersonation";
  expiresAt: string;
  session: ImpersonationSessionSnapshot;
}

export interface ImpersonationAuditEvent {
  id: string;
  sessionId: string;
  platformAdminId: string | null;
  consentId: string | null;
  tenantId: string | null;
  branchId: string | null;
  eventType: "start" | "action" | "branch_switch" | "end";
  action: string;
  scope: ImpersonationScope | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceIdentifier: string | null;
  sessionExpiresAt: string | null;
  occurredAt: string;
  platformAdminEmailSnapshot: string;
  tenantNameSnapshot: string;
  branchNameSnapshot: string;
  consentReasonSnapshot: string;
}

export interface ImpersonationAuditFilters {
  platformAdminId?: string;
  tenantId?: string;
  branchId?: string;
  consentId?: string;
  impersonationSessionId?: string;
  eventType?: ImpersonationAuditEvent["eventType"];
  scope?: ImpersonationScope;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ImpersonationAuditPage {
  items: ImpersonationAuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface ImpersonationAuditSession {
  sessionId: string;
  platformAdminId: string | null;
  adminEmail: string;
  tenantName: string;
  tenantId: string | null;
  branchName: string;
  branchId: string | null;
  consentId: string | null;
  consentReason: string;
  reason: string | null;
  startAt: string | null;
  endAt: string | null;
  expiresAt: string | null;
  endReason: string | null;
  events: ImpersonationAuditEvent[];
}

export function buildImpersonationAuditPath(
  filters: ImpersonationAuditFilters,
) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return `/super-admin/impersonation/audit?${query.toString()}`;
}

export function groupImpersonationAuditEvents(
  events: ImpersonationAuditEvent[],
): ImpersonationAuditSession[] {
  const groups = new Map<string, ImpersonationAuditEvent[]>();
  for (const event of events) {
    const current = groups.get(event.sessionId) ?? [];
    current.push(event);
    groups.set(event.sessionId, current);
  }

  return Array.from(groups.entries()).map(([sessionId, sessionEvents]) => {
    const sorted = [...sessionEvents].sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );
    const first = sorted[0]!;
    const start = sorted.find((event) => event.eventType === "start");
    const end = [...sorted].reverse().find((event) => event.eventType === "end");
    const latestBranch = [...sorted]
      .reverse()
      .find((event) => event.branchId !== null);
    return {
      sessionId,
      platformAdminId: first.platformAdminId,
      adminEmail: first.platformAdminEmailSnapshot,
      tenantName: first.tenantNameSnapshot,
      tenantId: first.tenantId,
      branchName: latestBranch?.branchNameSnapshot ?? first.branchNameSnapshot,
      branchId: latestBranch?.branchId ?? first.branchId,
      consentId: first.consentId,
      consentReason: first.consentReasonSnapshot,
      reason: start?.reason ?? first.reason,
      startAt: start?.occurredAt ?? null,
      endAt: end?.occurredAt ?? null,
      expiresAt: first.sessionExpiresAt,
      endReason: end?.reason ?? null,
      events: sorted,
    };
  });
}

export function listImpersonationConsents(
  tenantId?: string,
  validOnly = true,
) {
  const query = new URLSearchParams({ validOnly: String(validOnly), limit: "200" });
  if (tenantId) query.set("tenantId", tenantId);
  return platformAdminFetch<{
    items: ImpersonationConsent[];
    total: number;
    limit: number;
    offset: number;
  }>(`/super-admin/impersonation/consents?${query.toString()}`);
}

export function startImpersonationRequest(input: StartImpersonationInput) {
  return platformAdminFetch<StartImpersonationResponse>(
    "/super-admin/impersonation/start",
    { method: "POST", body: JSON.stringify(input) },
  );
}

function impersonationFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const active = impersonationStorage.get();
  if (!active) {
    throw new ApiError("No active impersonation session.", 401, "NO_IMPERSONATION");
  }
  return platformAdminFetch<T>(path, {
    ...options,
    skipAuthRetry: true,
    headers: {
      Authorization: `Bearer ${active.impersonationToken}`,
      ...options.headers,
    },
  }).catch((error) => {
    if (error instanceof ApiError && error.status === 401) {
      impersonationStorage.clear();
    }
    throw error;
  });
}

export function getImpersonationContext() {
  return impersonationFetch<{
    platformAdminId: string;
    consentId: string;
    impersonationSessionId: string;
    scopes: ImpersonationScope[];
    expiresAt: string;
    tenant: { id: string; name: string; status: string; timezone: string };
    branch: { id: string; name: string; timezone: string; currency: string };
  }>("/super-admin/impersonation/context");
}

export function getImpersonatedBranch() {
  return impersonationFetch<{
    id: string;
    name: string;
    address: string | null;
    currency: string;
    timezone: string;
    language: string;
  }>("/super-admin/impersonation/branch");
}

export function switchImpersonationBranchRequest(
  branchId: string,
  reason?: string,
) {
  return impersonationFetch<{
    impersonationToken: string;
    expiresAt: string;
    branchId: string;
  }>("/super-admin/impersonation/switch-branch", {
    method: "POST",
    body: JSON.stringify({ branchId, reason: reason || undefined }),
  });
}

export function endImpersonationRequest(endReason: string) {
  return impersonationFetch<{
    impersonationSessionId: string;
    endedAt: string;
    endReason: string;
  }>("/super-admin/impersonation/end", {
    method: "POST",
    body: JSON.stringify({ endReason }),
  });
}

export function searchImpersonationAudit(filters: ImpersonationAuditFilters) {
  return platformAdminFetch<ImpersonationAuditPage>(
    buildImpersonationAuditPath(filters),
  );
}

export function activeImpersonationFromStart(
  response: StartImpersonationResponse,
  consent: ImpersonationConsent,
): ActiveImpersonation {
  return {
    impersonationToken: response.impersonationToken,
    session: response.session,
    allowedBranchIds: consent.allowedBranchIds,
  };
}

export function assertImpersonationScope(
  active: ActiveImpersonation,
  scope: ImpersonationScope,
) {
  if (!active.session.allowedScopes.includes(scope)) {
    throw new ApiError(
      `The tenant consent does not allow ${scope.replaceAll("_", " ")}.`,
      403,
      "IMPERSONATION_SCOPE_FORBIDDEN",
    );
  }
}

export async function endAndClearImpersonation(
  endReason: string,
  requestEnd: (reason: string) => Promise<unknown> = endImpersonationRequest,
) {
  try {
    await requestEnd(endReason);
  } finally {
    impersonationStorage.clear();
  }
}
