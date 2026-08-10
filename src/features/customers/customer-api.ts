import { apiFetch } from "@/lib/api/client";

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
  search: (query = "", limit = 20, brief = false) =>
    request<Customer[]>(
      `/customers?q=${encodeURIComponent(query)}&limit=${limit}${brief ? "&brief=true" : ""}`,
    ),

  get: (id: string) =>
    request<CustomerProfile>(`/customers/${id}`),

  create: (body: CustomerCreateInput) =>
    request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: CustomerUpdateInput) =>
    request<Customer>(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

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

  // Available customer tags for this tenant
  availableTags: () =>
    request<CustomerTag[]>("/customers/tags"),

  // Tags assigned to a specific customer
  tags: (id: string) =>
    request<CustomerTagAssignment[]>(
      `/customers/${id}/tags`,
    ),

  // Assign a tag using its actual UUID
  addTag: (id: string, body: CustomerTagInput) =>
    request<CustomerTagAssignment>(
      `/customers/${id}/tags`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  // Remove a tag
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