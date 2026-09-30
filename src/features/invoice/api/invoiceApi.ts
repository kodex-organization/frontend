import { apiFetch } from "@/lib/api/client";

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

export async function settleInvoice(invoiceId: string, payload: SettleInvoicePayload) {
  return apiFetch<{ success: boolean; data: InvoiceDetails }>(`/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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