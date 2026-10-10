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
  discountAmount: number;
  discountReasonCode: string;
  ownerPassword?: string;
}

export async function applyDiscount(invoiceId: string, payload: ApplyDiscountPayload) {
  return apiFetch<{ success: boolean; data: InvoiceDetails }>(`/invoices/${invoiceId}/discount`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface VoidInvoicePayload {
  reason: string;
  managerPin?: string;
}

export async function voidInvoice(invoiceId: string, payload: VoidInvoicePayload) {
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