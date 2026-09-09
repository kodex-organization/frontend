import { apiFetch } from "@/lib/api/client";

type ServerTimeResponse = {
  serverTime: string;
};

export type HeartbeatResponse = {
  deviceId: string;
  branchId: string;
  lastHeartbeatAt: string;
  lastSyncedAt: string | null;
};

export type SyncPushChange = {
  idempotencyKey: string;
  entityType: "session" | "invoice" | "customer" | "payment" | "udhaar" | "notification" | string;
  entityId?: string;
  action: "create" | "update" | "delete" | string;
  payload?: unknown;
  originTimestamp?: string;
};

export type SyncPushChangeResult = {
  id?: string;
  idempotencyKey: string;
  entityType: string;
  entityId: string | null;
  action: string;
  status: "accepted" | "ignored" | "rejected";
  conflictResolution: string;
  serverTimestamp: string;
  errorCode?: string;
  error?: string;
};

export type SyncPushResponse = {
  batchId: string;
  deviceId: string;
  receivedChanges: number;
  acceptedChanges: SyncPushChangeResult[];
  rejectedChanges: SyncPushChangeResult[];
  serverTime: string;
};

export type SyncPullResponse = {
  deviceId: string;
  since: string | null;
  changes: unknown[];
  changeCount: number;
  serverTime: string;
};

export async function getServerTime() {
  return apiFetch<ServerTimeResponse>("/sync/server-time");
}

export async function sendHeartbeat(
  deviceId: string,
  branchId: string,
  signal?: AbortSignal,
) {
  return apiFetch<HeartbeatResponse>("/sync/heartbeat", {
    method: "POST",
    signal,
    body: JSON.stringify({
      deviceId,
      branchId,
    }),
  });
}

export async function pushSyncChanges(
  deviceId: string,
  changes: SyncPushChange[],
) {
  return apiFetch<SyncPushResponse>("/sync/push", {
    method: "POST",
    body: JSON.stringify({
      deviceId,
      changes,
    }),
  });
}

export async function pullSyncChanges(
  deviceId: string,
  since?: string,
) {
  const query = since
    ? `/sync/pull?deviceId=${encodeURIComponent(
        deviceId,
      )}&since=${encodeURIComponent(since)}`
    : `/sync/pull?deviceId=${encodeURIComponent(deviceId)}`;

  return apiFetch<SyncPullResponse>(query);
}
