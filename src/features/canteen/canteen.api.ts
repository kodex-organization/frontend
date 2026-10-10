import { apiFetch } from "@/lib/api/client";
import { isAppOffline } from "@/lib/connectivity/online-status";
import {
  offlineDB,
  getActiveOfflineBranchId,
  queueCanteenOrderChange,
  queueCanteenCategoryChange,
  queueCanteenItemChange,
} from "@/lib/sync/offline-db";

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId?: string;
  name: string;
  description?: string;
  barcode?: string;
  currentPrice: number;
  isActive: boolean;
  isAvailable: boolean;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  menuItem?: MenuItem;
  kotPrinted: boolean;
  discountAmount: number;
  discountPercent: number;
  voided?: boolean;
  voidedReason?: string;
  voidedById?: string;
}

export interface Order {
  id: string;
  sessionId?: string;
  status: string;
  items: OrderItem[];
  createdAt?: string;
  invoiceId?: string;
  invoiceNumber?: string;
}

export interface PaymentTender {
  method: string;
  amount: number;
  reference?: string;
}

export interface StandaloneOrderItemInput {
  menuItemId: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

export interface StandaloneOrderPayload {
  items: StandaloneOrderItemInput[];
  payments?: PaymentTender[];
  totalAmount?: number;
  amountTendered?: number;
  changeDue?: number;
  customerId?: string | null;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-beverages", name: "Beverages", isActive: true },
  { id: "cat-snacks", name: "Snacks", isActive: true },
  { id: "cat-meals", name: "Fast Food", isActive: true },
  { id: "cat-retail", name: "Retail & Others", isActive: true },
];

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: "item-tea",
    categoryId: "cat-beverages",
    name: "Special Chai / Tea",
    currentPrice: 50,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-coffee",
    categoryId: "cat-beverages",
    name: "Cold / Hot Coffee",
    currentPrice: 120,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-water",
    categoryId: "cat-beverages",
    name: "Mineral Water (500ml)",
    currentPrice: 60,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-soda",
    categoryId: "cat-beverages",
    name: "Soft Drink Can",
    currentPrice: 90,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-chips",
    categoryId: "cat-snacks",
    name: "Lays / Chips",
    currentPrice: 70,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-biscuit",
    categoryId: "cat-snacks",
    name: "Biscuits & Cookies",
    currentPrice: 40,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-sandwich",
    categoryId: "cat-meals",
    name: "Club Sandwich",
    currentPrice: 220,
    isActive: true,
    isAvailable: true,
  },
  {
    id: "item-fries",
    categoryId: "cat-meals",
    name: "French Fries (Crispy)",
    currentPrice: 150,
    isActive: true,
    isAvailable: true,
  },
];

function getLocalCategories(): Category[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem("cuecloud_cached_canteen_categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CATEGORIES;
}

function setLocalCategories(cats: Category[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "cuecloud_cached_canteen_categories",
      JSON.stringify(cats)
    );
  } catch {}
}

function getLocalMenuItems(): MenuItem[] {
  if (typeof window === "undefined") return DEFAULT_MENU_ITEMS;
  try {
    const raw = localStorage.getItem("cuecloud_cached_canteen_menu_items");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_MENU_ITEMS;
}

function setLocalMenuItems(items: MenuItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "cuecloud_cached_canteen_menu_items",
      JSON.stringify(items)
    );
  } catch {}
}

function getLocalOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("cuecloud_cached_canteen_orders");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function setLocalOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "cuecloud_cached_canteen_orders",
      JSON.stringify(orders)
    );
  } catch {}
}

async function getStoredCategories(): Promise<Category[]> {
  const branchId = getActiveOfflineBranchId() || "default";
  try {
    const rows = await offlineDB.cachedCanteenCategories
      .filter((c) => !c.branchId || c.branchId === branchId)
      .toArray();
    if (rows.length > 0) {
      return rows.map((r) => r.data || r);
    }
  } catch (err) {
    console.warn("Could not read cached categories from offlineDB:", err);
  }
  return getLocalCategories();
}

async function persistCategories(categories: Category[]) {
  const branchId = getActiveOfflineBranchId() || "default";
  setLocalCategories(categories);
  try {
    await offlineDB.cachedCanteenCategories.bulkPut(
      categories.map((c) => ({
        id: c.id,
        branchId,
        data: c,
        cachedAt: new Date().toISOString(),
      }))
    );
  } catch (err) {
    console.warn("Could not cache categories to offlineDB:", err);
  }
}

async function getStoredMenuItems(
  categoryId?: string,
  onlyAvailable?: boolean
): Promise<MenuItem[]> {
  const branchId = getActiveOfflineBranchId() || "default";
  let items: MenuItem[] = [];
  try {
    const rows = await offlineDB.cachedCanteenMenuItems
      .filter((i) => !i.branchId || i.branchId === branchId)
      .toArray();
    if (rows.length > 0) {
      items = rows.map((r) => r.data || r);
    }
  } catch (err) {
    console.warn("Could not read cached menu items from offlineDB:", err);
  }

  if (items.length === 0) {
    items = getLocalMenuItems();
  }

  if (categoryId) {
    items = items.filter((i) => i.categoryId === categoryId);
  }
  if (onlyAvailable) {
    items = items.filter((i) => i.isActive && i.isAvailable);
  }
  return items;
}

async function persistMenuItems(items: MenuItem[]) {
  const branchId = getActiveOfflineBranchId() || "default";
  setLocalMenuItems(items);
  try {
    await offlineDB.cachedCanteenMenuItems.bulkPut(
      items.map((i) => ({
        id: i.id,
        branchId,
        categoryId: i.categoryId,
        data: i,
        cachedAt: new Date().toISOString(),
      }))
    );
  } catch (err) {
    console.warn("Could not cache menu items to offlineDB:", err);
  }
}

async function getStoredOrders(sessionId?: string): Promise<Order[]> {
  const branchId = getActiveOfflineBranchId() || "default";
  let orders: Order[] = [];
  try {
    const rows = await offlineDB.cachedCanteenOrders
      .filter((o) => !o.branchId || o.branchId === branchId)
      .toArray();
    if (rows.length > 0) {
      orders = rows.map((r) => r.data || r);
    }
  } catch (err) {
    console.warn("Could not read cached canteen orders from offlineDB:", err);
  }

  if (orders.length === 0) {
    orders = getLocalOrders();
  }

  if (sessionId) {
    orders = orders.filter((o) => o.sessionId === sessionId);
  }
  return orders;
}

async function persistOrder(order: Order) {
  const branchId = getActiveOfflineBranchId() || "default";
  const existingLocal = getLocalOrders();
  const filtered = existingLocal.filter((o) => o.id !== order.id);
  setLocalOrders([order, ...filtered]);
  try {
    await offlineDB.cachedCanteenOrders.put({
      id: order.id,
      branchId,
      sessionId: order.sessionId,
      data: order,
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not cache order to offlineDB:", err);
  }
}

export const CanteenApi = {
  // Categories
  getCategories: async (): Promise<Category[]> => {
    if (isAppOffline()) {
      return getStoredCategories();
    }
    try {
      const serverCategories = await apiFetch<Category[]>("/canteen-pos/categories");
      if (Array.isArray(serverCategories)) {
        await persistCategories(serverCategories);
        return serverCategories;
      }
      return getStoredCategories();
    } catch (err) {
      console.warn("Failed to fetch categories online, falling back to cache:", err);
      return getStoredCategories();
    }
  },

  createCategory: async (data: { name: string; isActive?: boolean }): Promise<Category> => {
    const executeOffline = async (): Promise<Category> => {
      const newCategory: Category = {
        id: crypto.randomUUID(),
        name: data.name,
        isActive: data.isActive ?? true,
      };
      const existing = await getStoredCategories();
      const updated = [...existing, newCategory];
      await persistCategories(updated);
      await queueCanteenCategoryChange(newCategory as any, "CREATE");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return newCategory;
    };

    if (isAppOffline()) return executeOffline();
    try {
      const cat = await apiFetch<Category>("/canteen-pos/categories", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const existing = await getStoredCategories();
      await persistCategories([...existing.filter((c) => c.id !== cat.id), cat]);
      return cat;
    } catch (err) {
      return executeOffline();
    }
  },

  updateCategory: async (
    id: string,
    data: Partial<{ name: string; isActive: boolean }>
  ): Promise<Category> => {
    const executeOffline = async (): Promise<Category> => {
      const existing = await getStoredCategories();
      let updatedCat: Category = {
        id,
        name: data.name || "",
        isActive: data.isActive ?? true,
      };
      const updated = existing.map((c) => {
        if (c.id === id) {
          updatedCat = { ...c, ...data };
          return updatedCat;
        }
        return c;
      });
      await persistCategories(updated);
      await queueCanteenCategoryChange({ id, ...data }, "UPDATE");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return updatedCat;
    };

    if (isAppOffline()) return executeOffline();
    try {
      const cat = await apiFetch<Category>(`/canteen-pos/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      const existing = await getStoredCategories();
      await persistCategories(existing.map((c) => (c.id === id ? cat : c)));
      return cat;
    } catch (err) {
      return executeOffline();
    }
  },

  deleteCategory: async (id: string): Promise<null> => {
    const executeOffline = async (): Promise<null> => {
      const existing = await getStoredCategories();
      await persistCategories(existing.filter((c) => c.id !== id));
      await queueCanteenCategoryChange({ id }, "DELETE");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return null;
    };

    if (isAppOffline()) return executeOffline();
    try {
      await apiFetch<null>(`/canteen-pos/categories/${id}`, { method: "DELETE" });
      const existing = await getStoredCategories();
      await persistCategories(existing.filter((c) => c.id !== id));
      return null;
    } catch (err) {
      return executeOffline();
    }
  },

  // Menu Items
  getMenuItems: async (
    categoryId?: string,
    onlyAvailable?: boolean
  ): Promise<MenuItem[]> => {
    if (isAppOffline()) {
      return getStoredMenuItems(categoryId, onlyAvailable);
    }
    try {
      let url = "/canteen-pos/items";
      const params = new URLSearchParams();
      if (categoryId) params.append("categoryId", categoryId);
      if (onlyAvailable !== undefined)
        params.append("onlyAvailable", String(onlyAvailable));
      if (params.toString()) url += `?${params.toString()}`;

      const serverItems = await apiFetch<MenuItem[]>(url);
      if (Array.isArray(serverItems)) {
        if (!categoryId && onlyAvailable === undefined) {
          await persistMenuItems(serverItems);
        } else {
          const existing = await getStoredMenuItems();
          const map = new Map(existing.map((i) => [i.id, i]));
          for (const item of serverItems) {
            map.set(item.id, item);
          }
          await persistMenuItems(Array.from(map.values()));
        }
        return serverItems;
      }
      return getStoredMenuItems(categoryId, onlyAvailable);
    } catch (err) {
      console.warn("Failed to fetch menu items online, falling back to cache:", err);
      return getStoredMenuItems(categoryId, onlyAvailable);
    }
  },

  createMenuItem: async (
    data: Omit<MenuItem, "id" | "isAvailable">
  ): Promise<MenuItem> => {
    const executeOffline = async (): Promise<MenuItem> => {
      const newItem: MenuItem = {
        id: crypto.randomUUID(),
        ...data,
        isAvailable: true,
        isActive: data.isActive ?? true,
      };
      const existing = await getStoredMenuItems();
      await persistMenuItems([...existing, newItem]);
      await queueCanteenItemChange(newItem as any, "CREATE");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return newItem;
    };

    if (isAppOffline()) return executeOffline();
    try {
      const item = await apiFetch<MenuItem>("/canteen-pos/items", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const existing = await getStoredMenuItems();
      await persistMenuItems([...existing.filter((i) => i.id !== item.id), item]);
      return item;
    } catch (err) {
      return executeOffline();
    }
  },

  updateMenuItem: async (
    id: string,
    data: Partial<MenuItem>
  ): Promise<MenuItem> => {
    const executeOffline = async (): Promise<MenuItem> => {
      const existing = await getStoredMenuItems();
      let updatedItem: MenuItem = {
        id,
        name: "",
        currentPrice: 0,
        isActive: true,
        isAvailable: true,
      };
      const updated = existing.map((i) => {
        if (i.id === id) {
          updatedItem = { ...i, ...data };
          return updatedItem;
        }
        return i;
      });
      await persistMenuItems(updated);
      await queueCanteenItemChange({ id, ...data }, "UPDATE");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return updatedItem;
    };

    if (isAppOffline()) return executeOffline();
    try {
      const item = await apiFetch<MenuItem>(`/canteen-pos/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      const existing = await getStoredMenuItems();
      await persistMenuItems(existing.map((i) => (i.id === id ? item : i)));
      return item;
    } catch (err) {
      return executeOffline();
    }
  },

  deleteMenuItem: async (id: string): Promise<null> => {
    const executeOffline = async (): Promise<null> => {
      const existing = await getStoredMenuItems();
      await persistMenuItems(existing.filter((i) => i.id !== id));
      await queueCanteenItemChange({ id }, "DELETE");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return null;
    };

    if (isAppOffline()) return executeOffline();
    try {
      await apiFetch<null>(`/canteen-pos/items/${id}`, { method: "DELETE" });
      const existing = await getStoredMenuItems();
      await persistMenuItems(existing.filter((i) => i.id !== id));
      return null;
    } catch (err) {
      return executeOffline();
    }
  },

  // Orders
  addItemsToSession: async (
    sessionId: string,
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>
  ): Promise<Order> => {
    const executeOffline = async (): Promise<Order> => {
      const allMenuItems = await getStoredMenuItems();
      const itemsMap = new Map(allMenuItems.map((mi) => [mi.id, mi]));

      const orderId = crypto.randomUUID();
      const orderItems: OrderItem[] = items.map((it) => {
        const mi = itemsMap.get(it.menuItemId);
        const unitPrice = Number(mi?.currentPrice || 0);
        return {
          id: crypto.randomUUID(),
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          unitPrice,
          lineTotal: unitPrice * it.quantity,
          notes: it.notes,
          menuItem: mi,
          kotPrinted: true,
          discountAmount: 0,
          discountPercent: 0,
        };
      });

      const order: Order = {
        id: orderId,
        sessionId,
        status: "open",
        items: orderItems,
        createdAt: new Date().toISOString(),
      };

      await persistOrder(order);

      const branchId = getActiveOfflineBranchId() || "default";
      await queueCanteenOrderChange(
        {
          id: orderId,
          orderId,
          branchId,
          sessionId,
          items,
          status: "open",
          createdAt: new Date().toISOString(),
        },
        "ADD_ITEMS_TO_SESSION"
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
        window.dispatchEvent(
          new CustomEvent("cuecloud:canteen-order-created", { detail: order })
        );
      }

      return order;
    };

    if (isAppOffline()) {
      return executeOffline();
    }

    try {
      const order = await apiFetch<Order>(
        `/canteen-pos/sessions/${sessionId}/items`,
        {
          method: "POST",
          body: JSON.stringify({ items }),
        }
      );
      if (order) {
        await persistOrder(order);
      }
      return order;
    } catch (err) {
      console.warn("Online addItemsToSession failed, queuing offline order:", err);
      return executeOffline();
    }
  },

  createStandaloneOrder: async (
    payload: StandaloneOrderPayload | StandaloneOrderItemInput[]
  ): Promise<Order> => {
    const body = Array.isArray(payload) ? { items: payload } : payload;
    const items = body.items;

    const executeOffline = async (): Promise<Order> => {
      const allMenuItems = await getStoredMenuItems();
      const itemsMap = new Map(allMenuItems.map((mi) => [mi.id, mi]));

      const orderId = crypto.randomUUID();
      const orderItems: OrderItem[] = items.map((it) => {
        const mi = itemsMap.get(it.menuItemId);
        const unitPrice = Number(it.unitPrice ?? mi?.currentPrice ?? 0);
        return {
          id: crypto.randomUUID(),
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          unitPrice,
          lineTotal: unitPrice * it.quantity,
          notes: it.notes,
          menuItem: mi,
          kotPrinted: true,
          discountAmount: 0,
          discountPercent: 0,
        };
      });

      const order: Order = {
        id: orderId,
        status: "served",
        items: orderItems,
        createdAt: new Date().toISOString(),
      };

      await persistOrder(order);

      const branchId = getActiveOfflineBranchId() || "default";
      const orderTotal = body.totalAmount ?? orderItems.reduce((sum, it) => sum + it.lineTotal, 0);

      // Create an invoice for this direct sale so Billing sees it
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `CANT-${Date.now().toString().slice(-6)}`;
      const now = new Date();
      const offlineInvoice = {
        id: invoiceId,
        branchId,
        sessionId: null,
        customerId: body.customerId ?? null,
        customer: null,
        invoiceNumber,
        table: null,
        subtotal: orderTotal,
        discountAmount: 0,
        discountReasonCode: null,
        taxAmount: 0,
        serviceCharge: 0,
        total: orderTotal,
        paidAmount: orderTotal,
        remainingAmount: 0,
        status: "paid" as const,
        voidReason: null,
        voidedAt: null,
        voidedById: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        receiptId: null,
        items: orderItems.map((oi) => ({
          id: crypto.randomUUID(),
          itemType: "canteen" as const,
          sourceSessionId: null,
          sourceOrderItemId: oi.id,
          itemName: oi.menuItem?.name || "Canteen Item",
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
          lineTotal: oi.lineTotal,
        })),
        payments: (body.payments?.length
          ? body.payments
          : [{ method: "CASH", amount: orderTotal }]
        ).map((payment) => ({
            id: crypto.randomUUID(),
            invoiceId,
            tenderType: payment.method === "WALLET" ? "online" : payment.method.toLowerCase(),
            amount: payment.amount,
            paymentReference: payment.reference ?? "Offline Canteen Direct Sale",
            createdAt: now.toISOString(),
          })),
      };

      try {
        await offlineDB.cachedInvoices.put({
          id: invoiceId,
          branchId,
          data: offlineInvoice,
          cachedAt: now.toISOString(),
        });
      } catch {}

      await queueCanteenOrderChange(
        {
          id: orderId,
          orderId,
          branchId,
          items,
          status: "served",
          total: orderTotal,
          payments: body.payments,
          amountTendered: body.amountTendered,
          changeDue: body.changeDue,
          invoiceId,
          createdAt: now.toISOString(),
        },
        "CREATE_STANDALONE"
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
        window.dispatchEvent(
          new CustomEvent("cuecloud:invoice-created", { detail: offlineInvoice })
        );
        window.dispatchEvent(
          new CustomEvent("cuecloud:canteen-order-created", { detail: order })
        );
      }

      return order;
    };

    if (isAppOffline()) {
      return executeOffline();
    }

    const order = await apiFetch<Order>("/canteen-pos/standalone-orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (order) {
      await persistOrder(order);
    }
    return order;
  },

  getSessionOrders: async (sessionId: string): Promise<Order[]> => {
    if (isAppOffline()) {
      return getStoredOrders(sessionId);
    }
    try {
      const orders = await apiFetch<Order[]>(
        `/canteen-pos/sessions/${sessionId}/orders`
      );
      if (Array.isArray(orders)) {
        for (const ord of orders) {
          await persistOrder(ord);
        }
        return orders;
      }
      return getStoredOrders(sessionId);
    } catch (err) {
      console.warn("Failed to fetch session orders online, falling back to cache:", err);
      return getStoredOrders(sessionId);
    }
  },

  getOrders: async (): Promise<Order[]> => {
    if (isAppOffline()) {
      return getStoredOrders();
    }
    try {
      const orders = await apiFetch<Order[]>("/canteen-pos/orders");
      if (Array.isArray(orders)) {
        for (const ord of orders) {
          await persistOrder(ord);
        }
        return orders;
      }
      return getStoredOrders();
    } catch (err) {
      console.warn("Failed to fetch orders online, falling back to cache:", err);
      return getStoredOrders();
    }
  },

  // POS Operations
  toggleItemAvailability: async (
    id: string,
    isAvailable: boolean
  ): Promise<MenuItem> => {
    const executeOffline = async (): Promise<MenuItem> => {
      const existing = await getStoredMenuItems();
      let updatedItem: MenuItem = {
        id,
        name: "",
        currentPrice: 0,
        isActive: true,
        isAvailable,
      };
      const updated = existing.map((i) => {
        if (i.id === id) {
          updatedItem = { ...i, isAvailable };
          return updatedItem;
        }
        return i;
      });
      await persistMenuItems(updated);
      await queueCanteenItemChange({ id, isAvailable }, "AVAILABILITY");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:offline-queue-changed"));
      }
      return updatedItem;
    };

    if (isAppOffline()) return executeOffline();
    try {
      const item = await apiFetch<MenuItem>(
        `/canteen-pos/items/${id}/availability`,
        {
          method: "PATCH",
          body: JSON.stringify({ isAvailable }),
        }
      );
      const existing = await getStoredMenuItems();
      await persistMenuItems(existing.map((i) => (i.id === id ? item : i)));
      return item;
    } catch (err) {
      return executeOffline();
    }
  },

  updateOrderItem: (
    id: string,
    quantity: number,
    notes?: string,
    reason?: string
  ) =>
    apiFetch<OrderItem>(`/canteen-pos/orders/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity, notes, reason }),
    }),

  voidOrderItem: (id: string, managerPin: string, reason: string) =>
    apiFetch<OrderItem>(`/canteen-pos/orders/items/${id}/void`, {
      method: "POST",
      body: JSON.stringify({ managerPin, reason }),
    }),

  applyItemDiscount: (
    id: string,
    data: {
      discountPercent?: number;
      discountAmount?: number;
      managerPin: string;
    }
  ) =>
    apiFetch<OrderItem>(`/canteen-pos/orders/items/${id}/discount`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};