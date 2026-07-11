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

export async function addDemoSessionQueueItem() {
  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();

  return queueSessionChange(
    {
      id: sessionId,
      branchId: crypto.randomUUID(),
      tableId: crypto.randomUUID(),
      customerId: null,
      ratePlanId: crypto.randomUUID(),
      appliedHourlyRate: "500.00",
      openedByUserId: crypto.randomUUID(),
      openedByDeviceId: crypto.randomUUID(),
      startedAt: now,
      expectedEndTime: null,
      endedAt: null,
      status: "active",
      rateOverrideById: null,
      rateOverrideReason: null,
      createdAt: now,
    },
    "create",
  );
}

export async function addDemoInvoiceQueueItem() {
  const now = new Date().toISOString();
  const invoiceId = crypto.randomUUID();

  return queueInvoiceChange(
    {
      id: invoiceId,
      branchId: crypto.randomUUID(),
      invoiceNumber: null,
      sessionId: crypto.randomUUID(),
      customerId: null,
      subtotal: "1000.00",
      discountAmount: "0.00",
      discountReasonCode: null,
      discountApprovedById: null,
      taxAmount: "0.00",
      serviceCharge: "0.00",
      total: "1000.00",
      status: "draft",
      voidedInvoiceId: null,
      createdById: crypto.randomUUID(),
      createdAt: now,
    },
    "create",
  );
}

export async function getPendingSyncCount() {
  return offlineDB.pendingQueue
    .where("status")
    .equals("pending")
    .count();
}

export async function getPendingSyncItems() {
  return offlineDB.pendingQueue
    .where("status")
    .equals("pending")
    .toArray();
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