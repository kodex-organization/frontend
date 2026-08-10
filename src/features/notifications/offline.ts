import { offlineDB } from "@/lib/sync/offline-db";
import { markAllNotificationsRead, markNotificationRead, saveNotificationPreferences, type NotificationPreference } from "./api";

export type NotificationMutation = {
  id?: number;
  notificationId?: string;
  action: "read" | "read-all" | "preferences";
  preferences?: NotificationPreference;
  status: "pending" | "failed";
  retryCount: number;
  lastError: string | null;
};

export async function queueNotificationRead(notificationId: string) {
  return offlineDB.notificationQueue.add({
    notificationId,
    action: "read",
    status: "pending",
    retryCount: 0,
    lastError: null,
  });
}

export async function queueNotificationsReadAll() {
  return offlineDB.notificationQueue.add({
    action: "read-all",
    status: "pending",
    retryCount: 0,
    lastError: null,
  });
}

export async function queueNotificationPreferences(preferences: NotificationPreference) {
  return offlineDB.notificationQueue.add({
    action: "preferences",
    preferences,
    status: "pending",
    retryCount: 0,
    lastError: null,
  });
}

export async function flushNotificationQueue() {
  const items = await offlineDB.notificationQueue
    .where("status")
    .anyOf("pending", "failed")
    .toArray();

  for (const item of items) {
    if (item.id === undefined) continue;
    try {
      if (item.action === "read" && item.notificationId) {
        await markNotificationRead(item.notificationId);
      } else if (item.action === "read-all") {
        await markAllNotificationsRead();
      } else if (item.action === "preferences" && item.preferences) {
        await saveNotificationPreferences(item.preferences);
      }
      await offlineDB.notificationQueue.update(item.id, { status: "synced", lastError: null });
    } catch (error) {
      await offlineDB.notificationQueue.update(item.id, {
        status: "failed",
        retryCount: item.retryCount + 1,
        lastError: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }
}
