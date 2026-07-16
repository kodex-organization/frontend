import { apiFetch } from "@/lib/api/client";
import { Receipt } from "../types/receipt";

export const receiptService = {
  async getReceiptsByInvoice(invoiceId: string): Promise<Receipt[]> {
    return apiFetch<Receipt[]>(`/receipts/invoice/${invoiceId}`);
  },

  async getReceipt(id: string): Promise<Receipt> {
    return apiFetch<Receipt>(`/receipts/${id}`);
  },

  async printReceipt(id: string): Promise<Receipt> {
    return apiFetch<Receipt>(`/receipts/${id}/print`, { method: "POST" });
  },
};