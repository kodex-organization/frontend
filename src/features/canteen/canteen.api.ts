import { apiFetch } from "@/lib/api/client";

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

export const CanteenApi = {
  // Categories
  getCategories: () => apiFetch<Category[]>("/canteen-pos/categories"),
  createCategory: (data: { name: string; isActive?: boolean }) =>
    apiFetch<Category>("/canteen-pos/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: string, data: Partial<{ name: string; isActive: boolean }>) =>
    apiFetch<Category>(`/canteen-pos/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    apiFetch<null>(`/canteen-pos/categories/${id}`, { method: "DELETE" }),

  // Menu Items
  getMenuItems: (categoryId?: string, onlyAvailable?: boolean) => {
    let url = "/canteen-pos/items";
    const params = new URLSearchParams();
    if (categoryId) params.append("categoryId", categoryId);
    if (onlyAvailable !== undefined) params.append("onlyAvailable", String(onlyAvailable));
    if (params.toString()) url += `?${params.toString()}`;
    return apiFetch<MenuItem[]>(url);
  },
  createMenuItem: (data: Omit<MenuItem, "id" | "isAvailable">) =>
    apiFetch<MenuItem>("/canteen-pos/items", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMenuItem: (id: string, data: Partial<MenuItem>) =>
    apiFetch<MenuItem>(`/canteen-pos/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteMenuItem: (id: string) =>
    apiFetch<null>(`/canteen-pos/items/${id}`, { method: "DELETE" }),

  // Orders
  addItemsToSession: (sessionId: string, items: Array<{ menuItemId: string; quantity: number; notes?: string }>) =>
    apiFetch<Order>(`/canteen-pos/sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  createStandaloneOrder: (
    payload: StandaloneOrderPayload | StandaloneOrderItemInput[]
  ) => {
    // If payload is already an object containing { items, payments }, pass it directly.
    // If it's a legacy raw array, wrap it in { items: payload }.
    const body = Array.isArray(payload) ? { items: payload } : payload;

    return apiFetch<Order>("/canteen-pos/standalone-orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // New POS Operations
  toggleItemAvailability: (id: string, isAvailable: boolean) =>
    apiFetch<MenuItem>(`/canteen-pos/items/${id}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable }),
    }),
  updateOrderItem: (id: string, quantity: number, notes?: string, reason?: string) =>
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
    data: { discountPercent?: number; discountAmount?: number; managerPin: string }
  ) =>
    apiFetch<OrderItem>(`/canteen-pos/orders/items/${id}/discount`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};