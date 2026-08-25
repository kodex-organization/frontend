import Dexie, { type Table } from "dexie";
import type { NotificationPreference } from "@/features/notifications/api";
import { tokenStorage } from "@/lib/auth/session";

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
  branchId: string;
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
  branchId: string;
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
    this.version(4)
      .stores({
        pendingQueue:
          "++id, branchId, [branchId+status], entity, entityId, action, status, idempotencyKey, originTimestamp",
        syncMeta: "key",
        notificationQueue:
          "++id, branchId, [branchId+status], notificationId, action, status",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("pendingQueue")
          .toCollection()
          .modify((item) => {
            const pendingItem = item as PendingSyncItem & {
              branchId?: string;
            };
            pendingItem.branchId ??= pendingItem.payload.branchId;
          });

        // Legacy notification mutations did not identify their branch, so
        // replaying them after an upgrade could affect the wrong branch.
        await transaction.table("notificationQueue").clear();
      });
  }
}

export const offlineDB = new CueCloudOfflineDB();

export async function queueSessionChange(
  payload: SessionOfflinePayload,
  action: "create" | "update" | "delete",
) {
  return offlineDB.pendingQueue.add({
    branchId: payload.branchId,
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
    branchId: payload.branchId,
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

export function getActiveOfflineBranchId() {
  return tokenStorage.getAccessContext()?.branchId ?? null;
}

export function filterPendingSyncItemsForBranch(
  items: PendingSyncItem[],
  branchId: string,
) {
  return items.filter((item) => item.branchId === branchId);
}

export async function getPendingSyncCount() {
  const branchId = getActiveOfflineBranchId();
  if (!branchId) return 0;

  return offlineDB.pendingQueue
    .where("[branchId+status]")
    .anyOf(
      [branchId, "pending"],
      [branchId, "failed"],
    )
    .count();
}

export async function getPendingSyncItems() {
  const branchId = getActiveOfflineBranchId();
  if (!branchId) return [];

  return offlineDB.pendingQueue
    .where("[branchId+status]")
    .anyOf(
      [branchId, "pending"],
      [branchId, "failed"],
    )
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
  const branchId = getActiveOfflineBranchId();
  if (!branchId) return;
  return offlineDB.pendingQueue.where("branchId").equals(branchId).delete();
}

const REVIEW_SYNC_SEED_KEY = "review-sync-examples-v1";
const ACTIVE_BRANCH_KEY = "active-branch-id";

export async function reScopeOfflineData(
  previousBranchId: string,
  nextBranchId: string,
) {
  const tokenBranchId = getActiveOfflineBranchId();
  if (tokenBranchId !== nextBranchId) {
    throw new Error("Offline branch scope does not match the authenticated session");
  }

  await offlineDB.transaction(
    "rw",
    offlineDB.pendingQueue,
    offlineDB.notificationQueue,
    offlineDB.syncMeta,
    async () => {
      if (previousBranchId !== nextBranchId) {
        await offlineDB.pendingQueue
          .where("branchId")
          .equals(previousBranchId)
          .filter((item) => item.status === "synced")
          .delete();
        await offlineDB.notificationQueue
          .where("branchId")
          .equals(previousBranchId)
          .filter((item) => item.status === "synced")
          .delete();
      }

      await offlineDB.syncMeta.put({
        key: ACTIVE_BRANCH_KEY,
        value: nextBranchId,
      });
    },
  );
}

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
  const branchSeedKey = `${REVIEW_SYNC_SEED_KEY}:${context.branchId}`;

  await offlineDB.transaction(
    "rw",
    offlineDB.pendingQueue,
    offlineDB.syncMeta,
    async () => {
      const existingMarker = await offlineDB.syncMeta.get(
        branchSeedKey,
      );
      if (existingMarker) return;

      const now = Date.now();
      const sessionTimestamp = new Date(now - 8 * 60_000).toISOString();
      const invoiceTimestamp = new Date(now - 4 * 60_000).toISOString();
      const sessionId = crypto.randomUUID();
      const invoiceId = crypto.randomUUID();

      await offlineDB.pendingQueue.bulkAdd([
        {
          branchId: context.branchId,
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
          branchId: context.branchId,
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
        key: branchSeedKey,
        value: new Date(now).toISOString(),
      });
      seeded = true;
    },
  );

  return seeded;
}
