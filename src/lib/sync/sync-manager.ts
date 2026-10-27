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
import { checkServerConnection, getConnectionStatus } from '@/lib/connectivity/online-status';
import { triggerSyncPush } from "@/lib/offline-sync";

export const SYNC_STATUS_EVENT = "cuecloud:sync-status-changed";
export const SYNC_PUSHED_EVENT = "cuecloud:sync-pushed";

const SYNC_STALL_MS = 60_000;
const RECONNECT_RETRY_DELAYS_MS = [3_000, 8_000, 20_000];

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;
let syncStartedAt = 0;
let syncRunId = 0;
let lastPullServerTime: string | undefined;

export async function performAutoSync(): Promise<{
  pushed: number;
  pulled: number;
  errors: number;
}> {
  // A hung request must not block auto-sync forever.
  if (isSyncing && Date.now() - syncStartedAt < SYNC_STALL_MS) return { pushed: 0, pulled: 0, errors: 0 };
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
  syncStartedAt = Date.now();
  const runId = ++syncRunId;
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
    // Oldest first so e.g. an invoice create always reaches the server before its void.
    const itemsToPush = pendingItems
      .filter((item) => item.status === "pending" || item.status === "failed")
      .sort(
        (a, b) =>
          String(a.originTimestamp).localeCompare(String(b.originTimestamp)) ||
          (a.id ?? 0) - (b.id ?? 0),
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
        pushedCount += acceptedIds.length;

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
      const pullResponse = await pullSyncChanges(deviceId, lastPullServerTime);
      if (!sessionIsCurrent()) return result();
      pulledCount = pullResponse.changeCount;
      lastPullServerTime = pullResponse.serverTime;
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
      // Lets lists (billing etc.) reload server data once local changes have been sent.
      if (pushedCount > 0) window.dispatchEvent(new Event(SYNC_PUSHED_EVENT));
    }
  } finally {
    if (runId === syncRunId) isSyncing = false;
  }

  return { pushed: pushedCount, pulled: pulledCount, errors: errorCount };
}

export function initSyncManager() {
  if (typeof window === "undefined") return () => {};

  let retryTimers: ReturnType<typeof setTimeout>[] = [];
  let queueDebounce: ReturnType<typeof setTimeout> | null = null;

  const clearRetries = () => {
    retryTimers.forEach(clearTimeout);
    retryTimers = [];
  };

  // Right after reconnecting the network is often not ready yet, so retry a few times.
  const syncWithRetries = async () => {
    clearRetries();
    try {
      await checkServerConnection();
    } catch {
      // The sync below re-checks the connection itself.
    }
    const outcome = await performAutoSync();
    if (outcome.errors === 0 && getConnectionStatus() === "online") return;
    RECONNECT_RETRY_DELAYS_MS.forEach((delay) => {
      retryTimers.push(
        setTimeout(() => {
          if (navigator.onLine) void performAutoSync();
        }, delay),
      );
    });
  };

  const handleOnline = () => {
    void syncWithRetries();
  };

  // Changes queued while the app thinks it is online should not wait for the next interval.
  const handleQueueChanged = () => {
    if (!navigator.onLine) return;
    if (queueDebounce) clearTimeout(queueDebounce);
    queueDebounce = setTimeout(() => {
      void performAutoSync();
    }, 1_500);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("cuecloud:offline-queue-changed", handleQueueChanged);

  if (syncInterval) clearInterval(syncInterval);
  const interval = setInterval(() => {
    if (navigator.onLine) {
      void performAutoSync();
    }
  }, 45_000); // Check and sync every 45s if online
  syncInterval = interval;

  // Trigger immediate sync on init if online
  if (navigator.onLine) {
    void syncWithRetries();
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("cuecloud:offline-queue-changed", handleQueueChanged);
    clearRetries();
    if (queueDebounce) clearTimeout(queueDebounce);
    clearInterval(interval);
    if (syncInterval === interval) syncInterval = null;
  };
}
