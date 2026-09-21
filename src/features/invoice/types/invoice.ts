export type InvoiceStatus =
  | "draft"
  | "open"
  | "partially_paid"
  | "paid"
  | "void";

export type TenderType =
  | "cash"
  | "card"
  | "udhaar"
  | "bank_transfer"
  | "mobile_wallet"
  | "other";

export interface InvoiceItem {
  id: string;
  itemType: string | null;
  sourceSessionId: string | null;
  sourceOrderItemId: string | null;
  itemName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoicePayment {
  id: string;
  payerLabel: string | null;
  tenderType: TenderType | null;
  amount: number;
  paymentReference: string | null;
  customerId: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  branchId: string;
  branch: {
    id: string;
    name: string | null;
    currency: string | null;
  };
  sessionId: string | null;
  session: {
    id: string;
    startedAt: string | null;
    endedAt: string | null;
    table: {
      id: string;
      tableNumber: string | null;
    } | null;
  } | null;
  customerId: string | null;
  customer: {
    id: string;
    fullName: string | null;
    phone: string | null;
    isBlocked?: boolean;
  } | null;
  subtotal: number;
  discountAmount: number;
  discountReasonCode: string | null;
  taxAmount: number;
  serviceCharge: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus | null;
  voidReason: string | null;
  voidedAt: string | null;
  voidedById: string | null;
  createdAt: string;
  updatedAt: string;
  receiptId: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface BillingTransaction {
  id: string;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: InvoiceStatus | null;
    branch: {
      name: string | null;
      currency: string | null;
    };
  };
  payerLabel: string | null;
  tenderType: TenderType | null;
  amount: number;
  paymentReference: string | null;
  createdAt: string;
}

export interface InvoiceListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  branchId?: string;
}

export interface RecordPaymentInput {
  amount: number;
  tenderType: TenderType;
  payerLabel?: string;
  paymentReference?: string;
}

export interface PaymentResult {
  invoice: Invoice;
  receiptId: string | null;
  cashDrawer: {
    mode: string;
    status: "disabled" | "simulated" | "opened" | "failed";
    physicallyOpened: boolean;
    message: string;
  } | null;
  cashDrawerAuditRecorded: boolean | null;
}
