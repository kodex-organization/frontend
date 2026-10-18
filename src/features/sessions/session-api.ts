import { apiFetch } from "@/lib/api/client";
import { isAppOffline } from "@/lib/connectivity/online-status";
import {
  offlineDB,
  getActiveOfflineBranchId,
  queueSessionChange,
  queueInvoiceChange,
} from "@/lib/sync/offline-db";
import { addToSyncQueue, getSyncQueue } from "@/lib/offline-sync";
import { tokenStorage } from "@/lib/auth/session";
import {
  canSeeAllBranchesOffline,
  isCustomerCacheUsable,
} from "@/lib/sync/offline-reference-cache";
import { getCachedBranchCurrency } from "@/features/tenancy/branch-currency-cache";
import type { ActiveSession, Customer, TableOption } from "./types";
import { addCachedTable, readCachedTables, saveCachedTables } from "./offline-tables-cache";
import { getServerNowMs } from "./session-timing";

const request = <T>(path: string, options?: RequestInit) =>
  apiFetch<T>(path, options);

// Offline customer search over the IndexedDB cache, same branch visibility as the customers module.
async function searchCachedCustomers(query: string, limit = 10): Promise<Customer[]> {
  if (!(await isCustomerCacheUsable())) return [];

  const branchId = getActiveOfflineBranchId();
  const seesAllBranches = canSeeAllBranchesOffline();
  const rows =
    !seesAllBranches && branchId
      ? await offlineDB.cachedCustomers.where("branchId").equals(branchId).toArray()
      : await offlineDB.cachedCustomers.toArray();

  const term = query.trim().toLowerCase();
  return rows
    .map((row) => row.data as Customer & { branchId?: string | null })
    .filter(
      (customer) =>
        customer &&
        (seesAllBranches || !customer.branchId || customer.branchId === branchId),
    )
    .filter(
      (customer) =>
        !term ||
        customer.fullName?.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.cnic?.includes(term),
    )
    .slice(0, limit)
    .map((customer) => ({
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      cnic: customer.cnic ?? null,
    }));
}

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

async function getPendingEndSessionIds(): Promise<Set<string>> {
  let dbPendingItems: any[] = [];
  try {
    const allPending = await offlineDB.pendingQueue.toArray();
    dbPendingItems = allPending.filter((q) => q.entity?.toLowerCase() === "session");
  } catch {}

  return new Set([
    ...getSyncQueue()
      .filter(
        (q) =>
          (q.entityType?.toLowerCase() === "session" ||
            (q as any).entity?.toLowerCase() === "session") &&
          q.action?.toUpperCase() === "END",
      )
      .map((q) => q.entityId),
    ...dbPendingItems
      .filter(
        (q) =>
          (q.action?.toUpperCase() === "END" ||
            q.action?.toLowerCase() === "delete") &&
          (q.status === "pending" || q.status === "failed"),
      )
      .map((q) => q.entityId),
  ]);
}

export const sessionApi = {
  active: async (branchId?: string): Promise<ActiveSession[]> => {
    try {
      if (isAppOffline()) {
        throw new Error("Offline active");
      }
      const data = await request<ActiveSession[]>(
        `/sessions?status=active&limit=100${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`,
      );

      const pendingEndIds = await getPendingEndSessionIds();
      const filteredData = Array.isArray(data)
        ? data.filter((s) => !pendingEndIds.has(s.id) && s.status !== "ended")
        : [];

      // Reconcile active sessions in IndexedDB
      if (typeof window !== "undefined") {
        const effectiveBranchId = branchId || getActiveOfflineBranchId() || "default";

        // Query all cached items for this branch
        const existingBranchItems = await offlineDB.cachedTables
          .where("branchId")
          .equals(effectiveBranchId)
          .toArray();

        let dbPendingItems: any[] = [];
        try {
          const allPending = await offlineDB.pendingQueue.toArray();
          dbPendingItems = allPending.filter((q) => q.entity?.toLowerCase() === "session");
        } catch {}

        const serverActiveIds = new Set(filteredData.map((s) => s.id));
        const pendingStartIds = new Set([
          ...getSyncQueue()
            .filter((q) => (q.entityType?.toLowerCase() === "session" || (q as any).entity?.toLowerCase() === "session") && q.action?.toUpperCase() === "START")
            .map((q) => q.entityId),
          ...dbPendingItems
            .filter((q) => (q.action?.toUpperCase() === "START" || q.action?.toLowerCase() === "create") && (q.status === "pending" || q.status === "failed"))
            .map((q) => q.entityId),
        ]);

        // Obsolete sessions that are no longer active on the server and not pending start
        const obsoleteIds = existingBranchItems
          .filter(
            (item) =>
              item.data?.status === "ended" ||
              pendingEndIds.has(item.id) ||
              (item.data?.status === "active" &&
                !serverActiveIds.has(item.id) &&
                !pendingStartIds.has(item.id)),
          )
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
            item.data?.status !== "ended" &&
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

      const pendingEndIds = await getPendingEndSessionIds();

      return cached
        .map((c) => c.data as ActiveSession)
        .filter((session) => session && (session.status === "active" || !session.status) && (session.status as string) !== "ended" && !pendingEndIds.has(session.id));
    }
  },

  paused: async (branchId?: string): Promise<ActiveSession[]> => {
    try {
      if (isAppOffline()) {
        throw new Error("Offline paused");
      }
      const data = await request<ActiveSession[]>(
        `/sessions?status=paused&limit=100${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`,
      );

      const pendingEndIds = await getPendingEndSessionIds();
      const filteredData = Array.isArray(data)
        ? data.filter((s) => !pendingEndIds.has(s.id) && s.status !== "ended")
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

      const pendingEndIds = await getPendingEndSessionIds();

      return cached
        .map((item) => item.data as ActiveSession)
        .filter((session) => session && session.status === "paused" && (session.status as string) !== "ended" && !pendingEndIds.has(session.id));
    }
  },

  tables: async (branchId?: string): Promise<TableOption[]> => {
    try {
      if (isAppOffline()) {
        throw new Error("Offline active");
      }
      const tables = await request<TableOption[]>(
        `/sessions/available-tables${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`,
      );
      saveCachedTables(branchId || getActiveOfflineBranchId(), tables);
      return tables;
    } catch {
      if (typeof window === "undefined") return [];
      try {
        const effectiveBranchId = branchId || getActiveOfflineBranchId();
        const tablesList = readCachedTables(effectiveBranchId);
        const cachedSessions = effectiveBranchId
          ? await offlineDB.cachedTables
              .where("branchId")
              .equals(effectiveBranchId)
              .toArray()
          : await offlineDB.cachedTables.toArray();

        const pendingEndIds = await getPendingEndSessionIds();

        const occupiedTableIds = new Set(
          cachedSessions
            .map((item) => item.data as ActiveSession)
            .filter((session) => session && (session.status === "active" || session.status === "paused") && (session.status as string) !== "ended" && !pendingEndIds.has(session.id))
            .map((session) => session.table?.id)
            .filter(Boolean),
        );

        return tablesList.filter((table) => !occupiedTableIds.has(table.id));
      } catch {
        return [];
      }
    }
  },

  customers: async (query: string): Promise<Customer[]> => {
    // Offline: search cached customers.
    if (isAppOffline()) return searchCachedCustomers(query);
    return request<Customer[]>(`/customers?q=${encodeURIComponent(query)}&limit=10`);
  },

  start: async (body: {
    branchId?: string;
    tableId: string;
    customerId?: string | null;
  }): Promise<ActiveSession & { offlineQueued?: boolean }> => {
    const effectiveBranchId =
      body.branchId || getActiveOfflineBranchId() || "default";
    const branchCurrency = getCachedBranchCurrency(effectiveBranchId);
    const sessionId = crypto.randomUUID();
    // Same key for both offline queues.
    const idempotencyKey = crypto.randomUUID();
    const accessContext = tokenStorage.getAccessContext();
    const startedAt = new Date().toISOString();

    const matchedTable: TableOption | undefined = readCachedTables(
      effectiveBranchId,
    ).find((t) => t.id === body.tableId);

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
        currency: branchCurrency,
      },
      branch: {
        id: effectiveBranchId,
        name: "Current Branch",
        currency: branchCurrency,
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

    if (isAppOffline()) {
      // Block tables missing from this branch's cache (other branch or deleted).
      if (!matchedTable) {
        throw new Error(
          "This table is not available in the current branch. Reconnect once to refresh the table list.",
        );
      }

      await offlineDB.cachedTables.put({
        id: sessionId,
        branchId: effectiveBranchId,
        data: offlineSession,
        cachedAt: startedAt,
      });

      await queueSessionChange(sessionPayload, "START", idempotencyKey);

      addToSyncQueue({
        idempotencyKey,
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

      await queueSessionChange(sessionPayload, "START", idempotencyKey);

      addToSyncQueue({
        idempotencyKey,
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

    let existingSessionData: ActiveSession | undefined;
    try {
      const existingItem = await offlineDB.cachedTables.get(id);
      existingSessionData = existingItem?.data;
    } catch {}

    const updateOfflineDb = async () => {
      try {
        const actionAt = new Date(getServerNowMs()).toISOString();
        if (action === "end") {
          await offlineDB.cachedTables.delete(id);
        } else {
          const item = await offlineDB.cachedTables.get(id);
          if (item && item.data) {
            const currentPauses = Array.isArray(item.data.pauses)
              ? item.data.pauses
              : [];
            const pauses =
              action === "pause"
                ? [
                    ...currentPauses,
                    {
                      id: crypto.randomUUID(),
                      pausedAt: actionAt,
                      resumedAt: null,
                    },
                  ]
                : currentPauses.map((pause: { resumedAt: string | null }, index: number) =>
                    index === currentPauses.length - 1 && !pause.resumedAt
                      ? { ...pause, resumedAt: actionAt }
                      : pause,
                  );
            await offlineDB.cachedTables.put({
              ...item,
              data: {
                ...item.data,
                status: action === "pause" ? "paused" : "active",
                pausedAt: action === "pause" ? actionAt : null,
                pauses,
              },
            });
          }
        }
        cleanFloorViewLocalStorage(id, action);
      } catch {}
    };

    const synthesizeOfflineInvoice = async (sess?: ActiveSession) => {
      if (!sess) return;
      try {
        const invoiceId = crypto.randomUUID();
        const now = new Date();
        const startedAt = sess.startedAt ? new Date(sess.startedAt) : now;
        const pausedMs = (sess.pauses || []).reduce((sum, p) => {
          if (!p.pausedAt) return sum;
          const end = p.resumedAt ? new Date(p.resumedAt).getTime() : now.getTime();
          return sum + (end - new Date(p.pausedAt).getTime());
        }, 0);
        const rawDurationHours = Math.max(0.01, (now.getTime() - startedAt.getTime() - pausedMs) / (1000 * 60 * 60));
        const durationHours = Number(rawDurationHours.toFixed(2));
        const hourlyRate = Number(sess.appliedHourlyRate) || Number(sess.table?.defaultHourlyRate) || 700;
        const subtotal = Number((durationHours * hourlyRate).toFixed(2));
        const invoiceNumber = `INV-${now.getTime().toString().slice(-6)}`;

        let canteenSubtotal = 0;
        const canteenInvoiceItems: any[] = [];
        try {
          const canteenOrders = await offlineDB.cachedCanteenOrders
            .filter((o) => o.data?.sessionId === id || (o as any).sessionId === id)
            .toArray();
          for (const wrapper of canteenOrders) {
            const orderData = wrapper.data || wrapper;
            for (const it of (orderData.items || [])) {
              if (it.voided) continue;
              const unitPrice = Number(it.unitPrice || 0);
              const qty = Number(it.quantity || 1);
              const lineTotal = Number(it.lineTotal ?? (unitPrice * qty));
              canteenSubtotal += lineTotal;
              canteenInvoiceItems.push({
                id: crypto.randomUUID(),
                itemType: "canteen" as const,
                sourceSessionId: id,
                sourceOrderItemId: it.id || null,
                itemName: it.menuItem?.name || it.name || "Canteen Item",
                quantity: qty,
                unitPrice,
                lineTotal,
              });
            }
          }
        } catch (canteenErr) {
          console.warn("Could not load canteen items for session invoice:", canteenErr);
        }

        const grandSubtotal = Number((subtotal + canteenSubtotal).toFixed(2));

        const offlineInvoice = {
          id: invoiceId,
          invoiceNumber,
          branchId: sess.branch?.id || effectiveBranchId,
          branch: {
            id: sess.branch?.id || effectiveBranchId,
            name: sess.branch?.name || "Current branch",
            currency:
              sess.branch?.currency ||
              sess.table?.currency ||
              getCachedBranchCurrency(sess.branch?.id || effectiveBranchId),
          },
          sessionId: id,
          session: {
            id,
            startedAt: sess.startedAt,
            endedAt: now.toISOString(),
            table: {
              id: sess.table?.id || "",
              tableNumber: sess.table?.tableNumber || null,
            },
          },
          customerId: sess.customer?.id || null,
          customer: sess.customer
            ? {
                id: sess.customer.id,
                fullName: sess.customer.fullName || null,
                phone: sess.customer.phone || null,
              }
            : null,
          subtotal: grandSubtotal,
          discountAmount: 0,
          discountReasonCode: null,
          taxAmount: 0,
          serviceCharge: 0,
          total: grandSubtotal,
          paidAmount: 0,
          remainingAmount: grandSubtotal,
          status: "open" as const,
          voidReason: null,
          voidedAt: null,
          voidedById: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          receiptId: null,
          items: [
            {
              id: crypto.randomUUID(),
              itemType: "table_time",
              sourceSessionId: id,
              sourceOrderItemId: null,
              itemName: `Table ${sess.table?.tableNumber || ""} Time`,
              quantity: durationHours,
              unitPrice: hourlyRate,
              lineTotal: subtotal,
            },
            ...canteenInvoiceItems,
          ],
          payments: [],
        };

        await offlineDB.cachedInvoices.put({
          id: invoiceId,
          branchId: offlineInvoice.branchId,
          data: offlineInvoice,
          cachedAt: now.toISOString(),
        });

        await queueInvoiceChange({
          id: invoiceId,
          branchId: offlineInvoice.branchId,
          invoiceNumber,
          sessionId: id,
          customerId: offlineInvoice.customerId,
          subtotal: String(grandSubtotal),
          discountAmount: "0",
          discountReasonCode: null,
          discountApprovedById: null,
          taxAmount: "0",
          serviceCharge: "0",
          total: String(grandSubtotal),
          paidAmount: "0",
          status: "open",
          voidedInvoiceId: null,
          createdById: null,
          createdAt: now.toISOString(),
        }, "create");

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
          window.dispatchEvent(new CustomEvent("cuecloud:invoice-created", { detail: offlineInvoice }));
        }
      } catch (err) {
        console.warn("Could not synthesize offline invoice:", err);
      }
    };

    const queueAction = action === "pause" ? "PAUSE" : action === "resume" ? "RESUME" : "END";
    const queueOfflineAction = async () => {
      await updateOfflineDb();
      if (action === "end") {
        // The cache only held tables that were free when it was saved; bring this one back.
        if (existingSessionData?.table) addCachedTable(effectiveBranchId, existingSessionData.table);
        await synthesizeOfflineInvoice(existingSessionData);
      }
      const payload = {
        id,
        branchId: effectiveBranchId,
        tableId: existingSessionData?.table?.id,
        status: action === "pause" ? ("paused" as const) : action === "end" ? ("ended" as const) : ("active" as const),
        endedAt: action === "end" ? new Date().toISOString() : null,
      };

      const idempotencyKey = crypto.randomUUID();
      await queueSessionChange(payload, queueAction, idempotencyKey);

      return addToSyncQueue({
        idempotencyKey,
        entityType: "Session",
        entityId: id,
        action: queueAction,
        payload,
        originTimestamp: new Date().toISOString(),
      });
    };

    if (isAppOffline()) {
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
        const matchedTable: TableOption | undefined = readCachedTables(
          effectiveBranchId,
        ).find((t) => t.id === targetTableId);

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
      const before = await offlineDB.cachedTables.get(id);
      if (before?.data?.table) addCachedTable(effectiveBranchId, before.data.table);
      await updateOfflineDb();
      const payload = {
        id,
        branchId: effectiveBranchId,
        tableId: targetTableId,
        previousTableId,
      };

      const idempotencyKey = crypto.randomUUID();
      await queueSessionChange(payload, "SWITCH_TABLE", idempotencyKey);

      return addToSyncQueue({
        idempotencyKey,
        entityType: "Session",
        entityId: id,
        action: "SWITCH_TABLE",
        payload,
        originTimestamp: new Date().toISOString(),
      });
    };

    if (isAppOffline()) {
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
