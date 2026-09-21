export type ReportTab =
  | "z-report"
  | "cash-reconciliation"
  | "shift-report"
  | "monthly-summary"
  | "udhaar-aging"
  | "top-customers"
  | "top-items"
  | "staff-performance"
  | "peak-hours"
  | "reconciliation"
  | "sealed-reports"
  | "schedules";

export interface DailyZReport {
  branchId: string;
  date: string;
  revenue: number;
  tenderBreakdown: Record<string, number>;
  voids: number;
  discounts: number;
  udhaarIssued: number;
  udhaarReceived: number;
  sessionCount: number;
  invoiceCount: number;
  isSealed: boolean;
  sealedReportId: string | null;
}

export interface CashReconciliation {
  branchId: string;
  date: string;
  expectedCash: number;
  actualCashCounted: number;
  discrepancy: number;
  hasDiscrepancy: boolean;
  transactions: Array<{ id: string; invoiceId: string; amount: number; createdAt: string }>;
}

export interface MonthlySummary {
  year: number;
  month: number;
  totalRevenue: number;
  previousMonthRevenue: number;
  trendPercent: number | null;
  revenueByBranch: Array<{ branchId: string; revenue: number }>;
}

export interface AgingReport {
  summary: {
    totalOutstanding: number;
    overdueBalance: number;
    activeAccounts: number;
    buckets: Record<string, number>;
  };
}

export interface RankedRow {
  name?: string;
  fullName?: string;
  quantity?: number;
  revenue?: number;
  totalSpend?: number;
  visitCount?: number;
  outstandingUdhaar?: number;
  discountTotal?: number;
  discountCount?: number;
  voidCount?: number;
  voidAmount?: number;
  flaggedForReview?: boolean;
  staffId?: string;
  staffName?: string;
  staffEmail?: string | null;
}

export interface PeakHoursReport {
  totalSessions: number;
  byHour: Record<string, number>;
  byDayOfWeek: Record<string, number>;
}

export interface ReconciliationReport {
  reconciled: boolean;
  invoiceTotal: number;
  paymentTotal: number;
  zReportRevenue: number;
  discrepancies: Array<{ field: string; expected: number; actual: number; difference: number }>;
}

export interface SealedReport {
  id: string;
  branchId: string;
  reportDate: string;
  openingCash: number | null;
  voidsTotal: number | null;
  discountsTotal: number | null;
  udhaarIssued: number | null;
  udhaarReceived: number | null;
  reconciledCash: number | null;
  approvedById: string | null;
  sealedAt: string | null;
  items: Array<{ id: string; label: string | null; amount: number | null; breakdownType: string | null }>;
  netReconciledCash?: number;
  correctionsAreAnnotationOnly?: boolean;
  correctionBreakdown?: {
    revenueCorrections: number;
    openingCashCorrections: number;
    udhaarCorrections: number;
  };
}

export type ShiftReport = {
  userId?: string;
  staffId?: string;
  staffName?: string;
  from: string;
  to: string;
  sessionCount: number;
  invoiceCount: number;
  totalSales: number;
  totalDiscounts: number;
  voidCount: number;
  voidAmount?: number;
};

export type ScheduledReport = {
  id: string;
  tenantId: string;
  reportType: string;
  recipientEmail: string;
  scheduleCron: string;
  lastSentAt: string | null;
};