import { apiFetch } from "@/lib/api/client";
import {
  offlineDB,
  getActiveOfflineBranchId,
  queueSessionChange,
} from "@/lib/sync/offline-db";
import { addToSyncQueue, getSyncQueue } from "@/lib/offline-sync";
import { tokenStorage } from "@/lib/auth/session";
import type { ActiveSession, Customer, TableOption } from "./types";

const OFFLINE_TABLES_KEY = "cuecloud_offline_tables";

const request = <T>(path: string, options?: RequestInit) =>
  apiFetch<T>(path, options);

function cleanFloorViewLocalStorage(sessionId: string, action: "pause" | "resume" | "end") {
  if (typeof window === "undefined") return;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("cuecloud_offline_floor_tables")) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const tables = JSON.parse(raw);
        if (Array.isArray(tables)) {
          let modified = false;
          const next = tables.map((t: any) => {
            if (t.session?.sessionId === sessionId) {
              modified = true;
              if (action === "end") {
                return { ...t, status: "available", session: null };
              }
              return {
                ...t,
                status: action === "pause" ? "paused" : "occupied",
                session: {
                  ...t.session,
                  isPaused: action === "pause",
                  billingState: action === "pause" ? "paused" : "accruing",
                },
              };
            }
            return t;
          });
          if (modified) {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        }
      } catch {}
    }
  }
}

export const sessionApi = {
  active: async (branchId?: string): Promise<ActiveSession[]> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline active");
      }
      const data = await request<ActiveSession[]>(
        `/sessions?status=active&limit=100${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`,
      );

      let dbPendingItems: any[] = [];
      try {
        dbPendingItems = await offlineDB.pendingQueue.where("entity").equals("session").toArray();
      } catch {}

      const pendingEndIds = new Set([
        ...getSyncQueue()
          .filter((q) => q.entityType === "Session" && q.action === "END")
          .map((q) => q.entityId),
        ...dbPendingItems
          .filter((q) => (q.action === "END" || q.action === "delete") && (q.status === "pending" || q.status === "failed"))
          .map((q) => q.entityId),
      ]);
      const filteredData = Array.isArray(data)
        ? data.filter((s) => !pendingEndIds.has(s.id))
        : [];

      // Reconcile active sessions in IndexedDB
      if (typeof window !== "undefined") {
        const effectiveBranchId = branchId || getActiveOfflineBranchId() || "default";

        // Query all cached items for this branch
        const existingBranchItems = await offlineDB.cachedTables
          .where("branchId")
          .equals(effectiveBranchId)
          .toArray();

        const serverActiveIds = new Set(filteredData.map((s) => s.id));
        const pendingStartIds = new Set([
          ...getSyncQueue()
            .filter((q) => q.entityType === "Session" && q.action === "START")
            .map((q) => q.entityId),
          ...dbPendingItems
            .filter((q) => (q.action === "START" || q.action === "create") && (q.status === "pending" || q.status === "failed"))
            .map((q) => q.entityId),
        ]);

        // Obsolete sessions that are no longer active on the server and not pending start
        const obsoleteIds = existingBranchItems
          .filter((item) => (!serverActiveIds.has(item.id) && !pendingStartIds.has(item.id)) || pendingEndIds.has(item.id))
          .map((item) => item.id);

        if (obsoleteIds.length > 0) {
          await offlineDB.cachedTables.bulkDelete(obsoleteIds);
        }

        if (filteredData.length > 0) {
          await offlineDB.cachedTables.bulkPut(
            filteredData.map((s) => ({
              id: s.id,
              branchId: effectiveBranchId,
              data: { ...s, status: "active" as const },
              cachedAt: new Date().toISOString(),
            })),
          );
        }

        const pendingSessionsToMerge: ActiveSession[] = [];
        for (const item of existingBranchItems) {
          if (
            pendingStartIds.has(item.id) &&
            !serverActiveIds.has(item.id) &&
            !pendingEndIds.has(item.id) &&
            item.data
          ) {
            pendingSessionsToMerge.push(item.data as ActiveSession);
          }
        }

        return [...pendingSessionsToMerge, ...filteredData];
      }
      return filteredData;
    } catch {
      const effectiveBranchId = branchId || getActiveOfflineBranchId();
      const cached = effectiveBranchId
        ? await offlineDB.cachedTables
            .where("branchId")
            .equals(effectiveBranchId)
            .toArray()
        : await offlineDB.cachedTables.toArray();

      let dbPendingItems: any[] = [];
      try {
        dbPendingItems = await offlineDB.pendingQueue.where("entity").equals("session").toArray();
      } catch {}

      const pendingEndIds = new Set([
        ...getSyncQueue()
          .filter((q) => q.entityType === "Session" && q.action === "END")
          .map((q) => q.entityId),
        ...dbPendingItems
          .filter((q) => (q.action === "END" || q.action === "delete") && (q.status === "pending" || q.status === "failed"))
          .map((q) => q.entityId),
      ]);

      return cached
        .map((c) => c.data as ActiveSession)
        .filter((session) => session && (session.status === "active" || !session.status) && !pendingEndIds.has(session.id));
    }
  },

  paused: async (branchId?: string): Promise<ActiveSession[]> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline paused");
      }
      const data = await request<ActiveSession[]>(
        `/sessions?status=paused&limit=100${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`,
      );

      const pendingEndIds = new Set(
        getSyncQueue()
          .filter((q) => q.entityType === "Session" && q.action === "END")
          .map((q) => q.entityId),
      );
      const filteredData = Array.isArray(data)
        ? data.filter((s) => !pendingEndIds.has(s.id))
        : [];

      if (typeof window !== "undefined") {
        const effectiveBranchId = branchId || getActiveOfflineBranchId() || "default";
        if (filteredData.length > 0) {
          await offlineDB.cachedTables.bulkPut(
            filteredData.map((s) => ({
              id: s.id,
              branchId: effectiveBranchId,
              data: { ...s, status: "paused" as const },
              cachedAt: new Date().toISOString(),
            })),
          );
        }
      }
      return filteredData;
    } catch {
      const effectiveBranchId = branchId || getActiveOfflineBranchId();
      const cached = effectiveBranchId
        ? await offlineDB.cachedTables
            .where("branchId")
            .equals(effectiveBranchId)
            .toArray()
        : await offlineDB.cachedTables.toArray();

      const pendingEndIds = new Set(
        getSyncQueue()
          .filter((q) => q.entityType === "Session" && q.action === "END")
          .map((q) => q.entityId),
      );

      return cached
        .map((item) => item.data as ActiveSession)
        .filter((session) => session && session.status === "paused" && !pendingEndIds.has(session.id));
    }
  },

  tables: async (branchId?: string): Promise<TableOption[]> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline active");
      }
      const tables = await request<TableOption[]>(
        `/sessions/available-tables${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`,
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OFFLINE_TABLES_KEY, JSON.stringify(tables));
      }
      return tables;
    } catch {
      if (typeof window === "undefined") return [];
      try {
        const cached = JSON.parse(window.localStorage.getItem(OFFLINE_TABLES_KEY) || "[]");
        const tablesList = Array.isArray(cached) ? (cached as TableOption[]) : [];
        const effectiveBranchId = branchId || getActiveOfflineBranchId();
        const cachedSessions = effectiveBranchId
          ? await offlineDB.cachedTables
              .where("branchId")
              .equals(effectiveBranchId)
              .toArray()
          : await offlineDB.cachedTables.toArray();

        const pendingEndIds = new Set(
          getSyncQueue()
            .filter((q) => q.entityType === "Session" && q.action === "END")
            .map((q) => q.entityId),
        );

        const occupiedTableIds = new Set(
          cachedSessions
            .map((item) => item.data as ActiveSession)
            .filter((session) => session && (session.status === "active" || session.status === "paused") && !pendingEndIds.has(session.id))
            .map((session) => session.table?.id)
            .filter(Boolean),
        );

        return tablesList.filter((table) => !occupiedTableIds.has(table.id));
      } catch {
        return [];
      }
    }
  },

  customers: (query: string) =>
    request<Customer[]>(`/customers?q=${encodeURIComponent(query)}&limit=10`),

  start: async (body: {
    branchId?: string;
    tableId: string;
    customerId?: string | null;
  }): Promise<ActiveSession & { offlineQueued?: boolean }> => {
    const effectiveBranchId =
      body.branchId || getActiveOfflineBranchId() || "default";
    const sessionId = crypto.randomUUID();
    const accessContext = tokenStorage.getAccessContext();
    const startedAt = new Date().toISOString();

    let matchedTable: TableOption | undefined;
    if (typeof window !== "undefined") {
      try {
        const cached = JSON.parse(window.localStorage.getItem(OFFLINE_TABLES_KEY) || "[]");
        matchedTable = Array.isArray(cached)
          ? cached.find((t: TableOption) => t.id === body.tableId)
          : undefined;
      } catch {}
    }

    let matchedCustomer: Customer | null = null;
    if (body.customerId) {
      try {
        const cachedCust = await offlineDB.cachedCustomers.get(body.customerId);
        if (cachedCust) {
          const cData = (cachedCust as any).data || cachedCust;
          matchedCustomer = {
            id: cachedCust.id || body.customerId,
            fullName: cData.fullName || "Customer",
            phone: cData.phone || "",
            cnic: cData.cnic ?? null,
          };
        }
      } catch {}
    }

    const sanitizedCustomerId = body.customerId && body.customerId.trim() !== "" ? body.customerId.trim() : null;
    const appliedHourlyRate = String(matchedTable?.defaultHourlyRate ?? (matchedTable as any)?.hourlyRate ?? "700.00");

    const offlineSession: ActiveSession = {
      id: sessionId,
      status: "active",
      startedAt,
      endedAt: null,
      appliedHourlyRate,
      customer: matchedCustomer,
      table: {
        id: body.tableId,
        tableNumber: matchedTable?.tableNumber ?? "Offline Table",
        defaultHourlyRate: matchedTable?.defaultHourlyRate ?? "700.00",
        currency: matchedTable?.currency ?? "PKR",
      },
      branch: {
        id: effectiveBranchId,
        name: "Current Branch",
        currency: "PKR",
      },
      pauses: [],
    };

    const sessionPayload = {
      ...body,
      id: sessionId,
      branchId: effectiveBranchId,
      startedAt,
      status: "active" as const,
      appliedHourlyRate,
      tableId: body.tableId,
      customerId: sanitizedCustomerId,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await offlineDB.cachedTables.put({
        id: sessionId,
        branchId: effectiveBranchId,
        data: offlineSession,
        cachedAt: startedAt,
      });

      await queueSessionChange(sessionPayload, "START");

      addToSyncQueue({
        idempotencyKey: crypto.randomUUID(),
        entityType: "Session",
        entityId: sessionId,
        action: "START",
        payload: sessionPayload,
        originTimestamp: startedAt,
      });

      return { ...offlineSession, offlineQueued: true };
    }

    try {
      const liveSession = await request<ActiveSession>("/sessions", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await offlineDB.cachedTables.put({
        id: liveSession.id,
        branchId: effectiveBranchId,
        data: liveSession,
        cachedAt: new Date().toISOString(),
      });

      return liveSession;
    } catch {
      await offlineDB.cachedTables.put({
        id: sessionId,
        branchId: effectiveBranchId,
        data: offlineSession,
        cachedAt: startedAt,
      });

      await queueSessionChange(sessionPayload, "START");

      addToSyncQueue({
        idempotencyKey: crypto.randomUUID(),
        entityType: "Session",
        entityId: sessionId,
        action: "START",
        payload: sessionPayload,
        originTimestamp: startedAt,
      });

      return { ...offlineSession, offlineQueued: true };
    }
  },

  action: async (id: string, action: "pause" | "resume" | "end"): Promise<{ ok?: boolean; offlineQueued?: boolean }> => {
    const effectiveBranchId = getActiveOfflineBranchId() || "default";

    const updateOfflineDb = async () => {
      try {
        if (action === "end") {
          await offlineDB.cachedTables.delete(id);
        } else {
          const item = await offlineDB.cachedTables.get(id);
          if (item && item.data) {
            await offlineDB.cachedTables.put({
              ...item,
              data: {
                ...item.data,
                status: action === "pause" ? "paused" : "active",
              },
            });
          }
        }
        cleanFloorViewLocalStorage(id, action);
      } catch {}
    };

    const queueAction = action === "pause" ? "PAUSE" : action === "resume" ? "RESUME" : "END";
    const queueOfflineAction = async () => {
      await updateOfflineDb();
      const payload = {
        id,
        branchId: effectiveBranchId,
        status: action === "pause" ? ("paused" as const) : action === "end" ? ("ended" as const) : ("active" as const),
        endedAt: action === "end" ? new Date().toISOString() : null,
      };

      await queueSessionChange(payload, queueAction);

      return addToSyncQueue({
        idempotencyKey: crypto.randomUUID(),
        entityType: "Session",
        entityId: id,
        action: queueAction,
        payload,
        originTimestamp: new Date().toISOString(),
      });
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOfflineAction();
      return { ok: true, offlineQueued: true };
    }

    try {
      const response = await request<{ ok?: boolean }>(`/sessions/${id}/${action}`, {
        method: "POST",
      });
      await updateOfflineDb();
      return response;
    } catch {
      await queueOfflineAction();
      return { ok: true, offlineQueued: true };
    }
  },

  switchTable: async (
    id: string,
    targetTableId: string,
    previousTableId?: string,
    branchId?: string,
  ): Promise<{ ok?: boolean; offlineQueued?: boolean }> => {
    const effectiveBranchId = branchId || getActiveOfflineBranchId() || "default";

    const updateOfflineDb = async () => {
      try {
        let matchedTable: TableOption | undefined;
        if (typeof window !== "undefined") {
          try {
            const cachedRaw = window.localStorage.getItem(OFFLINE_TABLES_KEY);
            const cached = cachedRaw ? JSON.parse(cachedRaw) : [];
            matchedTable = Array.isArray(cached)
              ? cached.find((t: TableOption) => t.id === targetTableId)
              : undefined;
          } catch {}
        }

        const item = await offlineDB.cachedTables.get(id);
        if (item && item.data) {
          const currentTable = item.data.table || {};
          await offlineDB.cachedTables.put({
            ...item,
            data: {
              ...item.data,
              table: {
                ...currentTable,
                id: targetTableId,
                tableNumber: matchedTable?.tableNumber ?? currentTable.tableNumber ?? "Switched Table",
                defaultHourlyRate: matchedTable?.defaultHourlyRate ?? currentTable.defaultHourlyRate,
                currency: matchedTable?.currency ?? currentTable.currency,
              },
            },
          });
        }
      } catch {}
    };

    const queueOfflineSwitch = async () => {
      await updateOfflineDb();
      const payload = {
        id,
        branchId: effectiveBranchId,
        tableId: targetTableId,
        previousTableId,
      };

      await queueSessionChange(payload, "SWITCH_TABLE");

      return addToSyncQueue({
        idempotencyKey: crypto.randomUUID(),
        entityType: "Session",
        entityId: id,
        action: "SWITCH_TABLE",
        payload,
        originTimestamp: new Date().toISOString(),
      });
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOfflineSwitch();
      return { ok: true, offlineQueued: true };
    }

    try {
      const response = await request<{ ok?: boolean }>(`/sessions/${id}/switch-table`, {
        method: "POST",
        body: JSON.stringify({ tableId: targetTableId }),
      });
      await updateOfflineDb();
      return response;
    } catch {
      await queueOfflineSwitch();
      return { ok: true, offlineQueued: true };
    }
  },
};
