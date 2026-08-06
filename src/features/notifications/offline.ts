import { offlineDB } from "@/lib/sync/offline-db";
import { markNotificationRead } from "./api";

export type NotificationMutation = {
  id?: number;
  notificationId: string;
  action: "read";
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

export async function flushNotificationQueue() {
  const items = await offlineDB.notificationQueue
    .where("status")
    .anyOf("pending", "failed")
    .toArray();

  for (const item of items) {
    if (item.id === undefined) continue;
    try {
      await markNotificationRead(item.notificationId);
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
