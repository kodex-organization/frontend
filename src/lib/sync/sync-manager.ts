import {
  getPendingSyncItems,
  markItemAsFailed,
  markItemsAsSynced,
  getActiveOfflineBranchId,
} from "./offline-db";
import {
  pushSyncChanges,
  pullSyncChanges,
  sendHeartbeat,
  getServerTime,
} from "@/services/sync.service";
import { tokenStorage } from "@/lib/auth/session";
import { getConnectionStatus } from '@/lib/connectivity/online-status';
import { triggerSyncPush } from "@/lib/offline-sync";

export const SYNC_STATUS_EVENT = "cuecloud:sync-status-changed";

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;

export async function performAutoSync(): Promise<{
  pushed: number;
  pulled: number;
  errors: number;
}> {
  if (isSyncing) return { pushed: 0, pulled: 0, errors: 0 };
  if (typeof window === "undefined" || !navigator.onLine || getConnectionStatus() === 'offline') {
    return { pushed: 0, pulled: 0, errors: 0 };
  }

  const accessContext = tokenStorage.getAccessContext();
  const branchId = getActiveOfflineBranchId();
  const deviceId = accessContext?.deviceId;
  const version = tokenStorage.getSessionVersion();
  const sessionIsCurrent = () => {
    const current = tokenStorage.getAccessContext();
    return getConnectionStatus() !== 'offline' && tokenStorage.getSessionVersion() === version && Boolean(current) &&
      current?.userId === accessContext?.userId && current?.tenantId === accessContext?.tenantId &&
      current?.branchId === branchId && current?.deviceId === deviceId;
  };

  if (!deviceId || !branchId || !sessionIsCurrent()) {
    return { pushed: 0, pulled: 0, errors: 0 };
  }

  isSyncing = true;
  let pushedCount = 0;
  let pulledCount = 0;
  let errorCount = 0;
  const result = () => ({ pushed: pushedCount, pulled: pulledCount, errors: errorCount });

  try {
    try {
      const localPush = await triggerSyncPush();
      pushedCount += localPush.pushedCount;
    } catch {
      errorCount++;
    }

    // 1. Send Heartbeat
    if (!sessionIsCurrent()) return result();
    try {
      await sendHeartbeat(deviceId, branchId);
    } catch {
      // Heartbeat best effort
    }

    // 2. Push Pending Offline Operations
    if (!sessionIsCurrent()) return result();
    const pendingItems = await getPendingSyncItems();
    if (!sessionIsCurrent()) return result();
    const itemsToPush = pendingItems.filter(
      (item) => item.status === "pending" || item.status === "failed",
    );

    if (itemsToPush.length > 0) {
      try {
        const response = await pushSyncChanges(
          deviceId,
          itemsToPush.map((item) => ({
            idempotencyKey: item.idempotencyKey,
            entityType: item.entity,
            entityId: item.entityId,
            action: item.action,
            payload: item.payload,
            originTimestamp: item.originTimestamp,
          })),
        );

        const acceptedKeys = new Set(
          response.acceptedChanges
            .map((change) => change.idempotencyKey)
            .filter(Boolean),
        );
        if (!sessionIsCurrent()) return result();
        const rejectedByKey = new Map(
          response.rejectedChanges.map((change) => [
            change.idempotencyKey,
            change,
          ]),
        );

        const acceptedIds = itemsToPush
          .filter((item) => acceptedKeys.has(item.idempotencyKey))
          .map((item) => item.id)
          .filter((id): id is number => typeof id === "number");

        await markItemsAsSynced(acceptedIds);
        if (!sessionIsCurrent()) return result();
        pushedCount = acceptedIds.length;

        for (const item of itemsToPush.filter(
          (entry) => !acceptedKeys.has(entry.idempotencyKey),
        )) {
          if (typeof item.id === "number") {
            if (!sessionIsCurrent()) return result();
            const rejection = rejectedByKey.get(item.idempotencyKey);
            await markItemAsFailed(
              item.id,
              rejection?.error ?? "Server rejected this change.",
            );
            errorCount++;
          }
        }
      } catch (pushErr) {
        console.warn("[SyncManager] Push sync failed:", pushErr);
        errorCount++;
      }
    }

    // 3. Pull Recent Changes
    if (!sessionIsCurrent()) return result();
    try {
      const pullResponse = await pullSyncChanges(deviceId);
      if (!sessionIsCurrent()) return result();
      pulledCount = pullResponse.changeCount;
    } catch {
      // Pull best effort
    }

    // Dispatch global event for status listeners
    if (!sessionIsCurrent()) return result();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(SYNC_STATUS_EVENT, {
          detail: { pushedCount, pulledCount, errorCount, timestamp: Date.now() },
        }),
      );
    }
  } finally {
    isSyncing = false;
  }

  return { pushed: pushedCount, pulled: pulledCount, errors: errorCount };
}

export function initSyncManager() {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => {
    void performAutoSync();
  };

  window.addEventListener("online", handleOnline);

  if (syncInterval) clearInterval(syncInterval);
  const interval = setInterval(() => {
    if (navigator.onLine) {
      void performAutoSync();
    }
  }, 45_000); // Check and sync every 45s if online
  syncInterval = interval;

  // Trigger immediate sync on init if online
  if (navigator.onLine) {
    void performAutoSync();
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
    if (syncInterval === interval) syncInterval = null;
  };
}
