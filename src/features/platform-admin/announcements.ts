import { apiFetch } from "@/lib/api/client";
import { platformAdminFetch } from "@/lib/platform-admin/client";

export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementAudience =
  | "all_tenants"
  | "selected_tenants"
  | "selected_roles";

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  targetRoles: string[];
  startsAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  targetTenants: Array<{ tenant: { id: string; name: string } }>;
  createdByPlatformAdmin: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetTenantIds: string[];
  targetRoles: string[];
  startsAt: string | null;
  expiresAt: string | null;
}

export interface TenantAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  startsAt: string | null;
  expiresAt: string | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  dismissedAt: string | null;
}

export function parseIdentifierList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getVisibleTenantAnnouncements(
  announcements: TenantAnnouncement[],
  now = new Date(),
) {
  return announcements.filter((announcement) => {
    if (announcement.dismissedAt) return false;
    const startsAt = announcement.startsAt
      ? new Date(announcement.startsAt)
      : null;
    const expiresAt = announcement.expiresAt
      ? new Date(announcement.expiresAt)
      : null;
    return (!startsAt || startsAt <= now) && (!expiresAt || expiresAt > now);
  });
}

export function listPlatformAnnouncements(filters: {
  status?: AnnouncementStatus;
  audience?: AnnouncementAudience;
}) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.audience) query.set("audience", filters.audience);
  const suffix = query.size ? `?${query.toString()}` : "";
  return platformAdminFetch<PlatformAnnouncement[]>(
    `/super-admin/announcements/${suffix}`,
  );
}

export function createPlatformAnnouncement(input: AnnouncementInput) {
  return platformAdminFetch<PlatformAnnouncement>(
    "/super-admin/announcements/",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updatePlatformAnnouncement(
  announcementId: string,
  input: AnnouncementInput,
) {
  return platformAdminFetch<PlatformAnnouncement>(
    `/super-admin/announcements/${announcementId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function publishPlatformAnnouncement(announcementId: string) {
  return platformAdminFetch<PlatformAnnouncement>(
    `/super-admin/announcements/${announcementId}/publish`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function archivePlatformAnnouncement(announcementId: string) {
  return platformAdminFetch<PlatformAnnouncement>(
    `/super-admin/announcements/${announcementId}/archive`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function listTenantAnnouncements() {
  return apiFetch<TenantAnnouncement[]>("/announcements/");
}

export function markTenantAnnouncementRead(announcementId: string) {
  return apiFetch<{ announcementId: string; readAt: string; dismissedAt: string | null }>(
    `/announcements/${announcementId}/read`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function dismissTenantAnnouncement(announcementId: string) {
  return apiFetch<{ announcementId: string; readAt: string | null; dismissedAt: string }>(
    `/announcements/${announcementId}/dismiss`,
    { method: "POST", body: JSON.stringify({}) },
  );
}
