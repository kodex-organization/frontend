import { apiFetch } from "@/lib/api/client";
import { getCachedBranchCurrency } from "@/features/tenancy/branch-currency-cache";

export interface InvoiceItem {
  id: string;
  itemName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  itemType: string | null;
}

export interface InvoicePayment {
  id: string;
  tenderType: string | null;
  amount: number;
  paymentReference: string | null;
  createdAt: string;
}

export interface InvoiceDetails {
  id: string;
  invoiceNumber: string | null;
  sessionId?: string | null;
  session?: {
    id: string;
    tableId?: string | null;
    table?: {
      id: string;
      tableNumber: string;
    } | null;
  } | null;
  status: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string | null;
    currency: string | null;
    maxUdhaarPerCustomer: number;
    discountLimitPercent: number;
    udhaarCnicThreshold?: number;
  };
  customer: {
    id: string;
    fullName: string | null;
    phone: string | null;
    cnic: string | null;
    outstandingBalance?: number;
    isBlocked?: boolean;
  } | null;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  discountReasonCode?: string | null;
  taxAmount: number;
  serviceCharge: number;
  total: number;
  payments: InvoicePayment[];
  paidAmount: number;
  remainingBalance: number;
}

export async function getInvoiceDetails(invoiceId: string) {
  return apiFetch<InvoiceDetails>(`/invoices/${invoiceId}`);
}

import {
  offlineDB,
  getActiveOfflineBranchId,
  queuePaymentChange,
} from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";
import { isAppOffline } from "@/lib/connectivity/online-status";
import { queueInvoiceChange, type InvoiceOfflinePayload } from "@/lib/sync/offline-db";

export interface SettleInvoicePayload {
  tenders: Array<{
    tenderType: "cash" | "card" | "udhaar" | "bank_transfer" | "mobile_wallet" | "other";
    amount: number;
    paymentReference?: string;
  }>;
  customerId?: string;      // 👈 CRITICAL: Must be sent if invoice.customerId is null
  customerCnic?: string;
  managerPin?: string;
}

async function recordSettleOffline(invoiceId: string, payload: SettleInvoicePayload) {
  const accessContext = tokenStorage.getAccessContext();
  const branchId = accessContext?.branchId || getActiveOfflineBranchId() || "default";

  for (const tender of payload.tenders) {
    const paymentId = crypto.randomUUID();
    await queuePaymentChange({
      id: paymentId,
      branchId,
      invoiceId,
      customerId: payload.customerId || null,
      amount: String(tender.amount),
      paymentMethod: (tender.tenderType as any) || "cash",
      reference: tender.paymentReference ?? null,
      receivedById: accessContext?.userId ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  let updatedInvoice: InvoiceDetails | null = null;
  try {
    const cached = await offlineDB.cachedInvoices.get(invoiceId);
    if (cached?.data) {
      const totalTender = payload.tenders.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const newPaid = Number(cached.data.paidAmount ?? 0) + totalTender;
      const total = Number(cached.data.total ?? 0);
      const remaining = Math.max(0, total - newPaid);
      const status = newPaid >= total ? "paid" : "partially_paid";
      cached.data.paidAmount = newPaid;
      cached.data.remainingBalance = remaining;
      cached.data.status = status;
      await offlineDB.cachedInvoices.put(cached);
      updatedInvoice = cached.data as InvoiceDetails;
    }
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
    window.dispatchEvent(new CustomEvent("cuecloud:payment-recorded", { detail: { invoiceId } }));
  }

  return {
    success: true,
    data: (updatedInvoice || {
      id: invoiceId,
      invoiceNumber: `INV-${invoiceId.slice(-6)}`,
      status: "paid",
      createdAt: new Date().toISOString(),
      branch: { id: branchId, name: "Current Branch", currency: getCachedBranchCurrency(branchId), maxUdhaarPerCustomer: 50000, discountLimitPercent: 20 },
      customer: null,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      serviceCharge: 0,
      total: 0,
      payments: [],
      paidAmount: 0,
      remainingBalance: 0,
    }) as InvoiceDetails,
  };
}

export async function settleInvoice(invoiceId: string, payload: SettleInvoicePayload) {
  if (isAppOffline()) {
    return recordSettleOffline(invoiceId, payload);
  }

  try {
    return await apiFetch<{ success: boolean; data: InvoiceDetails }>(`/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (err?.code === "NETWORK_ERROR" || err?.status === 0 || isAppOffline()) {
      return recordSettleOffline(invoiceId, payload);
    }
    throw err;
  }
}

export interface ApplyDiscountPayload {
  discountAmount?: number;
  discountReasonCode?: string;
  discountType?: "fixed" | "percentage";
  amount?: number;
  reason?: string;
  ownerPassword?: string;
}

async function findCachedInvoice(invoiceId: string) {
  const direct = await offlineDB.cachedInvoices.get(invoiceId);
  return direct;
}

export async function applyDiscount(invoiceId: string, payload: ApplyDiscountPayload) {
  if (isAppOffline()) {
    const cached = await findCachedInvoice(invoiceId);
    if (!cached?.data) throw new Error("Invoice details unavailable offline.");

    const invoice = cached.data as InvoiceDetails & {
      branchId?: string;
      voidReason?: string | null;
      voidedAt?: string | null;
      voidedById?: string | null;
    };
    const baseSubtotal = Number(invoice.subtotal || 0);
    const requested = Number(payload.amount ?? payload.discountAmount ?? 0);
    const discountAmount = payload.discountType === "percentage"
      ? Number((baseSubtotal * requested / 100).toFixed(2))
      : requested;
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > baseSubtotal) {
      throw new Error("Discount cannot be negative or exceed the invoice subtotal.");
    }

    const nextDiscount = Number(discountAmount.toFixed(2));
    const netSubtotal = Math.max(0, baseSubtotal - nextDiscount);
    const tax = Number(invoice.taxAmount || 0);
    const serviceCharge = Number(invoice.serviceCharge || 0);
    const nextTotal = Number((netSubtotal + tax + serviceCharge).toFixed(2));
    const updatedInvoice = {
      ...invoice,
      discountAmount: nextDiscount,
      discountReasonCode: payload.reason ?? payload.discountReasonCode ?? null,
      total: nextTotal,
      remainingBalance: Math.max(0, nextTotal - Number(invoice.paidAmount || 0)),
      remainingAmount: Math.max(0, nextTotal - Number(invoice.paidAmount || 0)),
      updatedAt: new Date().toISOString(),
    };

    await offlineDB.cachedInvoices.put({ ...cached, data: updatedInvoice });
    await queueInvoiceChange({
      id: invoiceId,
      branchId: cached.branchId || invoice.branch?.id || getActiveOfflineBranchId() || "default",
      invoiceNumber: invoice.invoiceNumber,
      sessionId: invoice.sessionId || null,
      customerId: invoice.customer?.id || null,
      subtotal: String(baseSubtotal),
      discountAmount: String(nextDiscount),
      discountReasonCode: updatedInvoice.discountReasonCode,
      discountApprovedById: tokenStorage.getAccessContext()?.userId ?? null,
      taxAmount: String(tax),
      serviceCharge: String(serviceCharge),
      total: String(nextTotal),
      paidAmount: String(invoice.paidAmount || 0),
      status: invoice.status === "paid" ? "paid" : "open",
      voidedInvoiceId: null,
      createdById: tokenStorage.getAccessContext()?.userId ?? null,
      createdAt: invoice.createdAt,
    }, "update");

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
    }
    return updatedInvoice;
  }

  return apiFetch<{ success: boolean; data: InvoiceDetails }>(`/invoices/${invoiceId}/discount`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface VoidInvoicePayload {
  reason: string;
  managerPin?: string;
}

// Finds the invoice by id, then by session id; falls back to the invoice already on screen.
async function findInvoiceForOfflineVoid(invoiceId: string, onScreenInvoice?: unknown) {
  const direct = await findCachedInvoice(invoiceId);
  if (direct?.data) return direct;
  const all = await offlineDB.cachedInvoices.toArray();
  const match = all.find(
    (row) => row.id === invoiceId || row.data?.id === invoiceId || row.data?.sessionId === invoiceId,
  );
  if (match?.data) return match;
  const fallback = onScreenInvoice as (InvoiceDetails & { branchId?: string }) | undefined;
  if (fallback?.id) {
    return {
      id: fallback.id,
      branchId: fallback.branchId || fallback.branch?.id || getActiveOfflineBranchId() || "default",
      data: fallback,
      cachedAt: new Date().toISOString(),
    };
  }
  return undefined;
}

export async function voidInvoice(invoiceId: string, payload: VoidInvoicePayload, onScreenInvoice?: unknown) {
  if (isAppOffline()) {
    const cached = await findInvoiceForOfflineVoid(invoiceId, onScreenInvoice);
    if (!cached?.data) throw new Error("Invoice details unavailable offline.");
    const invoice = cached.data as InvoiceDetails & { branchId?: string };
    if (["void", "voided"].includes(String(invoice.status ?? "").toLowerCase())) {
      throw new Error("Invoice is already voided.");
    }
    const now = new Date().toISOString();
    const updatedInvoice = {
      ...invoice,
      status: "void",
      voidReason: payload.reason,
      voidedAt: now,
      voidedById: tokenStorage.getAccessContext()?.userId ?? null,
      remainingBalance: 0,
      remainingAmount: 0,
      updatedAt: now,
    };
    await offlineDB.cachedInvoices.put({ ...cached, data: updatedInvoice });
    const voidChange: InvoiceOfflinePayload & { voidReason: string } = {
      id: cached.id || invoice.id || invoiceId,
      branchId: cached.branchId || invoice.branch?.id || getActiveOfflineBranchId() || "default",
      invoiceNumber: invoice.invoiceNumber,
      sessionId: invoice.sessionId || null,
      customerId: invoice.customer?.id || null,
      subtotal: String(invoice.subtotal || 0),
      discountAmount: String(invoice.discountAmount || 0),
      discountReasonCode: invoice.discountReasonCode || null,
      discountApprovedById: null,
      taxAmount: String(invoice.taxAmount || 0),
      serviceCharge: String(invoice.serviceCharge || 0),
      total: String(invoice.total || 0),
      paidAmount: String(invoice.paidAmount || 0),
      status: "void",
      voidedInvoiceId: null,
      createdById: tokenStorage.getAccessContext()?.userId ?? null,
      createdAt: invoice.createdAt,
      voidReason: payload.reason,
    };
    await queueInvoiceChange(voidChange, "update");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cuecloud:invoice-voided", { detail: { invoiceId, reason: payload.reason } }));
      window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
    }
    return { success: true, data: updatedInvoice };
  }

  const res = await apiFetch<{ success: boolean; data: InvoiceDetails }>(`/invoices/${invoiceId}/void`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cuecloud:invoice-voided", { detail: { invoiceId, reason: payload.reason } }));
    window.dispatchEvent(new CustomEvent("cuecloud:anomaly-invalidated"));
    window.dispatchEvent(new CustomEvent("cuecloud:audit-invalidated"));
  }

  return res;
}