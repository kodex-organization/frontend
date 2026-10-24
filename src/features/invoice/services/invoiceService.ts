import { apiFetch, ApiError } from "@/lib/api/client";
import { isAppOffline } from "@/lib/connectivity/online-status";
import {
  offlineDB,
  getActiveOfflineBranchId,
  queuePaymentChange,
} from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";
import {
  cacheBranchCurrency,
  getCachedBranchCurrency,
  getCachedBranchName,
} from "@/features/tenancy/branch-currency-cache";
import { filterCachedInvoices } from "../utils/filterCachedInvoices";
import { takeSeededInvoice } from "../utils/seededInvoice";
import type {
  BillingTransaction,
  Invoice,
  InvoiceListFilters,
  Paginated,
  PaymentResult,
  RecordPaymentInput,
} from "../types/invoice";

function toQuery(values: object) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (
      (typeof value === "string" || typeof value === "number") &&
      value !== ""
    ) {
      params.set(key, String(value));
    }

  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function readOfflineInvoices() {
  const cached = await offlineDB.cachedInvoices.toArray();
  const byId = new Map<string, Invoice>(
    cached
      .map((entry) => [entry.id, entry.data as Invoice] as const)
      .filter((entry): entry is [string, Invoice] => Boolean(entry[1])),
  );
  const pending = await offlineDB.pendingQueue.where("entity").equals("invoice").toArray();
  for (const item of pending) {
    const payload = item.payload as any;
    if (!payload?.id || byId.has(payload.id)) continue;
    const total = Number(payload.total ?? 0);
    byId.set(payload.id, {
      ...payload,
      branch: {
        id: payload.branchId,
        name: getCachedBranchName(payload.branchId),
        currency: getCachedBranchCurrency(payload.branchId),
      },
      subtotal: Number(payload.subtotal ?? total),
      discountAmount: Number(payload.discountAmount ?? 0),
      taxAmount: Number(payload.taxAmount ?? 0),
      serviceCharge: Number(payload.serviceCharge ?? 0),
      total,
      paidAmount: Number(payload.paidAmount ?? 0),
      remainingAmount: Math.max(0, total - Number(payload.paidAmount ?? 0)),
      items: payload.items ?? [],
      payments: payload.payments ?? [],
    } as Invoice);
  }
  return Array.from(byId.values());
}

async function recordPaymentOffline(invoiceId: string, input: RecordPaymentInput): Promise<PaymentResult> {
  const paymentId = crypto.randomUUID();
  const accessContext = tokenStorage.getAccessContext();
  const branchId = accessContext?.branchId || getActiveOfflineBranchId() || "default";

  await queuePaymentChange({
    id: paymentId,
    branchId,
    invoiceId,
    amount: String(input.amount),
    paymentMethod: input.tenderType as any,
    reference: input.paymentReference ?? null,
    receivedById: accessContext?.userId ?? null,
    createdAt: new Date().toISOString(),
  });

  let currentRemaining = 0;
  try {
    const cached = await offlineDB.cachedInvoices.get(invoiceId);
    if (cached?.data) {
      const currentPaid = Number(cached.data.paidAmount ?? 0);
      const newPaid = currentPaid + Number(input.amount);
      const total = Number(cached.data.total ?? 0);
      currentRemaining = Math.max(0, total - newPaid);
      const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partially_paid" : cached.data.status;
      await offlineDB.cachedInvoices.put({
        ...cached,
        data: {
          ...cached.data,
          paidAmount: newPaid,
          remainingAmount: currentRemaining,
          status: newStatus,
        },
      });
    }
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
    window.dispatchEvent(new CustomEvent("cuecloud:payment-recorded", { detail: { invoiceId, paymentId } }));
  }

  return {
    paymentId,
    invoiceId,
    amount: input.amount,
    tenderType: input.tenderType,
    status: "recorded_offline",
    remainingBalance: currentRemaining,
    offlineQueued: true,
  } as any;
}

export const invoiceService = {
  async getInvoices(filters: InvoiceListFilters = {}): Promise<Paginated<Invoice>> {
    if (isAppOffline()) {
      try {
        const items = await readOfflineInvoices();
        return filterCachedInvoices(items, filters, getActiveOfflineBranchId());
      } catch {
        return {
          items: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        };
      }
    }

    try {
      const response = await apiFetch<Paginated<Invoice>>(
        `/billing/invoices${toQuery(filters)}`,
      );

      // Cache invoices for offline availability
      if (response?.items && Array.isArray(response.items)) {
        try {
          for (const invoice of response.items) {
            if (invoice.branch?.id && invoice.branch.currency) {
              cacheBranchCurrency(invoice.branch.id, invoice.branch.currency);
            }
          }
          await offlineDB.cachedInvoices.bulkPut(
            response.items.map((inv) => ({
              id: inv.id,
              branchId: inv.branch?.id || getActiveOfflineBranchId() || "default",
              data: inv,
              cachedAt: new Date().toISOString(),
            })),
          );
        } catch {}
      }

      return response;
    } catch (err: any) {
      if (
        isAppOffline() ||
        err?.code === "NETWORK_ERROR" ||
        err?.status === 0 ||
        err?.message?.includes("reach the server") ||
        err?.message?.includes("fetch")
      ) {
        try {
          const items = await readOfflineInvoices();
          return filterCachedInvoices(items, filters, getActiveOfflineBranchId());
        } catch {}
      }
      throw err;
    }
  },

  async getInvoice(id: string): Promise<Invoice> {
    const findInCache = async () => {
      const direct = await offlineDB.cachedInvoices.get(id);
      if (direct?.data) return direct.data as Invoice;
      const all = await offlineDB.cachedInvoices.toArray();
      const match = all.find(
        (c) => c.id === id || c.data?.id === id || c.data?.sessionId === id,
      );
      if (match?.data) return match.data as Invoice;
      return null;
    };

    if (isAppOffline()) {
      const cached = await findInCache();
      if (cached) return cached;
      throw new Error("Invoice details unavailable offline.");
    }

    // Invoice just created by End session; skip the extra request.
    const seeded = takeSeededInvoice(id);
    if (seeded) {
      void offlineDB.cachedInvoices
        .put({
          id: seeded.id,
          branchId: seeded.branch?.id || getActiveOfflineBranchId() || "default",
          data: seeded,
          cachedAt: new Date().toISOString(),
        })
        .catch(() => {});
      return seeded;
    }

    try {
      const invoice = await apiFetch<Invoice>(
        `/billing/invoices/${encodeURIComponent(id)}`,
      );

      try {
        await offlineDB.cachedInvoices.put({
          id: invoice.id,
          branchId: invoice.branch?.id || getActiveOfflineBranchId() || "default",
          data: invoice,
          cachedAt: new Date().toISOString(),
        });
      } catch {}

      return invoice;
    } catch (err: any) {
      if (
        isAppOffline() ||
        err?.code === "NETWORK_ERROR" ||
        err?.status === 0 ||
        err?.message?.includes("reach the server") ||
        err?.message?.includes("fetch")
      ) {
        const cached = await findInCache();
        if (cached) return cached;
      }
      throw err;
    }
  },

  getTransactions(
    filters: Pick<
      InvoiceListFilters,
      "page" | "pageSize" | "from" | "to"
    > = {},
  ) {
    return apiFetch<Paginated<BillingTransaction>>(
      `/billing/transactions${toQuery(filters)}`,
    );
  },

  async voidInvoice(invoiceId: string, reason: string) {
    const res = await apiFetch<Invoice>(
      `/billing/invoices/${encodeURIComponent(invoiceId)}/void`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      },
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cuecloud:invoice-voided", { detail: { invoiceId, reason } }));
      window.dispatchEvent(new CustomEvent("cuecloud:anomaly-invalidated"));
      window.dispatchEvent(new CustomEvent("cuecloud:audit-invalidated"));
    }

    return res;
  },

  async addPayment(invoiceId: string, input: RecordPaymentInput): Promise<PaymentResult> {
    if (isAppOffline()) {
      return recordPaymentOffline(invoiceId, input);
    }

    try {
      return await apiFetch<PaymentResult>(
        `/billing/invoices/${encodeURIComponent(invoiceId)}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...input,
            tenders: [
              {
                tenderType: input.tenderType,
                amount: input.amount,
                payerLabel: input.payerLabel,
                paymentReference: input.paymentReference,
              },
            ],
          }),
        },
      );
    } catch (err: any) {
      if (err?.code === "NETWORK_ERROR" || err?.status === 0 || isAppOffline()) {
        return recordPaymentOffline(invoiceId, input);
      }
      throw err;
    }
  },
};
