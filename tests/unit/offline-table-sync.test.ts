import assert from "node:assert/strict";
import test from "node:test";
import { sessionApi } from "@/features/sessions/session-api";
import { invoiceService } from "@/features/invoice/services/invoiceService";
import { offlineDB } from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";
import type { FloorViewTable, FloorViewSession } from "@/app/floor-view/types";
import type { ActiveSession, TableOption } from "@/features/sessions/types";

const BRANCH_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_ID = "00000000-0000-4000-8000-000000000002";
const TABLE_1_ID = "11111111-1111-4000-8000-000000000001";
const TABLE_2_ID = "22222222-2222-4000-8000-000000000002";
const USER_ID = "99999999-9999-4000-8000-000000000001";
const DEVICE_ID = "88888888-8888-4000-8000-000000000001";

function jwt(data: object) {
  return `header.${Buffer.from(JSON.stringify(data)).toString("base64url")}.signature`;
}

function tenantToken() {
  return jwt({
    userId: USER_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    deviceId: DEVICE_ID,
    roles: ["OWNER"],
  });
}

const mockUser = {
  id: USER_ID,
  email: "owner@cuecloud.test",
  fullName: "Test Owner",
  roles: ["OWNER" as const],
  branchId: BRANCH_ID,
  tenantId: TENANT_ID,
  language: "en" as const,
  permissions: [],
};

const mockCatalogTables = [
  {
    id: TABLE_1_ID,
    tableNumber: "T-01",
    branchId: BRANCH_ID,
    hourlyRate: 50,
    status: "available",
  },
  {
    id: TABLE_2_ID,
    tableNumber: "T-02",
    branchId: BRANCH_ID,
    hourlyRate: 60,
    status: "available",
  },
];

async function withMockBrowser(run: () => Promise<void>) {
  const values = new Map<string, string>();
  // Pre-seed offline tables catalog in localStorage
  values.set("cuecloud_offline_tables", JSON.stringify(mockCatalogTables));

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalFetch = globalThis.fetch;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
        removeItem: (k: string) => values.delete(k),
      },
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });

  globalThis.fetch = async () => {
    throw new Error("Offline mode: real network fetch should not be called");
  };

  const pendingStore: any[] = [];
  const origAdd = offlineDB.pendingQueue.add;
  const origWhere = offlineDB.pendingQueue.where;
  const origToArray = offlineDB.pendingQueue.toArray;

  offlineDB.pendingQueue.add = (async (item: any) => {
    pendingStore.push(item);
    return pendingStore.length;
  }) as any;

  offlineDB.pendingQueue.where = ((index: string) => ({
    equals: (val: any) => ({
      toArray: async () => pendingStore.filter((i) => (i as any)[index] === val),
    }),
  })) as any;

  offlineDB.pendingQueue.toArray = (async () => [...pendingStore]) as any;

  try {
    await run();
  } finally {
    offlineDB.pendingQueue.add = origAdd;
    offlineDB.pendingQueue.where = origWhere;
    offlineDB.pendingQueue.toArray = origToArray;
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
}

test("offline table state synchronization", async (t) => {
  await t.test("sessionApi.tables() excludes tables with active offline sessions", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      // In-memory store for offlineDB.cachedTables
      const cachedStore = new Map<string, any>();

      t.mock.method(offlineDB.cachedTables, "toArray", async () =>
        Array.from(cachedStore.values()),
      );
      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedStore.values()),
        }),
      }));

      // Initially no active sessions: both tables available
      const availableInitial = await sessionApi.tables(BRANCH_ID);
      assert.equal(availableInitial.length, 2);
      assert.ok(availableInitial.some((t) => t.id === TABLE_1_ID));
      assert.ok(availableInitial.some((t) => t.id === TABLE_2_ID));

      // Now add an active session on TABLE_1
      cachedStore.set("session-1", {
        id: "session-1",
        branchId: BRANCH_ID,
        cachedAt: new Date().toISOString(),
        data: {
          id: "session-1",
          table: { id: TABLE_1_ID, tableNumber: "T-01" },
          status: "active",
        },
      });

      // After starting session: TABLE_1 is occupied, only TABLE_2 is returned
      const availableAfter = await sessionApi.tables(BRANCH_ID);
      assert.equal(availableAfter.length, 1);
      assert.equal(availableAfter[0].id, TABLE_2_ID);
      assert.equal(availableAfter[0].tableNumber, "T-02");
    });
  });

  await t.test("starting an offline session updates cachedTables and excludes table from available list", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedStore = new Map<string, any>();
      const customerStore = new Map<string, any>();
      customerStore.set("cust-1", {
        id: "cust-1",
        data: { id: "cust-1", fullName: "Alice", phone: "1234567890", cnic: null },
      });

      t.mock.method(offlineDB.cachedCustomers, "get", async (id: string) => customerStore.get(id));
      t.mock.method(offlineDB.cachedTables, "put", async (val: any) => {
        cachedStore.set(val.id, val);
        return val.id;
      });
      t.mock.method(offlineDB.cachedTables, "get", async (id: string) => cachedStore.get(id));
      t.mock.method(offlineDB.cachedTables, "toArray", async () =>
        Array.from(cachedStore.values()),
      );
      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedStore.values()),
        }),
      }));

      // Start offline session on TABLE_1
      const session = await sessionApi.start({
        tableId: TABLE_1_ID,
        customerId: "cust-1",
      });

      assert.ok(session.id);
      assert.equal(session.table.id, TABLE_1_ID);
      assert.equal(session.table.tableNumber, "T-01");
      assert.equal(session.status, "active");
      assert.equal(session.customer?.fullName, "Alice");
      assert.equal(session.offlineQueued, true);

      // Verify cachedTables received the active session
      assert.ok(cachedStore.has(session.id));
      assert.equal(cachedStore.get(session.id).data.status, "active");

      // Verify TABLE_1 is no longer in available tables list
      const available = await sessionApi.tables(BRANCH_ID);
      assert.equal(available.length, 1);
      assert.equal(available[0].id, TABLE_2_ID);
    });
  });

  await t.test("ending an offline session removes it from cachedTables and restores table availability", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedStore = new Map<string, any>();
      const existingSessionId = "offline_session_active_1";
      cachedStore.set(existingSessionId, {
        id: existingSessionId,
        branchId: BRANCH_ID,
        cachedAt: new Date().toISOString(),
        data: {
          id: existingSessionId,
          table: { id: TABLE_1_ID, tableNumber: "T-01" },
          status: "active",
        },
      });

      t.mock.method(offlineDB.cachedTables, "delete", async (id: string) => {
        cachedStore.delete(id);
      });
      t.mock.method(offlineDB.cachedTables, "get", async (id: string) => cachedStore.get(id));
      t.mock.method(offlineDB.cachedTables, "put", async (val: any) => {
        cachedStore.set(val.id, val);
        return val.id;
      });
      t.mock.method(offlineDB.cachedTables, "toArray", async () =>
        Array.from(cachedStore.values()),
      );
      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedStore.values()),
        }),
      }));

      // TABLE_1 is occupied initially
      const availableBefore = await sessionApi.tables(BRANCH_ID);
      assert.equal(availableBefore.length, 1);
      assert.equal(availableBefore[0].id, TABLE_2_ID);

      // End session offline
      await sessionApi.action(existingSessionId, "end");

      // Verify cachedTables no longer has the active session
      assert.equal(cachedStore.has(existingSessionId), false);

      // Both tables are now available again
      const availableAfter = await sessionApi.tables(BRANCH_ID);
      assert.equal(availableAfter.length, 2);
      assert.ok(availableAfter.some((t) => t.id === TABLE_1_ID));
      assert.ok(availableAfter.some((t) => t.id === TABLE_2_ID));
    });
  });

  await t.test("FloorView optimistic updates correctly transition table to occupied and available", () => {
    const initialTables: FloorViewTable[] = [
      {
        tableId: TABLE_1_ID,
        tableNumber: "T-01",
        status: "available",
        currency: "USD",
        session: null,
      },
      {
        tableId: TABLE_2_ID,
        tableNumber: "T-02",
        status: "available",
        currency: "USD",
        session: null,
      },
    ];

    const activeSession: ActiveSession = {
      id: "offline_session_100",
      table: { id: TABLE_1_ID, tableNumber: "T-01", defaultHourlyRate: 50 },
      customer: { id: "c1", fullName: "Bob", phone: "1234567890", cnic: null },
      startedAt: new Date().toISOString(),
      endedAt: null,
      pauses: [],
      branch: { id: BRANCH_ID, name: "Main", currency: "USD" },
      status: "active",
      appliedHourlyRate: 25,
    };

    // Simulate startSessionOptimistically transformation
    const occupiedTables = initialTables.map((t) => {
      if (t.tableId !== activeSession.table.id) return t;
      const sessionData: FloorViewSession = {
        sessionId: activeSession.id,
        customerName: activeSession.customer?.fullName || "Walk-in",
        startedAt: activeSession.startedAt,
        expectedEndTime: null,
        appliedHourlyRate: Number(activeSession.appliedHourlyRate) || 0,
        durationSeconds: 0,
        pauseDurationSeconds: 0,
        billableDurationSeconds: 0,
        estimatedCharge: null,
        billingState: "accruing",
        isPaused: false,
        isOvertime: false,
      };
      return {
        ...t,
        status: "occupied" as const,
        session: sessionData,
      };
    });

    assert.equal(occupiedTables[0].status, "occupied");
    assert.equal(occupiedTables[0].session?.customerName, "Bob");
    assert.equal(occupiedTables[0].session?.sessionId, "offline_session_100");
    assert.equal(occupiedTables[1].status, "available");

    // Simulate updateSessionOptimistically with 'ended'
    const endedTables = occupiedTables.map((t) => {
      if (t.session?.sessionId !== "offline_session_100") return t;
      return { ...t, status: "available" as const, session: null };
    });

    assert.equal(endedTables[0].status, "available");
    assert.equal(endedTables[0].session, null);
    assert.equal(endedTables[1].status, "available");
  });

  await t.test("offline switchTable updates cachedTables and enqueues SWITCH_TABLE mutation", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedStore = new Map<string, any>();
      const existingSessionId = "offline_session_switch_1";
      cachedStore.set(existingSessionId, {
        id: existingSessionId,
        branchId: BRANCH_ID,
        cachedAt: new Date().toISOString(),
        data: {
          id: existingSessionId,
          table: { id: TABLE_1_ID, tableNumber: "T-01", defaultHourlyRate: 50, currency: "PKR" },
          status: "active",
        },
      });

      t.mock.method(offlineDB.cachedTables, "get", async (id: string) => cachedStore.get(id));
      t.mock.method(offlineDB.cachedTables, "put", async (val: any) => {
        cachedStore.set(val.id, val);
        return val.id;
      });

      // Switch table from TABLE_1 to TABLE_2
      const result = await sessionApi.switchTable(
        existingSessionId,
        TABLE_2_ID,
        TABLE_1_ID,
        BRANCH_ID,
      );

      assert.equal(result.offlineQueued, true);
      const updated = cachedStore.get(existingSessionId);
      assert.equal(updated.data.table.id, TABLE_2_ID);
      assert.equal(updated.data.table.tableNumber, "T-02");
    });
  });

  await t.test("switch table view excludes all other occupied tables from available choices", () => {
    const allTables: TableOption[] = [
      { id: TABLE_1_ID, tableNumber: "T-01", defaultHourlyRate: 50 },
      { id: TABLE_2_ID, tableNumber: "T-02", defaultHourlyRate: 60 },
      { id: "33333333-3333-4000-8000-000000000003", tableNumber: "T-03", defaultHourlyRate: 70 },
    ];

    const currentSession: ActiveSession = {
      id: "session-1",
      table: { id: TABLE_1_ID, tableNumber: "T-01", defaultHourlyRate: 50 },
      customer: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      pauses: [],
      branch: { id: BRANCH_ID, name: "Main", currency: "USD" },
      status: "active",
      appliedHourlyRate: 50,
    };

    const otherOccupiedSession: ActiveSession = {
      id: "session-2",
      table: { id: TABLE_2_ID, tableNumber: "T-02", defaultHourlyRate: 60 },
      customer: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      pauses: [],
      branch: { id: BRANCH_ID, name: "Main", currency: "USD" },
      status: "active",
      appliedHourlyRate: 60,
    };

    const activeSessionsList = [currentSession, otherOccupiedSession];

    // Filter occupied tables (same logic as sessions/page.tsx)
    const occupiedTableIds = new Set(
      activeSessionsList
        .filter(
          (s) =>
            s.id !== currentSession.id &&
            (s.status === "active" || s.status === "paused") &&
            s.table?.id,
        )
        .map((s) => s.table.id),
    );

    const switchableTables = allTables.filter(
      (table) =>
        table.id !== currentSession.table?.id && !occupiedTableIds.has(table.id),
    );

    // TABLE_1 is current session's table (excluded)
    // TABLE_2 is occupied by session-2 (excluded)
    // Only TABLE_3 is available to switch to
    assert.equal(switchableTables.length, 1);
    assert.equal(switchableTables[0].id, "33333333-3333-4000-8000-000000000003");
    assert.equal(switchableTables[0].tableNumber, "T-03");
  });

  await t.test("reconciling active sessions when online prunes obsolete sessions from cachedTables", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedStore = new Map<string, any>();
      // Pre-populate cachedStore with an old session from days ago
      cachedStore.set("old-session-from-days-ago", {
        id: "old-session-from-days-ago",
        branchId: BRANCH_ID,
        cachedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        data: {
          id: "old-session-from-days-ago",
          status: "active",
          table: { id: TABLE_1_ID, tableNumber: "T-01" },
        },
      });

      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedStore.values()),
        }),
      }));
      t.mock.method(offlineDB.cachedTables, "bulkDelete", async (ids: string[]) => {
        for (const id of ids) cachedStore.delete(id);
      });
      t.mock.method(offlineDB.cachedTables, "bulkPut", async (items: any[]) => {
        for (const item of items) cachedStore.set(item.id, item);
      });
      t.mock.method(offlineDB.cachedTables, "toArray", async () => Array.from(cachedStore.values()));

      // Mock navigator.onLine = false to test offline view before sync
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const offlineSessionsBefore = await sessionApi.active(BRANCH_ID);
      assert.equal(offlineSessionsBefore.length, 1);
      assert.equal(offlineSessionsBefore[0].id, "old-session-from-days-ago");

      // Now go online: Server returns only 1 brand new session, NOT the old one
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      const liveSessions = [
        {
          id: "fresh-live-session",
          status: "active" as const,
          table: { id: TABLE_2_ID, tableNumber: "T-02" },
          customer: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
          branch: { id: BRANCH_ID, name: "Main", currency: "PKR" },
          pauses: [],
        },
      ];

      // Mock fetch returning liveSessions inside standard backend envelope
      (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: liveSessions, error: null }),
      });

      const onlineResult = await sessionApi.active(BRANCH_ID);
      assert.equal(onlineResult.length, 1);
      assert.equal(onlineResult[0].id, "fresh-live-session");

      // Verify old session was purged from cachedStore!
      assert.equal(cachedStore.has("old-session-from-days-ago"), false);
      assert.equal(cachedStore.has("fresh-live-session"), true);

      // Now switch back offline: Only fresh-live-session is returned, old session is gone
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const offlineSessionsAfter = await sessionApi.active(BRANCH_ID);
      assert.equal(offlineSessionsAfter.length, 1);
      assert.equal(offlineSessionsAfter[0].id, "fresh-live-session");
    });
  });

  await t.test("ending a session offline excludes it immediately and prevents resurrection", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedStore = new Map<string, any>();
      const currentActiveId = "session-to-end";
      cachedStore.set(currentActiveId, {
        id: currentActiveId,
        branchId: BRANCH_ID,
        cachedAt: new Date().toISOString(),
        data: {
          id: currentActiveId,
          status: "active",
          table: { id: TABLE_1_ID, tableNumber: "T-01" },
        },
      });

      t.mock.method(offlineDB.cachedTables, "delete", async (id: string) => {
        cachedStore.delete(id);
      });
      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedStore.values()),
        }),
      }));
      t.mock.method(offlineDB.cachedTables, "toArray", async () => Array.from(cachedStore.values()));
      t.mock.method(offlineDB.cachedTables, "bulkDelete", async (ids: string[]) => {
        for (const id of ids) cachedStore.delete(id);
      });
      t.mock.method(offlineDB.cachedTables, "bulkPut", async () => {});

      // Offline: End the session
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const endResult = await sessionApi.action(currentActiveId, "end");
      assert.equal(endResult.offlineQueued, true);

      // Verify offline active sessions immediately excludes it
      const offlineActive = await sessionApi.active(BRANCH_ID);
      assert.equal(offlineActive.length, 0);

      // Switch back online: Even if backend still has not pushed (server returns stale active list)
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: currentActiveId,
            status: "active",
            table: { id: TABLE_1_ID, tableNumber: "T-01" },
          },
        ],
      });

      const onlineActiveWithQueue = await sessionApi.active(BRANCH_ID);
      // Because END is pending in sync queue, it is filtered out!
      assert.equal(onlineActiveWithQueue.length, 0);

      // Switch back offline: Still 0, not resurrected
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const offlineActiveAgain = await sessionApi.active(BRANCH_ID);
      assert.equal(offlineActiveAgain.length, 0);
    });
  });

  await t.test("walk-in session created while offline appears in active list when online and has valid payload in queue", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedStore = new Map<string, any>();
      t.mock.method(offlineDB.cachedTables, "put", async (item: any) => {
        cachedStore.set(item.id, item);
      });
      t.mock.method(offlineDB.cachedTables, "get", async (id: string) => cachedStore.get(id));
      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedStore.values()),
        }),
      }));
      t.mock.method(offlineDB.cachedTables, "toArray", async () => Array.from(cachedStore.values()));
      t.mock.method(offlineDB.cachedTables, "bulkDelete", async () => {});
      t.mock.method(offlineDB.cachedTables, "bulkPut", async () => {});

      // 1. Create walk-in session while offline
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const started = await sessionApi.start({
        tableId: TABLE_1_ID,
        customerId: null,
      });

      assert.equal(started.status, "active");
      assert.equal(started.table.id, TABLE_1_ID);
      assert.equal(started.appliedHourlyRate, "50");

      // Verify sync queue has appliedHourlyRate and customerId null
      const queueRaw = window.localStorage.getItem("cuecloud_sync_outbox");
      assert.ok(queueRaw);
      const queue = JSON.parse(queueRaw);
      assert.equal(queue.length, 1);
      assert.equal(queue[0].action, "START");
      assert.equal(queue[0].payload.appliedHourlyRate, "50");
      assert.equal(queue[0].payload.customerId, null);

      // 2. Switch online: server initially has 0 sessions before sync push
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => [],
      });

      // 3. active() should merge the pending offline walk-in session so it appears!
      const onlineActive = await sessionApi.active(BRANCH_ID);
      assert.equal(onlineActive.length, 1);
      assert.equal(onlineActive[0].id, started.id);
      assert.equal(onlineActive[0].appliedHourlyRate, "50");
    });
  });

  await t.test("ending a session offline synthesizes cached invoice and persists ended state across queries", async () => {
    await withMockBrowser(async () => {
      tokenStorage.replaceSession(
        { accessToken: tenantToken() },
        mockUser,
      );

      const cachedTableStore = new Map<string, any>();
      const cachedInvoiceStore = new Map<string, any>();
      const sessionId = "offline_session_end_test_1";

      const sessionObj: ActiveSession = {
        id: sessionId,
        status: "active",
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        endedAt: null,
        appliedHourlyRate: "600.00",
        customer: { id: "cust-1", fullName: "Jane Doe", phone: "03001234567", cnic: null },
        table: { id: TABLE_1_ID, tableNumber: "T-01", defaultHourlyRate: "600.00", currency: "PKR" },
        branch: { id: BRANCH_ID, name: "Main Branch", currency: "PKR" },
        pauses: [],
      };

      cachedTableStore.set(sessionId, {
        id: sessionId,
        branchId: BRANCH_ID,
        cachedAt: sessionObj.startedAt,
        data: sessionObj,
      });

      t.mock.method(offlineDB.cachedTables, "get", async (id: string) => cachedTableStore.get(id));
      t.mock.method(offlineDB.cachedTables, "delete", async (id: string) => {
        cachedTableStore.delete(id);
      });
      t.mock.method(offlineDB.cachedTables, "toArray", async () => Array.from(cachedTableStore.values()));
      t.mock.method(offlineDB.cachedTables, "where", () => ({
        equals: () => ({
          toArray: async () => Array.from(cachedTableStore.values()),
        }),
      }));

      t.mock.method(offlineDB.cachedInvoices, "put", async (inv: any) => {
        cachedInvoiceStore.set(inv.id, inv);
        return inv.id;
      });
      t.mock.method(offlineDB.cachedInvoices, "get", async (id: string) => cachedInvoiceStore.get(id));
      t.mock.method(offlineDB.cachedInvoices, "toArray", async () => Array.from(cachedInvoiceStore.values()));

      // 1. App is offline
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      // Active session should be visible before ending
      const activeBefore = await sessionApi.active(BRANCH_ID);
      assert.equal(activeBefore.length, 1);
      assert.equal(activeBefore[0].id, sessionId);

      // 2. End session offline
      const endResult = await sessionApi.action(sessionId, "end");
      assert.equal(endResult.offlineQueued, true);

      // 3. Verify invoice was synthesized into cachedInvoices
      assert.equal(cachedInvoiceStore.size, 1);
      const synthesizedInvoice = Array.from(cachedInvoiceStore.values())[0].data;
      assert.equal(synthesizedInvoice.sessionId, sessionId);
      assert.equal(synthesizedInvoice.customer?.fullName, "Jane Doe");
      assert.equal(synthesizedInvoice.status, "open");
      assert.ok(synthesizedInvoice.total > 0);
      assert.equal(synthesizedInvoice.remainingAmount, synthesizedInvoice.total);

      // 4. Verify invoiceService.getInvoices returns the invoice offline
      const invoicesResult = await invoiceService.getInvoices();
      assert.equal(invoicesResult.items.length, 1);
      assert.equal(invoicesResult.items[0].sessionId, sessionId);

      // 5. Navigate away and come back: active sessions query should NOT resurrect the ended session
      const activeAfter = await sessionApi.active(BRANCH_ID);
      assert.equal(activeAfter.length, 0);

      const pausedAfter = await sessionApi.paused(BRANCH_ID);
      assert.equal(pausedAfter.length, 0);

      // 6. Available tables should now have TABLE_1 available again
      const availableTables = await sessionApi.tables(BRANCH_ID);
      assert.ok(availableTables.some((t) => t.id === TABLE_1_ID));
    });
  });
});
