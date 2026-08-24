import { apiFetch } from "@/lib/api/client";
import type { ImpersonationScope } from "@/lib/platform-admin/impersonation-session";

export interface TenantImpersonationConsent {
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
}

export interface GrantConsentInput {
  allowedScopes: ImpersonationScope[];
  allowedBranchIds: string[];
  reason: string;
  expiresAt: string;
}

export function getConsentState(
  consent: Pick<TenantImpersonationConsent, "expiresAt" | "revokedAt">,
  now = new Date(),
) {
  if (consent.revokedAt) return "revoked" as const;
  if (new Date(consent.expiresAt) <= now) return "expired" as const;
  return "active" as const;
}

export function listTenantConsents() {
  return apiFetch<TenantImpersonationConsent[]>(
    "/tenancy/support-consents/?includeExpired=true&includeRevoked=true",
  );
}

export function grantTenantConsent(input: GrantConsentInput) {
  return apiFetch<TenantImpersonationConsent>(
    "/tenancy/support-consents/",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function revokeTenantConsent(consentId: string, reason: string) {
  return apiFetch<TenantImpersonationConsent & { endedSessionCount: number }>(
    `/tenancy/support-consents/${consentId}/revoke`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}
