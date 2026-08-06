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

export function revokeFcmToken(token: string) {
  return apiFetch<{ revoked: boolean }>("/notifications/fcm-token", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}

export function listFcmDevices() {
  return apiFetch<Array<{ id: string; platform: string | null; isActive: boolean; lastSeenAt: string; revokedAt: string | null }>>("/notifications/fcm-devices");
}

/** The current backend has no bulk route; callers fan out the supported PATCH. */
export async function markAllNotificationsRead(ids: string[]) {
  await Promise.all(ids.map((id) => markNotificationRead(id)));
}
