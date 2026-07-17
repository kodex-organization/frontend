export interface InvoiceItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoicePayment {
  id: string;
  tenderType: "cash";
  amount: number;
  createdAt: string;
}

export interface Invoice {
  id: string;

  invoiceNumber: number | null;

  branchId: string;
  sessionId: string | null;
  customerId?: string | null;

  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;

  total: number;

  status: "open" | "paid" | "void";

  createdAt: string;

  items: InvoiceItem[];

  payments: InvoicePayment[];
}