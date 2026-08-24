import { getActiveOfflineBranchId, offlineDB } from "@/lib/sync/offline-db";
import { markAllNotificationsRead, markNotificationRead, saveNotificationPreferences, type NotificationPreference } from "./api";

export type NotificationMutation = {
  id?: number;
  branchId: string;
  notificationId?: string;
  action: "read" | "read-all" | "preferences";
  preferences?: NotificationPreference;
  status: "pending" | "failed";
  retryCount: number;
  lastError: string | null;
};

function requireActiveBranchId() {
  const branchId = getActiveOfflineBranchId();
  if (!branchId) {
    throw new Error("An active authenticated branch is required");
  }
  return branchId;
}

export async function queueNotificationRead(
  notificationId: string,
  branchId = requireActiveBranchId(),
) {
  return offlineDB.notificationQueue.add({
    branchId,
    notificationId,
    action: "read",
    status: "pending",
    retryCount: 0,
    lastError: null,
  });
}

export async function queueNotificationsReadAll() {
  return offlineDB.notificationQueue.add({
    branchId: requireActiveBranchId(),
    action: "read-all",
    status: "pending",
    retryCount: 0,
    lastError: null,
  });
}

export async function queueNotificationPreferences(preferences: NotificationPreference) {
  return offlineDB.notificationQueue.add({
    branchId: requireActiveBranchId(),
    action: "preferences",
    preferences,
    status: "pending",
    retryCount: 0,
    lastError: null,
  });
}

export async function flushNotificationQueue() {
  const branchId = getActiveOfflineBranchId();
  if (!branchId) return;

  const items = await offlineDB.notificationQueue
    .where("[branchId+status]")
    .anyOf(
      [branchId, "pending"],
      [branchId, "failed"],
    )
    .toArray();

  for (const item of items) {
    if (getActiveOfflineBranchId() !== branchId) break;
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
