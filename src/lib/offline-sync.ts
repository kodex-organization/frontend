import { apiFetch } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/session";

const OUTBOX_KEY = "cuecloud_sync_outbox";

type QueueAction = "START" | "PAUSE" | "RESUME" | "END";

export interface QueueItem {
  idempotencyKey: string;
  entityType: "Session" | "Invoice" | "Udhaar";
  entityId: string;
  action: QueueAction;
  payload: Record<string, unknown>;
  originTimestamp: string;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getSyncQueue(): QueueItem[] {
  if (!canUseStorage()) return [];

  try {
    const value = window.localStorage.getItem(OUTBOX_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(items: QueueItem[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  }
}

export function addToSyncQueue(item: QueueItem) {
  saveSyncQueue([...getSyncQueue(), item]);
  if (canUseStorage()) {
    window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
  }
}

export function clearSyncQueue() {
  saveSyncQueue([]);
  if (canUseStorage()) {
    window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
  }
}

export function getQueueCount() {
  return getSyncQueue().length;
}

export async function triggerSyncPush(): Promise<{ pushedCount: number }> {
  const changes = getSyncQueue();
  if (changes.length === 0) return { pushedCount: 0 };

  const storedDeviceId = canUseStorage()
    ? window.localStorage.getItem("device_id")
    : null;
  const deviceId = storedDeviceId || tokenStorage.getAccessContext()?.deviceId || crypto.randomUUID();

  if (canUseStorage() && !storedDeviceId) {
    window.localStorage.setItem("device_id", deviceId);
  }

  const response = await apiFetch<{ processed?: number; acceptedChanges?: unknown[] }>(
    "/sync/push",
    {
      method: "POST",
      body: JSON.stringify({ deviceId, changes }),
    },
  );

  clearSyncQueue();
  return { pushedCount: response.processed ?? response.acceptedChanges?.length ?? changes.length };
}
