import Dexie, { type Table } from "dexie";

export type SessionStatus = "active" | "paused" | "ended";

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "partially_paid"
  | "void";

export type SessionOfflinePayload = {
  id: string;
  branchId: string;
  tableId: string | null;
  customerId: string | null;
  ratePlanId: string | null;
  appliedHourlyRate: string | null;
  openedByUserId: string | null;
  openedByDeviceId: string | null;
  startedAt: string | null;
  expectedEndTime: string | null;
  endedAt: string | null;
  status: SessionStatus;
  rateOverrideById: string | null;
  rateOverrideReason: string | null;
  createdAt: string;
};

export type InvoiceOfflinePayload = {
  id: string;
  branchId: string;
  invoiceNumber: string | null;
  sessionId: string | null;
  customerId: string | null;
  subtotal: string | null;
  discountAmount: string | null;
  discountReasonCode: string | null;
  discountApprovedById: string | null;
  taxAmount: string | null;
  serviceCharge: string | null;
  total: string | null;
  status: InvoiceStatus;
  voidedInvoiceId: string | null;
  createdById: string | null;
  createdAt: string;
};

export type PendingSyncItem = {
  id?: number;
  entity: "session" | "invoice";
  entityId: string;
  action: "create" | "update" | "delete";
  payload: SessionOfflinePayload | InvoiceOfflinePayload;
  status: "pending" | "synced" | "failed";
  idempotencyKey: string;
  originTimestamp: string;
  retryCount: number;
  lastError: string | null;
};

export type SyncMeta = {
  key: string;
  value: string;
};

class CueCloudOfflineDB extends Dexie {
  pendingQueue!: Table<PendingSyncItem, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("cuecloud_offline_db");

    this.version(2).stores({
      pendingQueue:
        "++id, entity, entityId, action, status, idempotencyKey, originTimestamp",
      syncMeta: "key",
    });
  }
}

export const offlineDB = new CueCloudOfflineDB();

export async function queueSessionChange(
  payload: SessionOfflinePayload,
  action: "create" | "update" | "delete",
) {
  return offlineDB.pendingQueue.add({
    entity: "session",
    entityId: payload.id,
    action,
    payload,
    status: "pending",
    idempotencyKey: crypto.randomUUID(),
    originTimestamp: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  });
}

export async function queueInvoiceChange(
  payload: InvoiceOfflinePayload,
  action: "create" | "update" | "delete",
) {
  return offlineDB.pendingQueue.add({
    entity: "invoice",
    entityId: payload.id,
    action,
    payload,
    status: "pending",
    idempotencyKey: crypto.randomUUID(),
    originTimestamp: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  });
}

export async function getPendingSyncCount() {
  return offlineDB.pendingQueue
    .where("status")
    .anyOf("pending", "failed")
    .count();
}

export async function getPendingSyncItems() {
  return offlineDB.pendingQueue
    .where("status")
    .anyOf("pending", "failed")
    .toArray();
}

export async function removePendingQueueItem(itemId: number) {
  return offlineDB.pendingQueue.delete(itemId);
}

export async function markItemsAsSynced(itemIds: number[]) {
  await Promise.all(
    itemIds.map((id) =>
      offlineDB.pendingQueue.update(id, {
        status: "synced",
        lastError: null,
      }),
    ),
  );
}

export async function markItemAsFailed(
  itemId: number,
  errorMessage: string,
) {
  const item = await offlineDB.pendingQueue.get(itemId);

  if (!item) {
    return;
  }

  await offlineDB.pendingQueue.update(itemId, {
    status: "failed",
    retryCount: item.retryCount + 1,
    lastError: errorMessage,
  });
}

export async function clearPendingQueue() {
  return offlineDB.pendingQueue.clear();
}
