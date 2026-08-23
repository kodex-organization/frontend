import { apiFetch, apiFetchBlob } from "@/lib/api/client";
import type {
  AgingReport,
  CashReconciliation,
  DailyZReport,
  MonthlySummary,
  PeakHoursReport,
  RankedRow,
  ReconciliationReport,
  ScheduledReport,
  SealedReport,
  ShiftReport,
} from "./types";

const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
};

export const fetchZReport = (branchId: string, date: string) =>
  apiFetch<DailyZReport>(`/reporting/z-report?${query({ branchId, date })}`);

export const fetchCashReconciliation = (
  branchId: string,
  date: string,
  actualCashCounted: number,
  openingCash?: number,
) =>
  apiFetch<CashReconciliation>(
    `/reporting/cash-reconciliation?${query({ branchId, date, actualCashCounted, openingCash })}`,
  );

export const fetchMonthlySummary = (
  branchId: string | undefined,
  year: number,
  month: number,
) =>
  apiFetch<MonthlySummary>(
    `/reporting/monthly-summary?${query({ branchId, year, month })}`,
  );

export const fetchAging = (branchId?: string) =>
  apiFetch<AgingReport>(`/reporting/udhaar-aging?${query({ branchId })}`);

export const fetchTopCustomers = (
  branchId?: string,
  from?: string,
  to?: string,
) =>
  apiFetch<RankedRow[]>(
    `/reporting/top-customers?${query({ branchId, limit: 10, from, to })}`,
  );

export const fetchTopItems = (branchId?: string, from?: string, to?: string) =>
  apiFetch<RankedRow[]>(
    `/reporting/top-items?${query({ branchId, limit: 10, from, to })}`,
  );

export const fetchStaffPerformance = (
  branchId?: string,
  from?: string,
  to?: string,
) =>
  apiFetch<RankedRow[]>(
    `/reporting/staff-performance?${query({ branchId, from, to })}`,
  );

export const fetchPeakHours = (branchId?: string, from?: string, to?: string) =>
  apiFetch<PeakHoursReport>(
    `/reporting/peak-hours?${query({ branchId, from, to })}`,
  );

export const fetchReconciliation = (branchId: string, date: string) =>
  apiFetch<ReconciliationReport>(
    `/reporting/reconciliation?${query({ branchId, date })}`,
  );

export const fetchSealedReports = (
  branchId?: string,
  from?: string,
  to?: string,
) =>
  apiFetch<SealedReport[]>(
    `/reporting/z-report/sealed/all?${query({ branchId, from, to })}`,
  );

export const fetchShiftReport = (userId: string, from: string, to: string) =>
  apiFetch<ShiftReport>(
    `/reporting/shift-report?${query({ userId, from, to })}`,
  );

// All staff shifts (Manager/Owner only)
export const fetchAllShifts = (
  branchId: string | undefined,
  from: string,
  to: string,
) =>
  apiFetch<ShiftReport[]>(
    `/reporting/shift-report/all?${query({ branchId, from, to })}`,
  );

export const sealDailyReport = (
  branchId: string,
  date: string,
  openingCash: number,
) =>
  apiFetch<DailyZReport>("/reporting/z-report/seal", {
    method: "POST",
    body: JSON.stringify({ branchId, date, openingCash }),
  });

export const reportExportUrl = (
  reportType: string,
  format: "pdf" | "excel",
  values: Record<string, string | number | undefined>,
) => {
  const base = process.env.NEXT_PUBLIC_API_URL;
  return `${base}/reporting/export?${query({ reportType, format, ...values })}`;
};

export const downloadReport = async (
  reportType: string,
  format: "pdf" | "excel",
  values: Record<string, string | number | undefined>,
) =>
  apiFetchBlob(`/reporting/export?${query({ reportType, format, ...values })}`);

export const correctSealedReport = (
  reportId: string,
  values: {
    correctionType: "revenue" | "udhaar";
    revenueAdjustment?: number;
    udhaarAdjustment?: number;
    reason: string;
  },
) =>
  apiFetch<SealedReport>("/reporting/z-report/correct", {
    method: "POST",
    body: JSON.stringify({ reportId, ...values }),
  });

//Scheduled Email Delivery
export const fetchSchedules = () =>
  apiFetch<ScheduledReport[]>("/reporting/schedules");

export const scheduleReport = (values: {
  reportType: string;
  recipientEmail: string;
  scheduleCron: string;
  format?: "pdf" | "excel" | "both";
  message?: string;
}) =>
  apiFetch<ScheduledReport>("/reporting/schedules", {
    method: "POST",
    body: JSON.stringify(values),
  });
