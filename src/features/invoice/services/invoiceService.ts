import { apiFetch } from "@/lib/api/client";
import type {
  Invoice,
  InvoiceItem,
  InvoicePayment,
} from "../types/invoice";

type ApiNumber = number | string | null;

interface ApiInvoiceItem {
  id: string;
  itemName: string | null;
  quantity: ApiNumber;
  unitPrice: ApiNumber;
  lineTotal: ApiNumber;
}

interface ApiInvoicePayment {
  id: string;
  tenderType: string | null;
  amount: ApiNumber;
  createdAt: string;
}

interface ApiInvoice {
  id: string;
  invoiceNumber: string | null;
  branchId: string;
  sessionId: string | null;
  subtotal: ApiNumber;
  discountAmount: ApiNumber;
  taxAmount: ApiNumber;
  serviceCharge: ApiNumber;
  total: ApiNumber;
  status: string | null;
  voidedInvoiceId: string | null;
  createdAt: string;
  items: ApiInvoiceItem[];
  payments: ApiInvoicePayment[];
}

const toNumber = (value: ApiNumber): number => Number(value ?? 0);

function toStatus(status: string | null): Invoice["status"] {
  switch (status?.toLowerCase()) {
    case "paid":
      return "PAID";
    case "void":
      return "VOIDED";
    default:
      return "PENDING";
  }
}

function toPaymentMethod(
  tenderType: string | null,
): InvoicePayment["paymentMethod"] {
  const normalized = tenderType?.toUpperCase();
  const supported: InvoicePayment["paymentMethod"][] = [
    "CASH",
    "CARD",
    "UDHAAR",
    "BANK_TRANSFER",
    "MOBILE_WALLET",
    "OTHER",
  ];

  return supported.includes(
    normalized as InvoicePayment["paymentMethod"],
  )
    ? (normalized as InvoicePayment["paymentMethod"])
    : "OTHER";
}

function toInvoiceItem(item: ApiInvoiceItem): InvoiceItem {
  return {
    id: item.id,
    description: item.itemName ?? "Invoice item",
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.lineTotal),
  };
}

function toInvoicePayment(payment: ApiInvoicePayment): InvoicePayment {
  return {
    id: payment.id,
    paymentMethod: toPaymentMethod(payment.tenderType),
    amount: toNumber(payment.amount),
    paidAt: payment.createdAt,
  };
}

function toInvoice(invoice: ApiInvoice): Invoice {
  const status = toStatus(invoice.status);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber ?? "Unnumbered",
    branchId: invoice.branchId,
    sessionId: invoice.sessionId ?? "",
    subtotal: toNumber(invoice.subtotal),
    discountAmount: toNumber(invoice.discountAmount),
    taxAmount: toNumber(invoice.taxAmount),
    serviceCharge: toNumber(invoice.serviceCharge),
    totalAmount: toNumber(invoice.total),
    status,
    isVoided: status === "VOIDED",
    voidedInvoiceId: invoice.voidedInvoiceId,
    createdAt: invoice.createdAt,
    updatedAt: invoice.createdAt,
    items: (invoice.items ?? []).map(toInvoiceItem),
    payments: (invoice.payments ?? []).map(toInvoicePayment),
  };
}

export const invoiceService = {
  async getInvoices(): Promise<Invoice[]> {
    const invoices = await apiFetch<ApiInvoice[]>("/billing/invoices");
    return invoices.map(toInvoice);
  },

  async getInvoice(id: string): Promise<Invoice> {
    const invoice = await apiFetch<ApiInvoice>(
      `/billing/invoices/${encodeURIComponent(id)}`,
    );
    return toInvoice(invoice);
  },

  voidInvoice(invoiceId: string) {
    return apiFetch<unknown>(
      `/billing/invoices/${encodeURIComponent(invoiceId)}/void`,
      { method: "PATCH" },
    );
  },

  addPayment(
    invoiceId: string,
    amount: number,
    _paymentMethod: "CASH" = "CASH",
  ) {
    return apiFetch<unknown>(
      `/billing/invoices/${encodeURIComponent(invoiceId)}/payments`,
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      },
    );
  },
};
