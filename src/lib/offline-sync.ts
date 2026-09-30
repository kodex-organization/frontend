import { apiFetch } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/session";

const OUTBOX_KEY = "cuecloud_sync_outbox";

type QueueAction = "START" | "PAUSE" | "RESUME" | "END" | "SWITCH_TABLE";

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
  const version = tokenStorage.getSessionVersion();
  const context = tokenStorage.getAccessContext();
  if (!context) return { pushedCount: 0 };
  const changes = getSyncQueue();
  if (changes.length === 0) return { pushedCount: 0 };

  const contextDeviceId = context?.deviceId || tokenStorage.getAccessContext()?.deviceId;
  const deviceId = contextDeviceId || (canUseStorage() ? window.localStorage.getItem("device_id") : null) || crypto.randomUUID();

  if (canUseStorage() && contextDeviceId) {
    window.localStorage.setItem("device_id", contextDeviceId);
  }

  const sanitizedChanges = changes.map((c) => ({
    idempotencyKey: c.idempotencyKey || crypto.randomUUID(),
    entityType: c.entityType || "Session",
    entityId: c.entityId,
    action: c.action,
    payload: c.payload ?? {},
    originTimestamp: c.originTimestamp ? new Date(c.originTimestamp).toISOString() : new Date().toISOString(),
  }));

  const response = await apiFetch<{ processed?: number; acceptedChanges?: unknown[] }>(
    "/sync/push",
    {
      method: "POST",
      body: JSON.stringify({ deviceId, changes: sanitizedChanges }),
    },
  );

  if (tokenStorage.getSessionVersion() !== version || !tokenStorage.getAccessContext()) {
    return { pushedCount: 0 };
  }
  clearSyncQueue();
  return { pushedCount: response.processed ?? response.acceptedChanges?.length ?? changes.length };
}
