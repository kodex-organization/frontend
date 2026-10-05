import assert from "node:assert/strict";
import test from "node:test";
import { CanteenApi } from "@/features/canteen/canteen.api";
import { sessionApi } from "@/features/sessions/session-api";
import { offlineDB } from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";

const BRANCH_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_ID = "00000000-0000-4000-8000-000000000002";
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

async function withMockOfflineBrowser(run: () => Promise<void>) {
  const values = new Map<string, string>();
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
        clear: () => values.clear(),
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
    throw new Error("Offline mode: network unavailable");
  };

  const pendingStore: any[] = [];
  const cachedOrdersStore: any[] = [];
  const cachedInvoicesStore: any[] = [];
  const cachedTablesStore: any[] = [];
  const cachedCategoriesStore: any[] = [];
  const cachedMenuItemsStore: any[] = [];

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

  const origOrdersPut = offlineDB.cachedCanteenOrders.put;
  const origOrdersFilter = offlineDB.cachedCanteenOrders.filter;
  offlineDB.cachedCanteenOrders.put = (async (item: any) => {
    const idx = cachedOrdersStore.findIndex((o) => o.id === item.id);
    if (idx >= 0) cachedOrdersStore[idx] = item;
    else cachedOrdersStore.push(item);
    return item.id;
  }) as any;
  offlineDB.cachedCanteenOrders.filter = ((predicate: (val: any) => boolean) => ({
    toArray: async () => cachedOrdersStore.filter(predicate),
  })) as any;

  const origInvoicesPut = offlineDB.cachedInvoices.put;
  const origInvoicesToArray = offlineDB.cachedInvoices.toArray;
  offlineDB.cachedInvoices.put = (async (item: any) => {
    const idx = cachedInvoicesStore.findIndex((i) => i.id === item.id);
    if (idx >= 0) cachedInvoicesStore[idx] = item;
    else cachedInvoicesStore.push(item);
    return item.id;
  }) as any;
  offlineDB.cachedInvoices.toArray = (async () => [...cachedInvoicesStore]) as any;

  const origTablesPut = offlineDB.cachedTables.put;
  const origTablesGet = offlineDB.cachedTables.get;
  const origTablesDelete = offlineDB.cachedTables.delete;
  offlineDB.cachedTables.put = (async (item: any) => {
    const idx = cachedTablesStore.findIndex((t) => t.id === item.id);
    if (idx >= 0) cachedTablesStore[idx] = item;
    else cachedTablesStore.push(item);
    return item.id;
  }) as any;
  offlineDB.cachedTables.get = (async (id: string) => {
    return cachedTablesStore.find((t) => t.id === id);
  }) as any;
  offlineDB.cachedTables.delete = (async (id: string) => {
    const idx = cachedTablesStore.findIndex((t) => t.id === id);
    if (idx >= 0) cachedTablesStore.splice(idx, 1);
  }) as any;

  const origCatFilter = offlineDB.cachedCanteenCategories.filter;
  const origCatBulkPut = offlineDB.cachedCanteenCategories.bulkPut;
  offlineDB.cachedCanteenCategories.filter = ((predicate: (val: any) => boolean) => ({
    toArray: async () => cachedCategoriesStore.filter(predicate),
  })) as any;
  offlineDB.cachedCanteenCategories.bulkPut = (async (items: any[]) => {
    for (const item of items) {
      const idx = cachedCategoriesStore.findIndex((c) => c.id === item.id);
      if (idx >= 0) cachedCategoriesStore[idx] = item;
      else cachedCategoriesStore.push(item);
    }
  }) as any;

  const origItemFilter = offlineDB.cachedCanteenMenuItems.filter;
  const origItemBulkPut = offlineDB.cachedCanteenMenuItems.bulkPut;
  offlineDB.cachedCanteenMenuItems.filter = ((predicate: (val: any) => boolean) => ({
    toArray: async () => cachedMenuItemsStore.filter(predicate),
  })) as any;
  offlineDB.cachedCanteenMenuItems.bulkPut = (async (items: any[]) => {
    for (const item of items) {
      const idx = cachedMenuItemsStore.findIndex((i) => i.id === item.id);
      if (idx >= 0) cachedMenuItemsStore[idx] = item;
      else cachedMenuItemsStore.push(item);
    }
  }) as any;

  tokenStorage.replaceSession(
    { accessToken: tenantToken() },
    mockUser
  );

  try {
    await run();
  } finally {
    tokenStorage.clear();
    offlineDB.pendingQueue.add = origAdd;
    offlineDB.pendingQueue.where = origWhere;
    offlineDB.pendingQueue.toArray = origToArray;
    offlineDB.cachedCanteenOrders.put = origOrdersPut;
    offlineDB.cachedCanteenOrders.filter = origOrdersFilter;
    offlineDB.cachedInvoices.put = origInvoicesPut;
    offlineDB.cachedInvoices.toArray = origInvoicesToArray;
    offlineDB.cachedTables.put = origTablesPut;
    offlineDB.cachedTables.get = origTablesGet;
    offlineDB.cachedTables.delete = origTablesDelete;
    offlineDB.cachedCanteenCategories.filter = origCatFilter;
    offlineDB.cachedCanteenCategories.bulkPut = origCatBulkPut;
    offlineDB.cachedCanteenMenuItems.filter = origItemFilter;
    offlineDB.cachedCanteenMenuItems.bulkPut = origItemBulkPut;
    globalThis.fetch = originalFetch;

    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
}

test("Canteen POS Offline Support", async (t) => {
  await t.test("Menu data (categories and items) loads successfully in offline mode", async () => {
    await withMockOfflineBrowser(async () => {
      const categories = await CanteenApi.getCategories();
      assert.ok(Array.isArray(categories), "Categories must be an array");
      assert.ok(categories.length > 0, "Must have fallback/cached categories");
      assert.ok(categories.some((c) => c.name.toLowerCase().includes("beverage")), "Has beverage category");

      const items = await CanteenApi.getMenuItems();
      assert.ok(Array.isArray(items), "Menu items must be an array");
      assert.ok(items.length > 0, "Must have fallback/cached menu items");
      assert.ok(items.some((i) => i.name.toLowerCase().includes("tea") || i.name.toLowerCase().includes("chai")), "Has chai/tea");
    });
  });

  await t.test("Placing an offline order for a table session persists in cache and queues sync action", async () => {
    await withMockOfflineBrowser(async () => {
      const sessionId = crypto.randomUUID();
      const items = await CanteenApi.getMenuItems();
      const targetItem = items[0];

      const order = await CanteenApi.addItemsToSession(sessionId, [
        {
          menuItemId: targetItem.id,
          quantity: 2,
          notes: "Extra hot",
        },
      ]);

      assert.ok(order, "Order should be returned");
      assert.equal(order.sessionId, sessionId);
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 2);
      assert.equal(order.items[0].unitPrice, targetItem.currentPrice);
      assert.equal(order.items[0].lineTotal, targetItem.currentPrice * 2);

      // Check offline order was queued
      const pendingItems = await offlineDB.pendingQueue.toArray();
      const queuedCanteenOrder = pendingItems.find(
        (p) => p.entity === "canteen_order" && p.action === "ADD_ITEMS_TO_SESSION"
      );
      assert.ok(queuedCanteenOrder, "Must find queued canteen order in pendingQueue");
      assert.equal((queuedCanteenOrder.payload as any).sessionId, sessionId);

      // Check session orders retrieval
      const sessionOrders = await CanteenApi.getSessionOrders(sessionId);
      assert.ok(sessionOrders.length >= 1, "Must retrieve session orders from offline cache");
      assert.equal(sessionOrders[0].sessionId, sessionId);
    });
  });

  await t.test("Creating a standalone walk-in order offline queues sync and synthesizes walk-in invoice", async () => {
    await withMockOfflineBrowser(async () => {
      const items = await CanteenApi.getMenuItems();
      const targetItem = items[1] || items[0];

      const order = await CanteenApi.createStandaloneOrder([
        {
          menuItemId: targetItem.id,
          quantity: 3,
        },
      ]);

      assert.ok(order, "Standalone order should be created");
      assert.equal(order.status, "served");
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 3);

      // Check queued in pendingQueue
      const pendingItems = await offlineDB.pendingQueue.toArray();
      const queuedCanteenOrder = pendingItems.find(
        (p) => p.entity === "canteen_order" && p.action === "CREATE_STANDALONE"
      );
      assert.ok(queuedCanteenOrder, "Must find queued standalone order in pendingQueue");

      // Check cached invoice was created for this direct sale
      const cachedInvoices = await offlineDB.cachedInvoices.toArray();
      const walkInInvoice = cachedInvoices.find(
        (inv) => inv.data?.invoiceNumber?.startsWith("CANT-")
      );
      assert.ok(walkInInvoice, "Must find generated walk-in invoice in cachedInvoices");
      assert.equal(walkInInvoice.data.total, targetItem.currentPrice * 3);
    });
  });

  await t.test("Ending a session with offline canteen orders incorporates canteen items into synthesized invoice", async () => {
    await withMockOfflineBrowser(async () => {
      const sessionId = crypto.randomUUID();
      const tableId = crypto.randomUUID();

      // Seed an active table session into cachedTables
      await offlineDB.cachedTables.put({
        id: sessionId,
        branchId: BRANCH_ID,
        data: {
          id: sessionId,
          branchId: BRANCH_ID,
          status: "active",
          table: {
            id: tableId,
            tableNumber: "T-05",
            defaultHourlyRate: 500,
          },
          startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
        cachedAt: new Date().toISOString(),
      });

      // Add canteen items to this session
      const items = await CanteenApi.getMenuItems();
      const itemA = items[0];
      await CanteenApi.addItemsToSession(sessionId, [
        { menuItemId: itemA.id, quantity: 2 },
      ]);

      // End the session offline
      await sessionApi.action(sessionId, "end");

      // Verify the synthesized invoice in cachedInvoices contains BOTH table time and canteen items
      const cachedInvoices = await offlineDB.cachedInvoices.toArray();
      const sessionInvoice = cachedInvoices.find((inv) => inv.data?.sessionId === sessionId);
      assert.ok(sessionInvoice, "Session invoice must exist in cachedInvoices");

      const invoiceData = sessionInvoice.data;
      const canteenLineItems = invoiceData.items.filter((it: any) => it.itemType === "canteen");
      assert.ok(canteenLineItems.length >= 1, "Invoice must contain canteen line items");
      assert.equal(canteenLineItems[0].quantity, 2);
      assert.equal(canteenLineItems[0].unitPrice, itemA.currentPrice);

      const tableTimeItems = invoiceData.items.filter((it: any) => it.itemType === "table_time");
      assert.ok(tableTimeItems.length >= 1, "Invoice must contain table time item");

      // Total must equal table time subtotal + canteen subtotal
      const expectedCanteenSubtotal = itemA.currentPrice * 2;
      const expectedTotal = tableTimeItems[0].lineTotal + expectedCanteenSubtotal;
      assert.equal(invoiceData.total, expectedTotal, "Invoice total must include table time + canteen items");
    });
  });
});
