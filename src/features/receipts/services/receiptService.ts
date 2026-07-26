import { apiFetch } from "@/lib/api/client";
import type {
  PrintReceiptResult,
  Receipt,
  ReceiptSummary,
} from "../types/receipt";

export const receiptService = {
  async getReceiptsByInvoice(invoiceId: string): Promise<ReceiptSummary[]> {
    return apiFetch<ReceiptSummary[]>(`/receipts/invoice/${invoiceId}`);
  },

  async ensureReceiptForInvoice(invoiceId: string): Promise<ReceiptSummary> {
    return apiFetch<ReceiptSummary>(`/receipts/invoice/${invoiceId}`, {
      method: "POST",
    });
  },

  async getReceipt(id: string): Promise<Receipt> {
    return apiFetch<Receipt>(`/receipts/${id}`);
  },

  async printReceipt(
    id: string,
    reprintReason?: string,
  ): Promise<PrintReceiptResult> {
    return apiFetch<PrintReceiptResult>(`/receipts/${id}/print`, {
      method: "POST",
      body: JSON.stringify({
        ...(reprintReason ? { reprintReason } : {}),
      }),
    });
  },
};
