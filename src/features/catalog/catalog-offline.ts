import { ApiError } from "@/lib/api/client";
import {
  getPendingSyncItems,
  queueTableChange,
  removePendingQueueItem,
  type TableOfflinePayload,
} from "@/lib/sync/offline-db";
import {
  cacheScopedJson,
  isNetworkFailure,
  readScopedJson,
} from "@/lib/sync/offline-reference-cache";
import type { BranchItem } from "@/types/branch";
import type { CreateTableInput, SnookerTable } from "./types/catalog.types";

// Offline support for Catalog & Tables
/** Network failure, or a gateway error (502/503/504) from a proxy whose backend is down. */
export function isServerUnreachable(error: unknown) {
  return (
    isNetworkFailure(error) ||
    (error instanceof ApiError && [502, 503, 504].includes(error.status))
  );
}

const tablesCacheName = (userId: string, branchId?: string) =>
  `catalog-tables:${userId}:${branchId ?? "all"}`;
const branchesCacheName = (userId: string) => `catalog-branches:${userId}`;

export function cacheTables(userId: string, branchId: string | undefined, tables: SnookerTable[]) {
  return cacheScopedJson<SnookerTable[]>(tablesCacheName(userId, branchId), tables);
}

export function readCachedTables(userId: string, branchId?: string) {
  return readScopedJson<SnookerTable[]>(tablesCacheName(userId, branchId));
}

export function cacheBranches(userId: string, branches: BranchItem[]) {
  return cacheScopedJson<BranchItem[]>(branchesCacheName(userId), branches);
}

/** Last known branch list. Falls back to the list the header branch selector saved. */
export async function readCachedBranches(userId: string): Promise<BranchItem[] | null> {
  const own = await readScopedJson<BranchItem[]>(branchesCacheName(userId));
  if (own) return own.data;

  const assigned = await readScopedJson<Array<{ id: string; name: string | null }>>(
    `assigned-branches:${userId}`,
  );
  if (!assigned) return null;
  // Only id and name are needed by the catalog screen.
  return assigned.data.map((branch) => ({ id: branch.id, name: branch.name }) as BranchItem);
}

/** Tables created offline that the server has not accepted yet. */
export async function getPendingTableRows(): Promise<SnookerTable[]> {
  const items = await getPendingSyncItems();
  return items
    .filter(
      (item) =>
        item.entity === "table" &&
        item.action === "create" &&
        (item.status === "pending" || item.status === "failed"),
    )
    .map((item) => {
      const payload = item.payload as TableOfflinePayload;
      return {
        id: payload.id,
        branchId: payload.branchId,
        tableNumber: payload.tableNumber,
        defaultHourlyRate: payload.defaultHourlyRate,
        status: "available",
        isActive: true,
        deletedAt: null,
        pendingSync: true,
        syncError: item.status === "failed" ? item.lastError : null,
        pendingQueueId: item.id,
      } satisfies SnookerTable;
    });
}

/** Server rows win over local pending rows with the same id (it has synced). */
export function mergeTables(server: SnookerTable[], pending: SnookerTable[]) {
  const serverIds = new Set(server.map((table) => table.id));
  return [...server, ...pending.filter((table) => !serverIds.has(table.id))];
}

export async function queueOfflineTableCreate(
  input: CreateTableInput,
  branchId: string,
): Promise<SnookerTable> {
  const payload: TableOfflinePayload = {
    id: crypto.randomUUID(),
    branchId,
    tableNumber: input.tableNumber,
    defaultHourlyRate: input.hourlyRate,
    createdAt: new Date().toISOString(),
  };
  const queueId = await queueTableChange(payload, "create");
  return {
    id: payload.id,
    branchId,
    tableNumber: payload.tableNumber,
    defaultHourlyRate: payload.defaultHourlyRate,
    status: "available",
    isActive: true,
    deletedAt: null,
    pendingSync: true,
    syncError: null,
    pendingQueueId: queueId,
  };
}

export async function discardPendingTable(queueId: number) {
  await removePendingQueueItem(queueId);
}