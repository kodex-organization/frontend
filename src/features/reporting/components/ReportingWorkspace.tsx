"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  Edit3,
  X,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useConnectionStatus } from "@/lib/connectivity/online-status";
import { getPendingSyncCount } from "@/lib/sync/offline-db";
import { isNetworkFailure } from "@/lib/sync/offline-reference-cache";
import { OfflineSnapshotNotice } from "@/components/sync/offline-snapshot-notice";
import {
  fetchAging,
  fetchCashReconciliation,
  fetchMonthlySummary,
  fetchPeakHours,
  fetchReconciliation,
  fetchSealedReports,
  fetchShiftReport,
  fetchAllShifts,
  fetchSchedules,
  scheduleReport,
  downloadReport,
  fetchStaffPerformance,
  fetchTopCustomers,
  fetchTopItems,
  fetchZReport,
  sealDailyReport,
  correctSealedReport,
} from "../api";
import type { ReportTab, SealedReport, ScheduledReport } from "../types";
import {
  describeSavedFilters,
  readReportSnapshot,
  readSchedulesSnapshot,
  saveReportSnapshot,
  saveSchedulesSnapshot,
} from "../reports-offline";
import { prefetchReports } from "../reports-prefetch";

type ReportData = Record<string, unknown> | unknown[] | null;

type ShiftReportRow = {
  staffId?: string;
  staffName?: string;
  userId?: string;
  sessionCount?: number;
  invoiceCount?: number;
  totalSales?: number;
  totalDiscounts?: number;
  voidCount?: number;
  voidAmount?: number;
};

function rowsFromReport(data: ReportData): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];

  const report = data as Record<string, unknown>;
  for (const key of ["items", "customers", "staff", "rows", "data"]) {
    if (Array.isArray(report[key]))
      return report[key] as Record<string, unknown>[];
  }

  return [];
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500 shadow-sm">
      {message}
    </div>
  );
}

const tabs: Array<{
  id: ReportTab;
  label: string;
  description: string;
  roles?: string[];
}> = [
  {
    id: "z-report",
    label: "Daily Z-Report",
    description: "Closure, tenders and cash position",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "cash-reconciliation",
    label: "Cash Reconciliation",
    description: "Expected against counted cash",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "shift-report",
    label: "Shift Report",
    description: "Per-cashier sessions, sales and voids",
    roles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    id: "monthly-summary",
    label: "Monthly Summary",
    description: "Revenue trend by branch",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "udhaar-aging",
    label: "Udhaar Aging",
    description: "Outstanding credit buckets",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "top-customers",
    label: "Top Customers",
    description: "Spend and visit frequency",
    roles: ["OWNER", "MANAGER"],
  },
  {
    id: "top-items",
    label: "Top Items",
    description: "Canteen volume and revenue",
    roles: ["OWNER", "MANAGER"],
  },
  {
    id: "staff-performance",
    label: "Staff Performance",
    description: "Discount and void review",
    roles: ["OWNER", "MANAGER"],
  },
  {
    id: "peak-hours",
    label: "Peak Hours",
    description: "Session demand by time",
    roles: ["OWNER", "MANAGER"],
  },
  {
    id: "reconciliation",
    label: "Reconciliation",
    description: "Cross-module integrity",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "sealed-reports",
    label: "Sealed Reports",
    description: "Approved closures and corrections",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "schedules",
    label: "Scheduled Delivery",
    description: "Auto-email reports on a schedule",
    roles: ["OWNER", "MANAGER"],
  },
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const rangeTabs: ReportTab[] = [
  "shift-report",
  "staff-performance",
  "top-customers",
  "top-items",
  "peak-hours",
  "sealed-reports",
];

type DatePreset = "today" | "7d" | "30d" | "thisMonth" | "custom";

function getPresetRange(preset: Exclude<DatePreset, "custom">) {
  const now = new Date();
  const toStr = now.toISOString().slice(0, 10);
  if (preset === "today") return { from: toStr, to: toStr };
  if (preset === "7d") {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { from, to: toStr };
  }
  if (preset === "30d") {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { from, to: toStr };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  return { from, to: toStr };
}

const DEFAULT_PRESET_BY_TAB: Partial<
  Record<ReportTab, Exclude<DatePreset, "custom">>
> = {
  "peak-hours": "7d",
  "shift-report": "30d",
  "staff-performance": "30d",
  "top-customers": "30d",
  "top-items": "30d",
  "sealed-reports": "30d",
};

const PRESET_OPTIONS: { id: Exclude<DatePreset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "thisMonth", label: "This Month" },
];

const money = (value: unknown) =>
  `PKR ${Number(value ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ReportingWorkspace() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ReportTab>("z-report");
  const branchId = user?.branchId ?? "";
  const [date, setDate] = useState(today);

  const [fromDate, setFromDate] = useState(() => getPresetRange("30d").from);
  const [toDate, setToDate] = useState(today);
  const [activePreset, setActivePreset] = useState<DatePreset>("30d");
  const [cashCount, setCashCount] = useState("0");
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [data, setData] = useState<ReportData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ savedAt: string; scopeNote: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const connection = useConnectionStatus();
  const serverUnavailable = connection === "offline" || snapshot !== null;
  const [sealing, setSealing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionType, setCorrectionType] = useState<"revenue" | "udhaar">(
    "revenue",
  );
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [newScheduleFormat, setNewScheduleFormat] = useState<
    "pdf" | "excel" | "both"
  >("pdf");
  const [newScheduleMessage, setNewScheduleMessage] = useState("");
  const [newScheduleEmail, setNewScheduleEmail] = useState("");
  const [newScheduleType, setNewScheduleType] = useState<
    "daily_closure" | "weekly_summary" | "monthly_summary" | "custom"
  >("daily_closure");
  const [newScheduleHour, setNewScheduleHour] = useState("21");
  const [newScheduleMinute, setNewScheduleMinute] = useState("0");
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  const requestVersion = useRef(0);

  const isManagement =
    user?.roles?.some((role) => ["OWNER", "MANAGER"].includes(role)) ?? false;

  const visibleTabs = useMemo(() => {
    const userRoles = user?.roles ?? [];

    if (userRoles.includes("CASHIER")) {
      return tabs.filter((item) => item.id === "shift-report");
    }

    return tabs.filter(
      (item) =>
        !item.roles ||
        userRoles.some((userRole) => item.roles!.includes(userRole)),
    );
  }, [user?.roles]);

  const selected = useMemo(() => tabs.find((item) => item.id === tab)!, [tab]);

  useEffect(() => {
    const stillVisible = visibleTabs.some((item) => item.id === tab);
    if (!stillVisible && visibleTabs.length > 0) setTab(visibleTabs[0].id);
  }, [visibleTabs, tab]);

  useEffect(() => {
    const defaultPreset = DEFAULT_PRESET_BY_TAB[tab];
    if (!defaultPreset) return;
    const range = getPresetRange(defaultPreset);
    setFromDate(range.from);
    setToDate(range.to);
    setActivePreset(defaultPreset);
  }, [tab]);

  const loadReport = async () => {
    if (tab === "schedules") return;
    const requestVersionAtStart = ++requestVersion.current;
    const params = { date, from: fromDate, to: toDate };
    setLoading(true);
    setError(null);
    if (branchId && !uuidPattern.test(branchId)) {
      setData(null);
      setError(
        "Branch ID must be a valid UUID. Select a valid branch identifier.",
      );
      setLoading(false);
      return;
    }
    if (
      ["z-report", "cash-reconciliation", "reconciliation"].includes(tab) &&
      !branchId
    ) {
      setData(null);
      setError("Please select or enter a branch UUID to view this report.");
      setLoading(false);
      return;
    }
    try {
      let result: unknown;
      if (tab === "z-report") result = await fetchZReport(branchId, date);
      if (tab === "cash-reconciliation")
        result = await fetchCashReconciliation(
          branchId,
          date,
          Number(cashCount),
          openingCashInput ? Number(openingCashInput) : undefined,
        );
      if (tab === "monthly-summary")
        result = await fetchMonthlySummary(
          branchId || undefined,
          new Date(`${date}T00:00:00`).getFullYear(),
          new Date(`${date}T00:00:00`).getMonth() + 1,
        );
      if (tab === "udhaar-aging")
        result = await fetchAging(branchId || undefined);
      const rangeFrom = `${fromDate}T00:00:00.000Z`;
      const rangeTo = `${toDate}T23:59:59.999Z`;
      if (tab === "top-customers")
        result = await fetchTopCustomers(
          branchId || undefined,
          rangeFrom,
          rangeTo,
        );
      if (tab === "top-items")
        result = await fetchTopItems(branchId || undefined, rangeFrom, rangeTo);
      if (tab === "staff-performance")
        result = await fetchStaffPerformance(
          branchId || undefined,
          rangeFrom,
          rangeTo,
        );
      if (tab === "peak-hours")
        result = await fetchPeakHours(branchId || undefined, rangeFrom, rangeTo);

      if (tab === "reconciliation")
        result = await fetchReconciliation(branchId, date);
      if (tab === "shift-report") {
        if (isManagement) {
          result = await fetchAllShifts(
            branchId || undefined,
            rangeFrom,
            rangeTo,
          );
        } else if (user?.id) {
          result = await fetchShiftReport(user.id, rangeFrom, rangeTo);
        }
      }
      if (tab === "sealed-reports") {
        result = await fetchSealedReports(
          branchId || undefined,
          fromDate,
          toDate,
        );
      }
      setData(result as ReportData);
      if (requestVersionAtStart === requestVersion.current) setSnapshot(null);
      void saveReportSnapshot(user?.id ?? "", branchId, tab, params, result);
    } catch (cause) {
      if (requestVersionAtStart !== requestVersion.current) return;
      if (isNetworkFailure(cause)) {
        // Offline: show the last saved report, never a fake zero.
        const saved = await readReportSnapshot(user?.id ?? "", branchId, tab, params);
        if (requestVersionAtStart !== requestVersion.current) return;
        if (saved) {
          setData(saved.data as ReportData);
          setSnapshot({
            savedAt: saved.savedAt,
            scopeNote: saved.exact ? "" : describeSavedFilters(tab, saved.params),
          });
          try {
            setPendingCount(await getPendingSyncCount());
          } catch {
            setPendingCount(0);
          }
          return;
        }
        setSnapshot(null);
        setData(null);
        setError(
          "You are offline and no saved copy of this report exists on this device yet. Open this report once while online, then it will be available offline.",
        );
        return;
      }
      setSnapshot(null);
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load report data.",
      );
      setData(null);
    } finally {
      if (requestVersionAtStart === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    if (tab === "schedules") return;
    if (
      !branchId &&
      ["z-report", "cash-reconciliation", "reconciliation"].includes(tab)
    )
      return;
    void loadReport();
  }, [tab, branchId, date, fromDate, toDate, user?.id]);

  const applyPreset = (preset: Exclude<DatePreset, "custom">) => {
    const range = getPresetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setActivePreset(preset);
  };

  const loadSchedules = async () => {
    setSchedulesLoading(true);
    setError(null);
    try {
      const result = await fetchSchedules();
      setSchedules(result);
      setSnapshot(null);
      void saveSchedulesSnapshot(user?.id ?? "", result);
    } catch (cause) {
      if (isNetworkFailure(cause)) {
        const saved = await readSchedulesSnapshot(user?.id ?? "");
        if (saved) {
          setSchedules(saved.data);
          setSnapshot({ savedAt: saved.savedAt, scopeNote: "" });
          try {
            setPendingCount(await getPendingSyncCount());
          } catch {
            setPendingCount(0);
          }
        } else {
          setSnapshot(null);
          setError(
            "You are offline and no saved schedules exist on this device yet. Open this tab once while online.",
          );
        }
        return;
      }
      setSnapshot(null);
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load schedules.",
      );
    } finally {
      setSchedulesLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "schedules") return;
    setLoading(false);
    setData(null);
    void loadSchedules();
  }, [tab]);

  useEffect(() => {
    if (connection !== "online" || !snapshot) return;
    if (tab === "schedules") void loadSchedules();
    else void loadReport();
  }, [connection]);

  useEffect(() => {
    if (connection !== "online" || loading || error || snapshot || !user?.id) return;
    if (branchId && !uuidPattern.test(branchId)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void prefetchReports({
        userId: user.id,
        branchId,
        tabs: visibleTabs.map((item) => item.id),
        skip: tab,
        isManagement,
        date,
        cashCount: Number(cashCount),
        openingCash: openingCashInput ? Number(openingCashInput) : undefined,
        rangeFor: (target) => {
          const preset = DEFAULT_PRESET_BY_TAB[target];
          return preset ? getPresetRange(preset) : { from: fromDate, to: toDate };
        },
        isCancelled: () => cancelled,
      });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connection, loading, error, snapshot, user?.id, branchId, date]);

  const createSchedule = async () => {
    if (!newScheduleEmail.trim()) return;
    setCreatingSchedule(true);
    setError(null);
    try {
      await scheduleReport({
        reportType: newScheduleType,
        recipientEmail: newScheduleEmail,
        scheduleCron: `${newScheduleMinute} ${newScheduleHour}`,
        format: newScheduleFormat,
        message: newScheduleMessage.trim() || undefined,
      });
      setNewScheduleEmail("");
      setNewScheduleMessage("");
      await loadSchedules();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to create schedule.",
      );
    } finally {
      setCreatingSchedule(false);
    }
  };

  const seal = async () => {
    setSealing(true);
    setError(null);
    try {
      await sealDailyReport(branchId, date, Number(cashCount));
      await loadReport();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to seal this report.",
      );
    } finally {
      setSealing(false);
    }
  };

  const submitCorrection = async (reportId: string) => {
    if (!correctionReason.trim() || !correctionAmount) return;
    setSubmittingCorrection(true);
    setError(null);
    try {
      await correctSealedReport(reportId, {
        correctionType,
        ...(correctionType === "revenue"
          ? { revenueAdjustment: Number(correctionAmount) }
          : { udhaarAdjustment: Number(correctionAmount) }),
        reason: correctionReason,
      });
      setCorrectingId(null);
      setCorrectionReason("");
      setCorrectionAmount("");
      setCorrectionType("revenue");
      await loadReport();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to add correction.",
      );
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const EXPORT_REPORT_TYPE: Partial<Record<ReportTab, string>> = {
    "sealed-reports": "sealed-report",
  };

  const downloadSingleReport = async (
    report: SealedReport,
    format: "pdf" | "excel",
  ) => {
    const reportKey = `${report.id}-${format}`;
    setExportingReportId(reportKey);
    setError(null);
    try {
      const reportDateStr = report.reportDate
        ? new Date(report.reportDate).toISOString().slice(0, 10)
        : "";
      const blob = await downloadReport("sealed-report", format, {
        reportId: report.id,
        branchId: report.branchId,
        date: reportDateStr,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sealed-report-${reportDateStr || report.id}.${format === "pdf" ? "pdf" : "xlsx"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to export this report.",
      );
    } finally {
      setExportingReportId(null);
    }
  };

  const download = async (format: "pdf" | "excel") => {
    if (tab === "sealed-reports") {
      if (!selectedSealedReport) {
        setError("No sealed report is available to export.");
        return;
      }
      await downloadSingleReport(selectedSealedReport, format);
      return;
    }

    setExporting(format);
    setError(null);
    try {
      const exportReportType = EXPORT_REPORT_TYPE[tab] ?? tab;
      const blob = await downloadReport(exportReportType, format, {
        branchId,
        date,
        actualCashCounted: cashCount,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${tab}.${format === "pdf" ? "pdf" : "xlsx"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to export this report.",
      );
    } finally {
      setExporting(null);
    }
  };

  const zReport = data as {
    revenue?: number;
    sessionCount?: number;
    invoiceCount?: number;
    discounts?: number;
    voidAmount?: number;
    voidCount?: number;
    udhaarIssued?: number;
    udhaarReceived?: number;
    tenderBreakdown?: Record<string, number>;
    isSealed?: boolean;
    sealedReportId?: string | null;
    note?: string | null;
  } | null;

  const cashRecon = data as {
    openingCash?: number;
    cashTenderTotal?: number;
    expectedCash?: number;
    actualCashCounted?: number;
    discrepancy?: number;
    hasDiscrepancy?: boolean;
    isSealed?: boolean;
    hasUnreflectedCorrections?: boolean;
    transactions?: Array<{
      id: string;
      amount: number;
      invoiceId: string;
      createdAt: string;
    }>;
  } | null;

  const reconciliation = data as {
    reconciled?: boolean;
    invoiceTotal?: number;
    paymentTotal?: number;
    zReportRevenue?: number;
    isSealed?: boolean;
    discrepancies?: Array<{
      field: string;
      expected: number;
      actual: number;
      difference: number;
    }>;
    manualCorrections?: { count: number; total: number; note: string | null };
  } | null;

  const summary = data as {
    totalRevenue?: number;
    previousMonthRevenue?: number;
    trendPercent?: number | null;
    revenueByBranch?: Array<{ branchId: string; revenue: number }>;
    hasUnreflectedCorrections?: boolean;
    datesWithCorrections?: string[];
  } | null;

  const aging = data as {
    summary?: {
      totalOutstanding?: number;
      overdueBalance?: number;
      activeAccounts?: number;
      buckets?: {
        current?: number;
        days1to30?: number;
        days30to60?: number;
        days60to90?: number;
        days90plus?: number;
      };
    };
  } | null;

  const rankedRows = rowsFromReport(data);
  const sealedReports =
    Array.isArray(data) && tab === "sealed-reports"
      ? (data as SealedReport[])
      : [];

  const selectedSealedReport = useMemo(() => {
    if (tab !== "sealed-reports" || sealedReports.length === 0) return null;
    return (
      sealedReports.find((r) => r.id === selectedReportId) ??
      sealedReports[0] ??
      null
    );
  }, [tab, sealedReports, selectedReportId]);
  const shiftReportRows =
    tab === "shift-report" && Array.isArray(data)
      ? (data as ShiftReportRow[])
      : [];
  const ownShiftReport =
    tab === "shift-report" && data && !Array.isArray(data)
      ? (data as ShiftReportRow)
      : null;

  const snapshotNote = [
    snapshot?.scopeNote,
    pendingCount > 0
      ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} saved on this device ${pendingCount === 1 ? "is" : "are"} not included until ${pendingCount === 1 ? "it syncs" : "they sync"}.`
      : "",
    tab === "schedules"
      ? "Creating a schedule needs an internet connection."
      : "Exports, sealing and corrections need an internet connection.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-slate-50/60 text-slate-900 pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <BarChart3 size={15} /> Operations Intelligence
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Reports Desk
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Daily closure, tender reconciliations, credit aging, and operational staff audit.
            </p>
          </div>
          {serverUnavailable ? (
            <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 w-fit">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Offline · saved data only
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 w-fit">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live API Connected
            </div>
          )}
        </header>

        {/* Global Filter Bar */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Branch scope
              </label>
              <input
                value="Active branch (header)"
                readOnly
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm font-mono text-slate-800 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Report Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-800 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {rangeTabs.includes(tab) && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-800 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-800 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </>
            )}

            {(tab === "cash-reconciliation" || tab === "z-report") && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Actual Cash Counted
                </label>
                <input
                  type="number"
                  value={cashCount}
                  onChange={(event) => setCashCount(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-800 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}

            {tab === "cash-reconciliation" && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Opening Cash Override
                </label>
                <input
                  type="number"
                  value={openingCashInput}
                  onChange={(event) => setOpeningCashInput(event.target.value)}
                  placeholder="Auto from sealed report"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-800 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadReport()}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <RefreshCw size={15} /> Refresh Report
              </button>
            </div>
          </div>

          {rangeTabs.includes(tab) && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
                Quick Ranges:
              </span>
              {PRESET_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => applyPreset(option.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activePreset === option.id
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <span
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  activePreset === "custom"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                    : "border border-dashed border-slate-200 text-slate-400"
                }`}
              >
                Custom
              </span>
            </div>
          )}
        </section>

        {/* Content Area */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar Nav */}
          <nav
            className="h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm space-y-1"
            aria-label="Report Categories"
          >
            {visibleTabs.map((item) => {
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100/80"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span
                    className={`mt-0.5 block text-xs ${
                      isActive ? "text-indigo-100" : "text-slate-500"
                    }`}
                  >
                    {item.description}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Main Display */}
          <section className="min-w-0">
            {/* Action Bar */}
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Active Report
                </p>
                <h2 className="mt-0.5 text-2xl font-bold text-slate-900">
                  {selected.label}
                </h2>
                {tab === "sealed-reports" && selectedSealedReport && (
                  <p className="mt-1 text-xs text-slate-500">
                    Active archive: <strong className="text-slate-700">{new Date(selectedSealedReport.reportDate).toLocaleDateString()}</strong> · Reconciled: <span className="font-semibold text-slate-800">{money(selectedSealedReport.reconciledCash)}</span>
                  </p>
                )}
              </div>
              {tab !== "schedules" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => void download("pdf")}
                    disabled={exporting !== null || exportingReportId !== null || serverUnavailable}
                    title={serverUnavailable ? "Exports are created by the server and need an internet connection" : undefined}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download size={14} />{" "}
                    {exporting === "pdf" ? "Exporting..." : "PDF"}
                  </button>
                  <button
                    onClick={() => void download("excel")}
                    disabled={exporting !== null || exportingReportId !== null || serverUnavailable}
                    title={serverUnavailable ? "Exports are created by the server and need an internet connection" : undefined}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FileText size={14} />{" "}
                    {exporting === "excel" ? "Exporting..." : "Excel"}
                  </button>
                </div>
              )}
            </div>

            {snapshot && !loading && (
              <div className="mb-5">
                <OfflineSnapshotNotice savedAt={snapshot.savedAt} note={snapshotNote} />
              </div>
            )}

            {loading && (
              <div className="grid gap-4 min-[900px]:grid-cols-2 2xl:grid-cols-3">
                <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle size={18} /> Could not load report
                </div>
                <p className="mt-2 text-sm text-rose-700">{error}</p>
                <button
                  onClick={() => void loadReport()}
                  className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && data === null && tab !== "schedules" && (
              <EmptyState message="No data records match this criteria." />
            )}

            {/* Z-REPORT */}
            {!loading && !error && data && tab === "z-report" && (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
                  {[
                    ["Revenue", money(zReport?.revenue)],
                    ["Sessions", zReport?.sessionCount ?? 0],
                    ["Invoices", zReport?.invoiceCount ?? 0],
                    ["Discounts", money(zReport?.discounts)],
                    [
                      "Voids",
                      `${money(zReport?.voidAmount)} (${zReport?.voidCount ?? 0})`,
                    ],
                    ["Udhaar Issued", money(zReport?.udhaarIssued)],
                    ["Udhaar Received", money(zReport?.udhaarReceived)],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 whitespace-nowrap text-base font-bold tracking-tight text-slate-900 2xl:text-2xl">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900">Tender Breakdown</h3>
                    <div className="mt-4 space-y-4">
                      {Object.entries(zReport?.tenderBreakdown ?? {}).map(
                        ([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-sm">
                              <span className="capitalize text-slate-600 font-medium">
                                {key}
                              </span>
                              <span className="font-bold text-slate-900">{money(value)}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-indigo-600 transition-all duration-300"
                                style={{
                                  width: `${Math.min(100, (Number(value) / Math.max(1, Number(zReport?.revenue))) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <ShieldCheck size={18} className="text-indigo-600" /> Closure Status
                      </div>
                      <div className="mt-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            zReport?.isSealed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {zReport?.isSealed ? "Report Sealed" : "Open for Edits"}
                        </span>
                      </div>
                      {zReport?.note && (
                        <p className="mt-3 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {zReport.note}
                        </p>
                      )}
                    </div>
                    {!zReport?.isSealed && isManagement && (
                      <button
                        disabled={sealing || serverUnavailable}
                        onClick={() => void seal()}
                        className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {sealing ? "Sealing..." : "Seal Daily Report"}
                      </button>
                    )}
                    {zReport?.isSealed && isManagement && zReport?.sealedReportId && (
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectingId(zReport.sealedReportId || null);
                          setCorrectionType("revenue");
                          setCorrectionAmount("");
                          setCorrectionReason("");
                        }}
                        disabled={serverUnavailable}
                        className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit3 size={15} /> Add Report Correction
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CASH RECONCILIATION */}
            {!loading && !error && data && tab === "cash-reconciliation" && (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
                  {[
                    ["Opening Cash", money(cashRecon?.openingCash)],
                    ["Cash Collected", money(cashRecon?.cashTenderTotal)],
                    ["Expected Cash", money(cashRecon?.expectedCash)],
                    ["Counted Cash", money(cashRecon?.actualCashCounted)],
                    ["Discrepancy", money(cashRecon?.discrepancy)],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 whitespace-nowrap text-base font-bold text-slate-900 2xl:text-2xl">{value}</p>
                    </div>
                  ))}
                </div>

                {cashRecon?.hasUnreflectedCorrections && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    This day has post-seal manual corrections not reflected in the totals above. Check Sealed Reports for detail.
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-[640px] w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Time</th>
                        <th className="px-5 py-3.5">Invoice</th>
                        <th className="px-5 py-3.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(cashRecon?.transactions ?? []).map((txn) => (
                        <tr key={txn.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 text-slate-600">
                            {new Date(txn.createdAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                            {txn.invoiceId}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {money(txn.amount)}
                          </td>
                        </tr>
                      ))}
                      {(cashRecon?.transactions ?? []).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                            No cash transactions recorded for this date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SHIFT REPORT */}
            {!loading && !error && data && tab === "shift-report" && (
              isManagement ? (
                shiftReportRows.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-[760px] w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                        <tr>
                          <th className="px-5 py-3.5">Staff</th>
                          <th className="px-5 py-3.5">Sessions</th>
                          <th className="px-5 py-3.5">Invoices</th>
                          <th className="px-5 py-3.5">Sales</th>
                          <th className="px-5 py-3.5">Discounts</th>
                          <th className="px-5 py-3.5">Voids</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shiftReportRows.map((row, index) => (
                          <tr key={`${row.staffId}-${index}`} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {row.staffName}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">{row.sessionCount}</td>
                            <td className="px-5 py-3.5 text-slate-600">{row.invoiceCount}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {money(row.totalSales)}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {money(row.totalDiscounts)}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {row.voidCount}
                              {row.voidAmount ? ` (${money(row.voidAmount)})` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No shift activity found for this period." />
                )
              ) : (
                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
                  {[
                    ["Sessions", ownShiftReport?.sessionCount ?? 0],
                    ["Invoices", ownShiftReport?.invoiceCount ?? 0],
                    ["Total Sales", money(ownShiftReport?.totalSales)],
                    ["Discounts", money(ownShiftReport?.totalDiscounts)],
                    [
                      "Voids",
                      ownShiftReport?.voidCount
                        ? `${ownShiftReport.voidCount}${ownShiftReport.voidAmount ? ` (${money(ownShiftReport.voidAmount)})` : ""}`
                        : (ownShiftReport?.voidCount ?? 0),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 whitespace-nowrap text-base font-bold text-slate-900 2xl:text-2xl">{value}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* MONTHLY SUMMARY */}
            {!loading && !error && data && tab === "monthly-summary" && (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
                  {[
                    ["This Month", money(summary?.totalRevenue)],
                    ["Previous Month", money(summary?.previousMonthRevenue)],
                    [
                      "Trend Growth",
                      summary?.trendPercent === null || summary?.trendPercent === undefined
                        ? "No baseline"
                        : `${summary.trendPercent}%`,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 whitespace-nowrap text-base font-bold text-slate-900 2xl:text-2xl">{value}</p>
                    </div>
                  ))}
                </div>
                {(summary?.revenueByBranch?.length ?? 0) > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-[520px] w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                        <tr>
                          <th className="px-5 py-3.5">Branch UUID</th>
                          <th className="px-5 py-3.5">Recorded Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary?.revenueByBranch?.map((row) => (
                          <tr key={row.branchId} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                              {row.branchId}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {money(row.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* UDHAAR AGING */}
            {!loading && !error && data && tab === "udhaar-aging" && (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
                  {[
                    ["Total Outstanding", money(aging?.summary?.totalOutstanding)],
                    ["Overdue (90+ Days)", money(aging?.summary?.overdueBalance)],
                    ["Active Accounts", aging?.summary?.activeAccounts ?? 0],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 whitespace-nowrap text-base font-bold text-slate-900 2xl:text-2xl">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Aging Brackets</h3>
                  <div className="space-y-3">
                    {[
                      ["Current (0-30 days)", aging?.summary?.buckets?.current],
                      ["30–60 Days", aging?.summary?.buckets?.days30to60],
                      ["60–90 Days", aging?.summary?.buckets?.days60to90],
                      ["90+ Days (Overdue)", aging?.summary?.buckets?.days90plus],
                    ].map(([label, value]) => {
                      const numeric = Number(value ?? 0);
                      const max = Math.max(1, Number(aging?.summary?.totalOutstanding ?? 1));
                      return (
                        <div key={String(label)}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-slate-600 font-medium">{label}</span>
                            <span className="font-bold text-slate-900">{money(numeric)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-indigo-600"
                              style={{ width: `${Math.min(100, (numeric / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* RECONCILIATION */}
            {!loading && !error && data && tab === "reconciliation" && (
              <div className="space-y-6">
                <div
                  className={`rounded-xl border p-5 ${
                    reconciliation?.reconciled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {reconciliation?.reconciled ? (
                      <CheckCircle2 className="text-emerald-600" />
                    ) : (
                      <AlertTriangle className="text-rose-600" />
                    )}
                    {reconciliation?.reconciled ? "All Ledgers Reconciled" : "Discrepancy Detected"}
                  </div>
                  <p className="mt-1 text-xs opacity-80">
                    {reconciliation?.isSealed ? "Day closure is sealed." : "Day closure remains unsealed."}
                  </p>
                </div>

                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
                  {[
                    ["Invoice Total", money(reconciliation?.invoiceTotal)],
                    ["Payment Total", money(reconciliation?.paymentTotal)],
                    ["Z-Report Total", money(reconciliation?.zReportRevenue)],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 whitespace-nowrap text-base font-bold text-slate-900 2xl:text-2xl">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEALED REPORTS */}
            {!loading && !error && tab === "sealed-reports" && (
              sealedReports.length > 0 ? (
                <div className="space-y-4">
                  {sealedReports.map((report) => {
                    const isSelected = selectedSealedReport?.id === report.id;
                    const isDownloadingPdf = exportingReportId === `${report.id}-pdf`;
                    const isDownloadingExcel = exportingReportId === `${report.id}-excel`;
                    const reportDateFormatted = new Date(report.reportDate).toLocaleDateString();

                    return (
                      <article
                        key={report.id}
                        onClick={() => setSelectedReportId(report.id)}
                        className={`rounded-xl border p-5 shadow-sm transition cursor-pointer ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/25 ring-2 ring-indigo-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900">
                                {reportDateFormatted}
                              </h3>
                              <span className="font-mono text-xs font-normal text-slate-400">
                                {report.branchId}
                              </span>
                              {isSelected && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Reconciled: {money(report.reconciledCash)} · Sealed:{" "}
                              {report.sealedAt ? new Date(report.sealedAt).toLocaleString() : "-"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void downloadSingleReport(report, "pdf");
                              }}
                              disabled={exporting !== null || exportingReportId !== null || serverUnavailable}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50"
                              title={`Download PDF for ${reportDateFormatted}`}
                            >
                              <Download size={13} /> {isDownloadingPdf ? "Exporting..." : "PDF"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void downloadSingleReport(report, "excel");
                              }}
                              disabled={exporting !== null || exportingReportId !== null || serverUnavailable}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50"
                              title={`Download Excel for ${reportDateFormatted}`}
                            >
                              <FileText size={13} /> {isDownloadingExcel ? "Exporting..." : "Excel"}
                            </button>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                              <ShieldCheck size={14} /> Approved
                            </span>
                            {isManagement && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCorrectingId(report.id);
                                  setCorrectionType("revenue");
                                  setCorrectionAmount("");
                                  setCorrectionReason("");
                                }}
                                disabled={serverUnavailable}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 shadow-xs transition hover:bg-amber-100 hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Add a subsequent correction to this report"
                              >
                                <Edit3 size={13} /> Add Correction
                              </button>
                            )}
                          </div>
                        </div>
                        {report.items && report.items.filter((item) => item.label?.startsWith("CORRECTION")).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                              <AlertTriangle size={12} /> Applied Corrections:
                            </span>
                            <div className="space-y-1">
                              {report.items
                                .filter((item) => item.label?.startsWith("CORRECTION"))
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-xs bg-amber-50/70 border border-amber-200/60 rounded px-2.5 py-1 text-slate-700"
                                  >
                                    <span className="font-medium text-slate-800">{item.label}</span>
                                    <span className={`font-mono font-bold ${(item.amount ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                      {(item.amount ?? 0) >= 0 ? `+${money(item.amount)}` : money(item.amount)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No sealed reports found for this branch." />
              )
            )}

            {/* TOP CUSTOMERS */}
            {!loading && !error && data && tab === "top-customers" && (
              rankedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Customer</th>
                        <th className="px-5 py-3.5">Phone</th>
                        <th className="px-5 py-3.5">Total Spend</th>
                        <th className="px-5 py-3.5">Visits</th>
                        <th className="px-5 py-3.5">Outstanding Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankedRows.map((item, index) => (
                        <tr key={String(item.customerId ?? index)} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {String(item.fullName ?? "Walk-in Customer")}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {String(item.phone ?? "-")}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {money(item.totalSpend)}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">
                            {Number(item.visitCount ?? 0)}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-700">
                            {money(item.outstandingUdhaar)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No customer rankings available." />
              )
            )}

            {/* TOP ITEMS */}
            {!loading && !error && data && tab === "top-items" && (
              rankedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-[560px] w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Item Name</th>
                        <th className="px-5 py-3.5">Quantity Sold</th>
                        <th className="px-5 py-3.5">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankedRows.map((item, index) => (
                        <tr key={String(item.name ?? index)} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {String(item.name ?? "Item")}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{Number(item.quantity ?? 0)}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">{money(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No item activity recorded." />
              )
            )}

            {/* STAFF PERFORMANCE */}
            {!loading && !error && data && tab === "staff-performance" && (
              rankedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Staff</th>
                        <th className="px-5 py-3.5">Discounts</th>
                        <th className="px-5 py-3.5">Voids</th>
                        <th className="px-5 py-3.5">Void Value</th>
                        <th className="px-5 py-3.5">Integrity Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankedRows.map((item, index) => (
                        <tr key={String(item.staffId ?? index)} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {String(item.staffName ?? "Staff Member")}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">
                            {money(item.discountTotal)} ({Number(item.discountCount ?? 0)})
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{Number(item.voidCount ?? 0)}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">{money(item.voidAmount)}</td>
                          <td className="px-5 py-3.5">
                            {item.flaggedForReview ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                                <AlertTriangle size={12} /> Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No staff audit metrics found." />
              )
            )}

            {/* PEAK HOURS */}
            {!loading && !error && data && tab === "peak-hours" && (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Sessions by Hour</h3>
                  {Object.entries(
                    (data as { byHour: Record<string, number> }).byHour ?? {},
                  ).map(([hour, value]) => (
                    <div key={hour} className="mt-3 flex items-center gap-3 text-sm">
                      <span className="w-12 font-mono text-xs text-slate-500">{hour}:00</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-indigo-600"
                          style={{ width: `${Math.min(100, Number(value) * 10)}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Sessions by Day</h3>
                  {Object.entries(
                    (data as { byDayOfWeek: Record<string, number> }).byDayOfWeek ?? {},
                  ).map(([day, value]) => (
                    <div key={day} className="mt-3 flex items-center gap-3 text-sm">
                      <span className="w-12 text-xs font-semibold text-slate-500">
                        {dayNames[Number(day)] ?? day}
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-indigo-600"
                          style={{ width: `${Math.min(100, Number(value) * 10)}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCHEDULES */}
            {tab === "schedules" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Configure Auto Delivery</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Report Type
                      </label>
                      <select
                        value={newScheduleType}
                        onChange={(event) =>
                          setNewScheduleType(
                            event.target.value as
                              | "daily_closure"
                              | "weekly_summary"
                              | "monthly_summary"
                              | "custom",
                          )
                        }
                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="daily_closure">Daily Closure</option>
                        <option value="weekly_summary">Weekly Summary</option>
                        <option value="monthly_summary">Monthly Summary</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={newScheduleEmail}
                        onChange={(event) => setNewScheduleEmail(event.target.value)}
                        placeholder="manager@club.com"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                  <button
                    disabled={creatingSchedule || serverUnavailable}
                    onClick={() => void createSchedule()}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {creatingSchedule ? "Saving..." : "Create Schedule"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Correction Modal */}
      {correctingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add Report Correction
                  </h3>
                  <p className="text-xs text-slate-500">
                    Audit adjustment for sealed closure
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCorrectingId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle size={14} /> Immutable Sealed Report
              </p>
              <p>
                Once sealed, the base report figures remain locked. Corrections are appended as separate audited entries and reflected in reconciliations.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitCorrection(correctingId);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Adjustment Type
                </label>
                <select
                  value={correctionType}
                  onChange={(e) => setCorrectionType(e.target.value as "revenue" | "udhaar")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="revenue">Revenue Adjustment (Cash / Sales)</option>
                  <option value="udhaar">Udhaar Adjustment (Credit balance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Adjustment Amount
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 500 or -250"
                  value={correctionAmount}
                  onChange={(e) => setCorrectionAmount(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Use positive numbers to add revenue/credit, or negative numbers to deduct.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Reason & Audit Justification
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this correction is required for the audit trail..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCorrectingId(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection || !correctionReason.trim() || !correctionAmount}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {submittingCorrection ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Apply Correction"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}