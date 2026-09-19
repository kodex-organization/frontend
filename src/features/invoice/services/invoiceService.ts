import { apiFetch } from "@/lib/api/client";
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

export const invoiceService = {
  getInvoices(filters: InvoiceListFilters = {}) {
    return apiFetch<Paginated<Invoice>>(
      `/billing/invoices${toQuery(filters)}`,
    );
  },

  getInvoice(id: string) {
    return apiFetch<Invoice>(
      `/billing/invoices/${encodeURIComponent(id)}`,
    );
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
        method: "POST", // <-- Changed from "PATCH" to "POST"
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

  addPayment(invoiceId: string, input: RecordPaymentInput) {
    return apiFetch<PaymentResult>(
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
  },
};