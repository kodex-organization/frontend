import { apiFetch } from "@/lib/api/client";

export type TenderType =
  | "cash"
  | "card"
  | "udhaar"
  | "bank_transfer"
  | "mobile_wallet"
  | "other";

export interface SplitPaymentTenderInput {
  tenderType: TenderType;
  amount: number;
  payerLabel?: string | null;
  paymentReference?: string | null;
  customerId?: string | null;
}

export interface SplitPaymentRequest {
  invoiceId: string;
  totalAmount: number;
  tenders: SplitPaymentTenderInput[];
  customerId?: string | null;
  customerCnic?: string | null;
  managerPin?: string | null;
}

export interface SplitPaymentResponse {
  invoiceId: string;
  totalAmount: number;
  status: string;
  tenders: Array<{
    id: string;
    tenderType: TenderType;
    amount: number;
    paymentReference?: string | null;
  }>;
}

export async function submitSplitPayment(
  payload: SplitPaymentRequest,
): Promise<SplitPaymentResponse> {
  // Ensure Udhaar tender items carry customerId if provided at root level
  const tendersWithCustomer = payload.tenders.map((tender) => {
    if (
      (tender.tenderType === "udhaar" || (tender.tenderType as string) === "credit") &&
      !tender.customerId &&
      payload.customerId
    ) {
      return { ...tender, customerId: payload.customerId };
    }
    return tender;
  });

  return apiFetch<SplitPaymentResponse>(
    `/payments/invoices/${payload.invoiceId}/split-payment`,
    {
      method: "POST",
      body: JSON.stringify({
        totalAmount: payload.totalAmount,
        tenders: tendersWithCustomer,
        customerId: payload.customerId,
        customerCnic: payload.customerCnic,
        managerPin: payload.managerPin,
      }),
    },
  );
}