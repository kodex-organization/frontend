import { apiFetch, ApiError } from "@/lib/api/client";
import {
  offlineDB,
  queueCustomerChange,
  getActiveOfflineBranchId,
} from "@/lib/sync/offline-db";
import {
  readCachedBranches,
  readCachedTags,
  saveCachedTags,
} from "./customer-offline-cache";
import {
  canSeeAllBranchesOffline,
  claimCustomerCacheForCurrentTenant,
  isCustomerCacheUsable,
  cacheScopedJson,
  readScopedJson,
} from "@/lib/sync/offline-reference-cache";
import {
  getPendingUdhaarEntries,
  pendingHistoryEntries,
} from "@/features/udhaar/offline-ledger";

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

/**
 * True only for real connection failures (not 400/403/409 API answers).
 * apiFetch reports "server unreachable / offline" as
 * ApiError(status 0, code "NETWORK_ERROR"), so that one ApiError counts as a
 * connection failure; every other ApiError is a real answer from the server.
 */
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === "NETWORK_ERROR";
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    (error as { status: number }).status > 0
  ) {
    return false;
  }
  return true;
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** Builds the tag list shown on a customer row while we are offline. */
function buildOfflineTagAssignments(
  tagName: string,
  tags: CustomerTag[],
): CustomerTagAssignment[] {
  const name = tagName.trim();
  if (!name) return [];
  const match = tags.find((t) => t.name?.toLowerCase() === name.toLowerCase());
  return [
    {
      id: `offline-${crypto.randomUUID()}`,
      assignedAt: new Date().toISOString(),
      tag: match ?? { id: `offline-tag:${name.toLowerCase()}`, name },
    },
  ];
}

/**
 * Branch label for a customer saved offline, taken from the branch list cached
 * while online. Without it the list would show "All Branches" for a customer
 * that was assigned to one specific branch.
 */
async function resolveBranchRef(
  branchId: string | null | undefined,
): Promise<{ id: string; name: string | null } | null> {
  if (!branchId) return null;
  const branches = await readCachedBranches();
  const match = branches?.find((b) => b.id === branchId);
  return match ? { id: match.id, name: match.name } : null;
}

/**
 * A customer created offline has no server row yet. Any later change must be
 * queued (in order) instead of calling the server, which would answer 404.
 */
async function hasUnsyncedCustomerChange(customerId: string): Promise<boolean> {
  const count = await offlineDB.pendingQueue
    .where("entityId")
    .equals(customerId)
    .filter((item) => item.entity === "customer" && item.status !== "synced")
    .count();
  return count > 0;
}

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
        void claimCustomerCacheForCurrentTenant().then(() =>
          offlineDB.cachedCustomers.bulkPut(
            data.map((c) => ({
              id: c.id,
              branchId,
              data: c,
              cachedAt: new Date().toISOString(),
            })),
          ),
        );
      }

      return data;
    } catch (fetchError) {
      // Fallback to offline cached customers
      const branchId = getActiveOfflineBranchId();

      // Never show customers cached by a different tenant on this browser.
      if (!(await isCustomerCacheUsable())) return [];

      // Mirror the server rule (customer.routes.ts): OWNER / MANAGER see every
      // customer of the tenant; other roles see their branch + unassigned ones.
      const seesAllBranches = canSeeAllBranchesOffline();
      const cached =
        !seesAllBranches && branchId
          ? await offlineDB.cachedCustomers.where("branchId").equals(branchId).toArray()
          : await offlineDB.cachedCustomers.toArray();

      const term = query.trim().toLowerCase();
      const list = cached
        .map((item) => item.data as Customer)
        .filter(
          (customer) =>
            seesAllBranches ||
            !customer.branchId ||
            customer.branchId === branchId,
        );

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
    const tagName = body.tagName?.trim() || "";

    // Check offline cache for duplicate phone first
    if (cleanPhone) {
      const cached = await offlineDB.cachedCustomers.toArray();
      const existingOffline = cached.find((item) => {
        const c = item.data as Customer;
        return c.phone && c.phone.replace(/[\s()-]/g, "") === cleanPhone;
      });
      if (existingOffline) {
        const existingCust = existingOffline.data as Customer;
        throw new Error(
          `A customer with this phone number already exists (${existingCust.fullName || "Existing customer"})`,
        );
      }
    }

    const cleanCnic = body.cnic && body.cnic.trim() ? body.cnic.trim() : null;

    // Save locally + queue for sync (used when offline / server unreachable).
    const createOffline = async (): Promise<Customer> => {
      const tags = tagName ? await readCachedTags() : [];
      const newCustomer: Customer = {
        id: newId,
        branchId: body.branchId ?? null,
        branch: await resolveBranchRef(body.branchId),
        fullName: body.fullName,
        phone: cleanPhone,
        cnic: cleanCnic,
        createdAt: new Date().toISOString(),
        tagAssignments: buildOfflineTagAssignments(tagName, tags),
      };

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
          assignedBranchId: body.branchId ?? null,
          fullName: body.fullName,
          phone: cleanPhone,
          cnic: cleanCnic,
          ...(tagName ? { tagName } : {}),
          createdAt: new Date().toISOString(),
        },
        "create",
      );

      return newCustomer;
    };

    if (isBrowserOffline()) {
      return createOffline();
    }

    try {
      const created = await request<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          branchId: body.branchId ?? null,
          fullName: body.fullName,
          phone: cleanPhone,
          cnic: cleanCnic,
        }),
      });

      // Cache locally
      await offlineDB.cachedCustomers.put({
        id: created.id,
        branchId,
        data: created,
        cachedAt: new Date().toISOString(),
      });

      // Assign the chosen tag (online path; falls back to the queue by itself).
      if (tagName) {
        await customerApi.setTag(
          { id: created.id, tagAssignments: created.tagAssignments ?? [] },
          tagName,
          await customerApi.availableTags(),
        );
      }

      return created;
    } catch (onlineError) {
      // API answers (validation 400, conflict 409, forbidden 403 ...) go to the form.
      if (!isNetworkFailure(onlineError)) {
        throw onlineError;
      }
      // Only true network failures fall back to the offline queue.
      return createOffline();
    }
  },

  update: async (id: string, body: CustomerUpdateInput): Promise<Customer> => {
    const branchId = getActiveOfflineBranchId() || "default";
    const cleanPhone = body.phone ? body.phone.replace(/[\s()-]/g, "") : undefined;

    // If updating phone, check offline cache for duplicate phone on a different customer
    if (cleanPhone) {
      const cached = await offlineDB.cachedCustomers.toArray();
      const existingOffline = cached.find((item) => {
        const c = item.data as Customer;
        return c.id !== id && c.phone && c.phone.replace(/[\s()-]/g, "") === cleanPhone;
      });
      if (existingOffline) {
        const existingCust = existingOffline.data as Customer;
        throw new Error(
          `A customer with this phone number already exists (${existingCust.fullName || "Existing customer"})`,
        );
      }
    }

    // Shared by the "browser offline" path and the "server unreachable" path.
    const updateOffline = async (): Promise<Customer> => {
      const existing = await offlineDB.cachedCustomers.get(id);
      const updatedData: Customer = {
        ...(existing?.data || { id, branchId: null, createdAt: new Date().toISOString(), tagAssignments: [] }),
        ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
        ...(body.fullName ? { fullName: body.fullName } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(body.cnic !== undefined ? { cnic: body.cnic && body.cnic.trim() ? body.cnic.trim() : null } : {}),
      };
      if (body.branchId !== undefined) {
        updatedData.branch = await resolveBranchRef(body.branchId);
      }

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
          assignedBranchId: updatedData.branchId,
          fullName: updatedData.fullName || "Unnamed Customer",
          phone: updatedData.phone || "",
          cnic: updatedData.cnic,
          createdAt: new Date().toISOString(),
        },
        "update",
      );

      return updatedData;
    };

    if (isBrowserOffline()) {
      return updateOffline();
    }

    try {
      const updated = await request<Customer>(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
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
    } catch (onlineError) {
      // API answers (validation 400, conflict 409, forbidden 403 ...) go to the form.
      if (!isNetworkFailure(onlineError)) {
        throw onlineError;
      }
      // Server unreachable: save locally and queue, exactly like offline mode.
      return updateOffline();
    }
  },

  remove: async (id: string): Promise<void> => {
    await request<void>(`/customers/${id}`, {
      method: "DELETE",
    });
    // A local cache failure must not turn a completed server deletion into an error.
    try {
      await offlineDB.cachedCustomers.delete(id);
    } catch {
      console.warn("Customer deleted, but the offline customer cache could not be updated.");
    }
  },

  /** Visit history: last server copy is shown while offline. */
  visits: async (id: string): Promise<CustomerVisitHistory> => {
    try {
      const data = await request<CustomerVisitHistory>(`/customers/${id}/visits`);
      void cacheScopedJson(`customer-visits:${id}`, data);
      return data;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const saved = await readScopedJson<CustomerVisitHistory>(`customer-visits:${id}`);
      return saved?.data ?? { totalVisits: 0, totalSpent: 0, favouriteTable: null, visits: [] };
    }
  },

  /**
   * Udhaar balance + history of one customer (SRS 3.7/3.8).
   * Offline: last server copy, and entries saved on this device but not yet
   * synced are added on top, so the balance matches the Udhaar Ledger screen.
   */
  udhaar: async (id: string): Promise<CustomerUdhaarHistory> => {
    let data: CustomerUdhaarHistory;
    try {
      data = await request<CustomerUdhaarHistory>(`/customers/${id}/udhaar`);
      void cacheScopedJson(`customer-udhaar:${id}`, data);
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const saved = await readScopedJson<CustomerUdhaarHistory>(`customer-udhaar:${id}`);
      data = saved?.data ?? { outstandingBalance: 0, history: [] };
    }

    const waiting = (await getPendingUdhaarEntries()).filter((entry) => entry.customerId === id);
    if (waiting.length === 0) return data;
    const extra = waiting.reduce((sum, entry) => sum + entry.signedAmount, 0);
    const known = new Set(data.history.map((entry) => String((entry as { id?: unknown }).id ?? "")));
    return {
      outstandingBalance: Math.round((Number(data.outstandingBalance ?? 0) + extra) * 100) / 100,
      history: [
        ...pendingHistoryEntries(id, waiting).filter((entry) => !known.has(entry.id)),
        ...data.history,
      ],
    };
  },

  /**
   * Can this customer get new udhaar? Offline we cannot ask the server, so we use
   * the rule the server uses: a customer tagged "Blocked" is not allowed (SRS 3.8).
   */
  validateUdhaar: async (id: string): Promise<{ allowed: boolean }> => {
    try {
      return await request<{ allowed: boolean }>(`/customers/${id}/validate-udhaar`);
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await offlineDB.cachedCustomers.get(id);
      const customer = cached?.data as Customer | undefined;
      const blocked = customer?.tagAssignments?.some(
        (assignment) => assignment.tag.name?.toLowerCase() === "blocked",
      );
      return { allowed: !blocked };
    }
  },

  /** Online: fetch + cache. Offline / server down: cached (or default) tags. */
  availableTags: async (): Promise<CustomerTag[]> => {
    if (isBrowserOffline()) {
      return readCachedTags();
    }
    try {
      const tags = await request<CustomerTag[]>("/customers/tags");
      if (Array.isArray(tags) && tags.length > 0) {
        void saveCachedTags(tags);
      }
      return tags;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return readCachedTags();
    }
  },

  /**
   * Set (or clear, with "") the single tag of a customer.
   * Online  -> remove old assignment(s) + add new one on the server.
   * Offline -> update the local cache (so the list shows it immediately)
   *            and queue an "update" with `tagName`; the sync push applies it.
   */
  setTag: async (
    customer: Pick<Customer, "id" | "tagAssignments">,
    tagName: string,
    availableTags: CustomerTag[],
  ): Promise<void> => {
    const nextName = tagName.trim();
    const currentName = customer.tagAssignments[0]?.tag.name ?? "";
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;

    const setTagOffline = async () => {
      const cachedRow = await offlineDB.cachedCustomers.get(customer.id);
      if (!cachedRow) {
        throw new Error("This customer is not available offline yet.");
      }
      const base = cachedRow.data as Customer;
      const updated: Customer = {
        ...base,
        tagAssignments: buildOfflineTagAssignments(nextName, availableTags),
      };

      await offlineDB.cachedCustomers.put({
        ...cachedRow,
        data: updated,
        cachedAt: new Date().toISOString(),
      });

      await queueCustomerChange(
        {
          id: customer.id,
          branchId: getActiveOfflineBranchId() || cachedRow.branchId || "default",
          assignedBranchId: base.branchId ?? null,
          fullName: base.fullName || "Unnamed Customer",
          phone: base.phone || "",
          cnic: base.cnic,
          // null = "remove tag", string = "set this tag"
          tagName: nextName || null,
          createdAt: new Date().toISOString(),
        },
        "update",
      );
    };

    if (isBrowserOffline() || (await hasUnsyncedCustomerChange(customer.id))) {
      await setTagOffline();
      return;
    }

    try {
      for (const assignment of customer.tagAssignments) {
        await request<{ deleted: boolean }>(
          `/customers/${customer.id}/tags/${assignment.tag.id}`,
          { method: "DELETE" },
        );
      }
      if (nextName) {
        const match = availableTags.find(
          (t) => t.name?.toLowerCase() === nextName.toLowerCase(),
        );
        if (match) {
          await request<CustomerTagAssignment>(`/customers/${customer.id}/tags`, {
            method: "POST",
            body: JSON.stringify({ tagId: match.id }),
          });
        }
      }
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      await setTagOffline();
    }
  },

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