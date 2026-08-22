import Dexie, { type Table } from "dexie";
import type { NotificationPreference } from "@/features/notifications/api";

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

export type NotificationQueueItem = {
  id?: number;
  notificationId?: string;
  action: "read" | "read-all" | "preferences";
  preferences?: NotificationPreference;
  status: "pending" | "synced" | "failed";
  retryCount: number;
  lastError: string | null;
};

export type SyncMeta = {
  key: string;
  value: string;
};

class CueCloudOfflineDB extends Dexie {
  pendingQueue!: Table<PendingSyncItem, number>;
  notificationQueue!: Table<NotificationQueueItem, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("cuecloud_offline_db");

    this.version(2).stores({
      pendingQueue:
        "++id, entity, entityId, action, status, idempotencyKey, originTimestamp",
      syncMeta: "key",
    });
    this.version(3).stores({
      pendingQueue:
        "++id, entity, entityId, action, status, idempotencyKey, originTimestamp",
      syncMeta: "key",
      notificationQueue: "++id, notificationId, action, status",
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

const REVIEW_SYNC_SEED_KEY = "review-sync-examples-v1";

/**
 * Adds two browser-local examples for the dedicated development reviewer
 * account. The marker makes this idempotent and prevents discarded examples
 * from reappearing on every page load.
 */
export async function seedReviewSyncItems(context: {
  branchId: string;
  userId: string;
  deviceId: string;
}) {
  let seeded = false;

  await offlineDB.transaction(
    "rw",
    offlineDB.pendingQueue,
    offlineDB.syncMeta,
    async () => {
      const existingMarker = await offlineDB.syncMeta.get(
        REVIEW_SYNC_SEED_KEY,
      );
      if (existingMarker) return;

      const now = Date.now();
      const sessionTimestamp = new Date(now - 8 * 60_000).toISOString();
      const invoiceTimestamp = new Date(now - 4 * 60_000).toISOString();
      const sessionId = crypto.randomUUID();
      const invoiceId = crypto.randomUUID();

      await offlineDB.pendingQueue.bulkAdd([
        {
          entity: "session",
          entityId: sessionId,
          action: "create",
          payload: {
            id: sessionId,
            branchId: context.branchId,
            tableId: null,
            customerId: null,
            ratePlanId: null,
            appliedHourlyRate: "700.00",
            openedByUserId: context.userId,
            openedByDeviceId: context.deviceId,
            startedAt: sessionTimestamp,
            expectedEndTime: null,
            endedAt: null,
            status: "active",
            rateOverrideById: null,
            rateOverrideReason: "Reviewer offline-sync example",
            createdAt: sessionTimestamp,
          },
          status: "pending",
          idempotencyKey: crypto.randomUUID(),
          originTimestamp: sessionTimestamp,
          retryCount: 0,
          lastError: null,
        },
        {
          entity: "invoice",
          entityId: invoiceId,
          action: "update",
          payload: {
            id: invoiceId,
            branchId: context.branchId,
            invoiceNumber: "INV-REVIEW-OFFLINE",
            sessionId: null,
            customerId: null,
            subtotal: "950.00",
            discountAmount: "0.00",
            discountReasonCode: null,
            discountApprovedById: null,
            taxAmount: "0.00",
            serviceCharge: "0.00",
            total: "950.00",
            status: "open",
            voidedInvoiceId: null,
            createdById: context.userId,
            createdAt: invoiceTimestamp,
          },
          status: "failed",
          idempotencyKey: crypto.randomUUID(),
          originTimestamp: invoiceTimestamp,
          retryCount: 1,
          lastError:
            "Review example: this offline invoice needs conflict review.",
        },
      ]);

      await offlineDB.syncMeta.put({
        key: REVIEW_SYNC_SEED_KEY,
        value: new Date(now).toISOString(),
      });
      seeded = true;
    },
  );

  return seeded;
}
