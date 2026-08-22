export interface CustomerSummary {
  id: string;
  fullName: string | null;
  phone: string | null;
}

export interface CustomerBalance {
  customer: CustomerSummary;
  outstandingBalance: number;
}

export type UdhaarEntryType = "debit" | "credit" | "adjustment";

export interface LedgerEntry {
  id: string;
  entryType: UdhaarEntryType;
  amount: number;
  runningBalance: number;
  reason: string | null;
  invoicePaymentId: string | null;
  invoice: {
    id: string;
    paymentReference: string | null;
  } | null;
  createdBy: {
    id: string;
    fullName: string | null;
  } | null;
  createdByDevice: {
    id: string;
    deviceName: string | null;
  } | null;
  createdAt: string;
}

export interface SettlementInput {
  customerId: string;
  amount: number;
  invoiceId?: string;
  reason: string;
}

export interface SettlementResult {
  entry: LedgerEntry;
  customerId: string;
  outstandingBalance: number;
}

export interface ThresholdSettings {
  individualLimit: number | null;
  aggregateLimit: number | null;
  branchId: string;
}
