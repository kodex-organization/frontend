export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoicePayment {
  id: string;
  paymentMethod:
    | "CASH"
    | "CARD"
    | "UDHAAR"
    | "BANK_TRANSFER"
    | "MOBILE_WALLET"
    | "OTHER";
  amount: number;
  paidAt: string;
}

export interface Invoice {
  id: string;

  invoiceNumber: string | number;

  branchId: string;
  sessionId: string;

  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;

  totalAmount: number;

  status: "PENDING" | "PAID" | "VOIDED";

  isVoided: boolean;

  voidedInvoiceId?: string | null;

  createdAt: string;
  updatedAt: string;

  items: InvoiceItem[];

  payments: InvoicePayment[];
}
