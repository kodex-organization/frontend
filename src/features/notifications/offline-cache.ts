import { tokenStorage } from "@/lib/auth/session";
import { cacheScopedJson, readScopedJson } from "@/lib/sync/offline-reference-cache";
import type { NotificationPreference } from "./api";
import type { Notification } from "./types";

// Last server copy of notifications/preferences, kept per user and branch for offline viewing.
function cacheName(kind: "list" | "preferences"): string | null {
  const context = tokenStorage.getAccessContext();
  return context ? `notifications:${kind}:${context.userId}:${context.branchId}` : null;
}

export function cacheNotifications(items: Notification[]) {
  const name = cacheName("list");
  if (name) void cacheScopedJson(name, items);
}

export async function readCachedNotifications(): Promise<Notification[] | null> {
  const name = cacheName("list");
  return name ? (await readScopedJson<Notification[]>(name))?.data ?? null : null;
}

export async function markCachedNotificationsRead(id?: string) {
  const items = await readCachedNotifications();
  if (!items) return;
  const readAt = new Date().toISOString();
  cacheNotifications(
    items.map((item) =>
      !id || item.id === id ? { ...item, status: "read", readAt: item.readAt ?? readAt } : item,
    ),
  );
}

export function cachePreferences(preferences: NotificationPreference) {
  const name = cacheName("preferences");
  if (name) void cacheScopedJson(name, preferences);
}

export async function readCachedPreferences(): Promise<NotificationPreference | null> {
  const name = cacheName("preferences");
  return name ? (await readScopedJson<NotificationPreference>(name))?.data ?? null : null;
}