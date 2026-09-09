import { apiFetch } from "@/lib/api/client";
import {
  offlineDB,
  queueCustomerChange,
  getActiveOfflineBranchId,
} from "@/lib/sync/offline-db";

import type {
  Customer,
  CustomerCreateInput,
  CustomerMergeInput,
  CustomerProfile,
  CustomerTag,
  CustomerTagAssignment,
  CustomerTagInput,
  CustomerUdhaarHistory,
  CustomerUpdateInput,
  CustomerVisitHistory,
} from "./types";

const request = <T = unknown>(path: string, options?: RequestInit) =>
  apiFetch(path, options) as Promise<T>;

export const customerApi = {
  search: async (query = "", limit = 50, brief = false): Promise<Customer[]> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline mode active");
      }
      const data = await request<Customer[]>(
        `/customers?q=${encodeURIComponent(query)}&limit=${limit}${brief ? "&brief=true" : ""}`,
      );

      // Cache customers in IndexedDB for offline usage
      if (Array.isArray(data) && typeof window !== "undefined") {
        const branchId = getActiveOfflineBranchId() || "default";
        void offlineDB.cachedCustomers.bulkPut(
          data.map((c) => ({
            id: c.id,
            branchId,
            data: c,
            cachedAt: new Date().toISOString(),
          })),
        );
      }

      return data;
    } catch (fetchError) {
      // Fallback to offline cached customers
      const branchId = getActiveOfflineBranchId();
      const cached = branchId
        ? await offlineDB.cachedCustomers.where("branchId").equals(branchId).toArray()
        : await offlineDB.cachedCustomers.toArray();

      const term = query.trim().toLowerCase();
      const list = cached.map((item) => item.data as Customer);

      if (!term) return list.slice(0, limit);
      return list
        .filter(
          (c) =>
            c.fullName?.toLowerCase().includes(term) ||
            c.phone?.includes(term) ||
            c.cnic?.includes(term),
        )
        .slice(0, limit);
    }
  },

  get: async (id: string): Promise<CustomerProfile> => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline mode active");
      }
      return await request<CustomerProfile>(`/customers/${id}`);
    } catch {
      const cached = await offlineDB.cachedCustomers.get(id);
      if (cached) {
        return {
          ...(cached.data as Customer),
          sessions: [],
          invoices: [],
        } as CustomerProfile;
      }
      throw new Error("Customer profile not available offline");
    }
  },

  create: async (body: CustomerCreateInput): Promise<Customer> => {
    const branchId = getActiveOfflineBranchId() || "default";
    const newId = crypto.randomUUID();
    const cleanPhone = body.phone.replace(/[\s()-]/g, "");

    const newCustomer: Customer = {
      id: newId,
      fullName: body.fullName,
      phone: cleanPhone,
      cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null,
      createdAt: new Date().toISOString(),
      tagAssignments: [],
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Offline direct queue
      await offlineDB.cachedCustomers.put({
        id: newId,
        branchId,
        data: newCustomer,
        cachedAt: new Date().toISOString(),
      });

      await queueCustomerChange(
        {
          id: newId,
          branchId,
          fullName: body.fullName,
          phone: cleanPhone,
          cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null,
          createdAt: new Date().toISOString(),
        },
        "create",
      );

      return newCustomer;
    }

    try {
      const created = await request<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          fullName: body.fullName,
          phone: cleanPhone,
          cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null,
        }),
      });

      // Cache locally
      await offlineDB.cachedCustomers.put({
        id: created.id,
        branchId,
        data: created,
        cachedAt: new Date().toISOString(),
      });

      return created;
    } catch (onlineError) {
      // Network failure fallback
      await offlineDB.cachedCustomers.put({
        id: newId,
        branchId,
        data: newCustomer,
        cachedAt: new Date().toISOString(),
      });

      await queueCustomerChange(
        {
          id: newId,
          branchId,
          fullName: body.fullName,
          phone: cleanPhone,
          cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null,
          createdAt: new Date().toISOString(),
        },
        "create",
      );

      return newCustomer;
    }
  },

  update: async (id: string, body: CustomerUpdateInput): Promise<Customer> => {
    const branchId = getActiveOfflineBranchId() || "default";
    const cleanPhone = body.phone ? body.phone.replace(/[\s()-]/g, "") : undefined;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const existing = await offlineDB.cachedCustomers.get(id);
      const updatedData: Customer = {
        ...(existing?.data || { id, createdAt: new Date().toISOString(), tagAssignments: [] }),
        ...(body.fullName ? { fullName: body.fullName } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(body.cnic !== undefined ? { cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null } : {}),
      };

      await offlineDB.cachedCustomers.put({
        id,
        branchId,
        data: updatedData,
        cachedAt: new Date().toISOString(),
      });

      await queueCustomerChange(
        {
          id,
          branchId,
          fullName: updatedData.fullName || "Unnamed Customer",
          phone: updatedData.phone || "",
          cnic: updatedData.cnic,
          createdAt: new Date().toISOString(),
        },
        "update",
      );

      return updatedData;
    }

    try {
      const updated = await request<Customer>(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(body.fullName ? { fullName: body.fullName } : {}),
          ...(cleanPhone ? { phone: cleanPhone } : {}),
          ...(body.cnic !== undefined ? { cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null } : {}),
        }),
      });

      await offlineDB.cachedCustomers.put({
        id: updated.id,
        branchId,
        data: updated,
        cachedAt: new Date().toISOString(),
      });

      return updated;
    } catch {
      const existing = await offlineDB.cachedCustomers.get(id);
      const updatedData: Customer = {
        ...(existing?.data || { id, createdAt: new Date().toISOString(), tagAssignments: [] }),
        ...(body.fullName ? { fullName: body.fullName } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(body.cnic !== undefined ? { cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null } : {}),
      };

      await queueCustomerChange(
        {
          id,
          branchId,
          fullName: updatedData.fullName || "Unnamed Customer",
          phone: updatedData.phone || "",
          cnic: updatedData.cnic,
          createdAt: new Date().toISOString(),
        },
        "update",
      );

      return updatedData;
    }
  },

  remove: (id: string) =>
    request<void>(`/customers/${id}`, {
      method: "DELETE",
    }),

  visits: (id: string) =>
    request<CustomerVisitHistory>(
      `/customers/${id}/visits`,
    ),

  udhaar: (id: string) =>
    request<CustomerUdhaarHistory>(
      `/customers/${id}/udhaar`,
    ),

  validateUdhaar: (id: string) =>
    request<{ allowed: boolean }>(
      `/customers/${id}/validate-udhaar`,
    ),

  availableTags: () =>
    request<CustomerTag[]>("/customers/tags"),

  tags: (id: string) =>
    request<CustomerTagAssignment[]>(
      `/customers/${id}/tags`,
    ),

  addTag: (id: string, body: CustomerTagInput) =>
    request<CustomerTagAssignment>(
      `/customers/${id}/tags`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  removeTag: (id: string, tagId: string) =>
    request<{ deleted: boolean }>(
      `/customers/${id}/tags/${tagId}`,
      {
        method: "DELETE",
      },
    ),

  merge: (id: string, body: CustomerMergeInput) =>
    request<{
      merged: boolean;
      sourceCustomerId: string;
      targetCustomerId: string;
    }>(`/customers/${id}/merge`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};