import { apiFetch } from "@/lib/api/client";

type ServerTimeResponse = {
  success: boolean;
  data: {
    serverTime: string;
  };
  error: string | null;
};

type HeartbeatResponse = {
  success: boolean;
  data: {
    deviceId: string;
    branchId: string;
    lastHeartbeatAt: string;
    lastSyncedAt: string | null;
  };
  error: string | null;
};

type SyncPushChange = {
  idempotencyKey: string;
  entityType: "session" | "invoice";
  entityId?: string;
  action: "create" | "update" | "delete";
  payload?: unknown;
  originTimestamp?: string;
};

type SyncPushResponse = {
  success: boolean;
  data: {
    batchId: string;
    deviceId: string;
    receivedChanges: number;
    acceptedChanges: unknown[];
    rejectedChanges: unknown[];
    serverTime: string;
  };
  error: string | null;
};

type SyncPullResponse = {
  success: boolean;
  data: {
    deviceId: string;
    since: string | null;
    changes: unknown[];
    changeCount: number;
    serverTime: string;
  };
  error: string | null;
};

export async function getServerTime() {
  return apiFetch<ServerTimeResponse>("/sync/server-time");
}

export async function sendHeartbeat(
  deviceId: string,
  branchId: string,
) {
  return apiFetch<HeartbeatResponse>("/sync/heartbeat", {
    method: "POST",
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