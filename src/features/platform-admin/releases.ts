import { platformAdminFetch } from "@/lib/platform-admin/client";

export type ReleaseChannel = "stable" | "beta";
export type ReleaseStatus = "draft" | "published" | "archived";
export type TenantReleaseChannel = ReleaseChannel | "pinned";

export interface PlatformRelease {
  id: string;
  platform?: "desktop" | "mobile";
  version: string;
  channel: ReleaseChannel;
  status: ReleaseStatus;
  releaseNotes: string | null;
  minimumSupportedVersion: string | null;
  downloadUrl?: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByPlatformAdmin: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

export interface ReleaseInput {
  platform?: "desktop" | "mobile";
  version: string;
  channel: ReleaseChannel;
  releaseNotes: string | null;
  minimumSupportedVersion: string | null;
  downloadUrl?: string | null;
}

export interface TenantReleaseAssignment {
  id: string;
  tenantId: string;
  channel: TenantReleaseChannel;
  pinnedReleaseId: string | null;
  pinnedRelease: PlatformRelease | null;
  resolvedRelease: PlatformRelease | null;
  createdAt: string;
  updatedAt: string;
}

export const SEMANTIC_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function validateReleaseInput(input: ReleaseInput) {
  if (!SEMANTIC_VERSION_PATTERN.test(input.version.trim())) {
    return "Enter a semantic version such as 1.2.3 or 1.2.3-beta.1.";
  }
  if (
    input.minimumSupportedVersion &&
    !SEMANTIC_VERSION_PATTERN.test(input.minimumSupportedVersion.trim())
  ) {
    return "Minimum supported version must be a semantic version.";
  }
  return null;
}

export function listPlatformReleases(filters: {
  channel?: ReleaseChannel;
  status?: ReleaseStatus;
}) {
  const query = new URLSearchParams();
  if (filters.channel) query.set("channel", filters.channel);
  if (filters.status) query.set("status", filters.status);
  const suffix = query.size ? `?${query.toString()}` : "";
  return platformAdminFetch<PlatformRelease[]>(
    `/super-admin/releases/${suffix}`,
  );
}

export function createPlatformRelease(input: ReleaseInput) {
  return platformAdminFetch<PlatformRelease>("/super-admin/releases/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePlatformRelease(
  releaseId: string,
  input: ReleaseInput,
) {
  return platformAdminFetch<PlatformRelease>(
    `/super-admin/releases/${releaseId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function publishPlatformRelease(releaseId: string) {
  return platformAdminFetch<PlatformRelease>(
    `/super-admin/releases/${releaseId}/publish`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function archivePlatformRelease(releaseId: string) {
  return platformAdminFetch<PlatformRelease>(
    `/super-admin/releases/${releaseId}`,
    { method: "DELETE" },
  );
}

export function getTenantReleaseAssignment(tenantId: string) {
  return platformAdminFetch<TenantReleaseAssignment>(
    `/super-admin/releases/tenants/${tenantId}/channel`,
  );
}

export function assignTenantReleaseChannel(
  tenantId: string,
  channel: TenantReleaseChannel,
  pinnedReleaseId: string | null,
) {
  return platformAdminFetch<TenantReleaseAssignment>(
    `/super-admin/releases/tenants/${tenantId}/channel`,
    {
      method: "PUT",
      body: JSON.stringify({
        channel,
        pinnedReleaseId: channel === "pinned" ? pinnedReleaseId : null,
      }),
    },
  );
}
