import { apiFetch } from "@/lib/api/client";
import type { Notification } from "./types";

export function getNotifications() {
  return apiFetch<Notification[]>("/notifications");
}

export function markNotificationRead(id: string) {
  return apiFetch<{ id: string; status: "read" }>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updatedCount: number }>("/notifications/read-all", { method: "PATCH" });
}

export const notificationCategories = [
  "discount", "invoice_void", "udhaar", "anomaly", "end_of_day",
  "overtime", "manager_takeover", "outage", "system",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];
export type NotificationPreference = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  dailyDigestEnabled: boolean;
  enabledCategories: NotificationCategory[];
};

export function getNotificationPreferences() {
  return apiFetch<NotificationPreference>("/notifications/preferences");
}

export function saveNotificationPreferences(preferences: NotificationPreference) {
  return apiFetch<NotificationPreference>("/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

export type DeliveryLog = {
  id: string;
  notificationId: string | null;
  channel: string;
  category: string | null;
  status: string;
  attempts: number;
  error: { code?: string | null; message?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryLogQuery = {
  page: number;
  pageSize: number;
  channel?: string;
  status?: string;
  category?: string;
};

export type DeliveryLogResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: DeliveryLog[];
};

export function getDeliveryLogs(query: DeliveryLogQuery) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  const optionalFilters: Record<string, string | undefined> = { channel: query.channel, status: query.status, category: query.category };
  for (const [key, value] of Object.entries(optionalFilters)) if (value) params.set(key, value);
  return apiFetch<DeliveryLogResponse>(`/notifications/delivery-logs?${params.toString()}`);
}

export function retryDeliveryLog(id: string) {
  return apiFetch<{ id: string; status: string; attempts: number; error: DeliveryLog["error"] }>(`/notifications/delivery-logs/${id}/retry`, { method: "POST" });
}

export interface FcmTokenRegistration {
  id: string;
  active: boolean;
  lastSeenAt: string;
}

export function registerFcmToken(token: string) {
  return apiFetch<FcmTokenRegistration>("/notifications/fcm-token", {
    method: "POST",
    body: JSON.stringify({ token, platform: "web" }),
  });
}

export function checkFcmTokenRegistration(token: string) {
  return apiFetch<{ registered: boolean }>("/notifications/fcm-token/status", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function revokeFcmToken(token: string) {
  return apiFetch<{ revoked: boolean }>("/notifications/fcm-token", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}

export function listFcmDevices() {
  return apiFetch<Array<{ id: string; platform: string | null; isActive: boolean; lastSeenAt: string; revokedAt: string | null }>>("/notifications/fcm-devices");
}
