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
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  menuItem?: MenuItem;
}

export interface Order {
  id: string;
  sessionId?: string;
  status: string;
  items: OrderItem[];
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
  getMenuItems: (categoryId?: string) =>
    apiFetch<MenuItem[]>(
      categoryId ? `/canteen-pos/items?categoryId=${categoryId}` : "/canteen-pos/items"
    ),
  createMenuItem: (data: Omit<MenuItem, "id">) =>
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
  createStandaloneOrder: (items: Array<{ menuItemId: string; quantity: number; notes?: string }>) =>
    apiFetch<Order>("/canteen-pos/standalone-orders", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
