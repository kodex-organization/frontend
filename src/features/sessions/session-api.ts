import { apiFetch } from "@/lib/api/client";
import {
  offlineDB,
  getActiveOfflineBranchId,
} from "@/lib/sync/offline-db";
import { addToSyncQueue } from "@/lib/offline-sync";
import { tokenStorage } from "@/lib/auth/session";
import type { ActiveSession, Customer, TableOption } from "./types";

const OFFLINE_TABLES_KEY = "cuecloud_offline_tables";

const request = <T>(path: string, options?: RequestInit) =>
  apiFetch<T>(path, options);

export const sessionApi = {
  active: async (branchId?: string): Promise<ActiveSession[]> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline active");
      }
      const data = await request<ActiveSession[]>(
        `/sessions?status=active&limit=100${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`,
      );

      // Cache active sessions in IndexedDB
      if (Array.isArray(data) && typeof window !== "undefined") {
        const effectiveBranchId = branchId || getActiveOfflineBranchId() || "default";
        void offlineDB.cachedTables.bulkPut(
          data.map((s) => ({
            id: s.id,
            branchId: effectiveBranchId,
            data: s,
            cachedAt: new Date().toISOString(),
          })),
        );
      }
      return data;
    } catch {
      const effectiveBranchId = branchId || getActiveOfflineBranchId();
      const cached = effectiveBranchId
        ? await offlineDB.cachedTables.where("branchId").equals(effectiveBranchId).toArray()
        : await offlineDB.cachedTables.toArray();

      return cached.map((c) => c.data as ActiveSession);
    }
  },

  paused: async (branchId?: string): Promise<ActiveSession[]> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline paused");
      }
      return await request<ActiveSession[]>(
        `/sessions?status=paused&limit=100${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`,
      );
    } catch {
      const effectiveBranchId = branchId || getActiveOfflineBranchId();
      const cached = effectiveBranchId
        ? await offlineDB.cachedTables.where("branchId").equals(effectiveBranchId).toArray()
        : await offlineDB.cachedTables.toArray();
      return cached
        .map((item) => item.data as ActiveSession)
        .filter((session) => session.status === "paused");
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
        return Array.isArray(cached) ? cached as TableOption[] : [];
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

    const offlineSession: ActiveSession = {
      id: sessionId,
      status: "active",
      startedAt,
      endedAt: null,
      appliedHourlyRate: "700.00",
      customer: null,
      table: {
        id: body.tableId,
        tableNumber: "Offline Table",
        defaultHourlyRate: "700.00",
        currency: "PKR",
      },
      branch: {
        id: effectiveBranchId,
        name: "Current Branch",
        currency: "PKR",
      },
      pauses: [],
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await offlineDB.cachedTables.put({
        id: sessionId,
        branchId: effectiveBranchId,
        data: offlineSession,
        cachedAt: startedAt,
      });

      addToSyncQueue({
        idempotencyKey: crypto.randomUUID(),
        entityType: "Session",
        entityId: sessionId,
        action: "START",
        payload: { ...body, id: sessionId, branchId: effectiveBranchId, startedAt, status: "active" },
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

      addToSyncQueue({
        idempotencyKey: crypto.randomUUID(),
        entityType: "Session",
        entityId: sessionId,
        action: "START",
        payload: { ...body, id: sessionId, branchId: effectiveBranchId, startedAt, status: "active" },
        originTimestamp: startedAt,
      });

      return { ...offlineSession, offlineQueued: true };
    }
  },

  action: async (id: string, action: "pause" | "resume" | "end"): Promise<{ ok?: boolean; offlineQueued?: boolean }> => {
    const effectiveBranchId = getActiveOfflineBranchId() || "default";

    const queueAction = action === "pause" ? "PAUSE" : action === "resume" ? "RESUME" : "END";
    const queueOfflineAction = () => addToSyncQueue({
      idempotencyKey: crypto.randomUUID(),
      entityType: "Session",
      entityId: id,
      action: queueAction,
      payload: {
        id,
        branchId: effectiveBranchId,
        status: action === "pause" ? "paused" : action === "end" ? "ended" : "active",
        endedAt: action === "end" ? new Date().toISOString() : null,
      },
      originTimestamp: new Date().toISOString(),
    });

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOfflineAction();
      return { ok: true, offlineQueued: true };
    }

    try {
      return await request<{ ok?: boolean }>(`/sessions/${id}/${action}`, {
        method: "POST",
      });
    } catch {
      queueOfflineAction();
      return { ok: true, offlineQueued: true };
    }
  },

  switchTable: (id: string, tableId: string) =>
    request<unknown>(`/sessions/${id}/switch-table`, {
      method: "POST",
      body: JSON.stringify({ tableId }),
    }),
};
