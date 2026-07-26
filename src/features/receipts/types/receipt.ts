export type MoneyValue = string | number | null;

export interface ReceiptSummary {
  id: string;
  invoiceId: string;
  printedAt: string | null;
  electronicCopyPath: string | null;
  printCount: number;
  lastPrintStatus: string | null;
  lastPrintMode: string | null;
  lastReprintReason: string | null;
  printReservationId: string | null;
  printReservationExpiresAt: string | null;
  originalPrintSnapshotSource: string | null;
}

export interface ReceiptInvoiceItem {
  id: string;
  itemName: string | null;
  quantity: MoneyValue;
  unitPrice: MoneyValue;
  lineTotal: MoneyValue;
}

export interface ReceiptInvoicePayment {
  id: string;
  tenderType: string | null;
  amount: MoneyValue;
  createdAt: string;
}

export interface ReceiptInvoice {
  id: string;
  invoiceNumber: string | null;
  createdAt: string;
  status: string | null;
  subtotal: MoneyValue;
  discountAmount: MoneyValue;
  taxAmount: MoneyValue;
  serviceCharge: MoneyValue;
  total: MoneyValue;
  branch: {
    id: string;
    name: string | null;
    address: string | null;
    currency: string | null;
  };
  session: {
    id: string;
    table: {
      tableNumber: string | number | null;
    } | null;
  } | null;
  items: ReceiptInvoiceItem[];
  payments: ReceiptInvoicePayment[];
}

export interface ReceiptAuditDetails {
  printCount?: number;
  isReprint?: boolean;
  reprintReason?: string | null;
  performedByUserId?: string;
  printerMode?: string;
  printStatus?: string;
  physicallyPrinted?: boolean;
  artifactName?: string | null;
  cashDrawerStatus?: string;
  cashDrawerMode?: string;
  physicallyOpened?: boolean;
  failureCode?: string;
  failureMessage?: string;
}

export interface ReceiptPrintHistoryEntry {
  id: string;
  actionType: string | null;
  occurredAt: string | null;
  actor: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  details: ReceiptAuditDetails | null;
}

export interface Receipt extends ReceiptSummary {
  invoice: ReceiptInvoice;
  printHistory: ReceiptPrintHistoryEntry[];
}

export interface PrintExecution {
  mode: "disabled" | "development";
  status: "simulated" | "printed";
  physicallyPrinted: boolean;
  artifactName: string | null;
  printSequence: number;
  isReprint: boolean;
}

export interface CashDrawerExecution {
  mode: "disabled" | "development";
  status: "disabled" | "simulated" | "opened" | "failed" | "not_requested";
  physicallyOpened: boolean;
  message: string;
}

export interface PrintReceiptResult {
  receipt: Receipt;
  print: PrintExecution;
  cashDrawer: CashDrawerExecution;
}
