"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
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
    <div className="rounded-2xl border border-dashed border-[#b8cbc2] bg-white p-10 text-center text-sm text-[#617972]">
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
  const [branchId, setBranchId] = useState(user?.branchId ?? "");
  const [date, setDate] = useState(today);

  const [fromDate, setFromDate] = useState(() => getPresetRange("30d").from);
  const [toDate, setToDate] = useState(today);
  const [activePreset, setActivePreset] = useState<DatePreset>("30d");
  const [cashCount, setCashCount] = useState("0");
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [data, setData] = useState<ReportData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
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
    if (user?.branchId) setBranchId((current) => current || user.branchId);
  }, [user?.branchId]);

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
    setLoading(true);
    setError(null);
    if (branchId && !uuidPattern.test(branchId)) {
      setData(null);
      setError(
        "Branch ID must be a valid UUID. Use the branch UUID, not its number or name.",
      );
      setLoading(false);
      return;
    }
    if (
      ["z-report", "cash-reconciliation", "reconciliation"].includes(tab) &&
      !branchId
    ) {
      setData(null);
      setError("Enter a branch UUID before loading this report.");
      setLoading(false);
      return;
    }
    try {
      let result: unknown;
      const dayFrom = `${date}T00:00:00.000Z`;
      const dayTo = `${date}T23:59:59.999Z`;

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
        const from = new Date(
          new Date(date).getFullYear(),
          new Date(date).getMonth(),
          1,
        )
          .toISOString()
          .slice(0, 10);
        result = await fetchSealedReports(branchId || undefined, from, date);
      }
      setData(result as ReportData);
    } catch (cause) {
      if (requestVersionAtStart !== requestVersion.current) return;
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load this report.",
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
    } catch (cause) {
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

const download = async (format: "pdf" | "excel") => {
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
  const shiftReportRows =
    tab === "shift-report" && Array.isArray(data)
      ? (data as ShiftReportRow[])
      : [];
  const ownShiftReport =
    tab === "shift-report" && data && !Array.isArray(data)
      ? (data as ShiftReportRow)
      : null;

  return (
    <main className="min-h-screen bg-[#eef3f1] text-[#18312d]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 lg:py-10">
        <header className="mb-8 flex flex-col justify-between gap-5 border-b border-[#cbd8d2] pb-7 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#397d70]">
              <BarChart3 size={15} /> Operations intelligence
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[#163b35] sm:text-5xl">
              Reports desk
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#59706a]">
              A clear read on closure, revenue, credit and the people moving the
              floor.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#59706a]">
            <span className="h-2 w-2 rounded-full bg-[#3e9b76]" /> Live API data
          </div>
        </header>

        <section className="mb-7 grid gap-3 rounded-2xl border border-[#cad8d2] bg-white p-4 shadow-[0_10px_30px_rgba(29,68,58,0.05)] sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_160px_auto] sm:items-end">
          <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
            Branch ID
            <input
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              placeholder="Enter branch UUID"
              className="mt-2 h-11 w-full rounded-lg border border-[#c9d7d1] bg-[#f8fbf9] px-3 text-sm outline-none ring-[#397d70] focus:ring-2"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
            Report date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-[#c9d7d1] bg-[#f8fbf9] px-3 text-sm outline-none ring-[#397d70] focus:ring-2"
            />
          </label>
          {rangeTabs.includes(tab) && (
            <>
              <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setActivePreset("custom");
                  }}
                  className="mt-2 h-11 w-full rounded-lg border border-[#c9d7d1] bg-[#f8fbf9] px-3 text-sm outline-none ring-[#397d70] focus:ring-2"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setActivePreset("custom");
                  }}
                  className="mt-2 h-11 w-full rounded-lg border border-[#c9d7d1] bg-[#f8fbf9] px-3 text-sm outline-none ring-[#397d70] focus:ring-2"
                />
              </label>
            </>
          )}
          {tab === "cash-reconciliation" || tab === "z-report" ? (
            <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
              Cash counted
              <input
                type="number"
                value={cashCount}
                onChange={(event) => setCashCount(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-[#c9d7d1] bg-[#f8fbf9] px-3 text-sm outline-none ring-[#397d70] focus:ring-2"
              />
            </label>
          ) : (
            <div />
          )}

          {tab === "cash-reconciliation" && (
            <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
              Opening cash (if not sealed yet)
              <input
                type="number"
                value={openingCashInput}
                onChange={(event) => setOpeningCashInput(event.target.value)}
                placeholder="Auto from sealed report"
                className="mt-2 h-11 w-full rounded-lg border border-[#c9d7d1] bg-[#f8fbf9] px-3 text-sm outline-none ring-[#397d70] focus:ring-2"
              />
            </label>
          )}
                   <button
            onClick={() => void loadReport()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1d5c50] px-4 text-sm font-bold text-white hover:bg-[#174a41]"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </section>

        {rangeTabs.includes(tab) && (
          <div className="mb-7 -mt-4 flex flex-wrap gap-2">
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => applyPreset(option.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  activePreset === option.id
                    ? "bg-[#1d5c50] text-white"
                    : "border border-[#c9d7d1] bg-white text-[#5f776f] hover:bg-[#edf6f1]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <span
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                activePreset === "custom"
                  ? "bg-[#1d5c50] text-white"
                  : "border border-dashed border-[#c9d7d1] text-[#9db0a9]"
              }`}
            >
              Custom
            </span>
          </div>
        )}

        <div className="grid gap-7 lg:grid-cols-[285px_1fr]">
          <nav
            className="space-y-1 rounded-2xl border border-[#cad8d2] bg-[#f8fbf9] p-2"
            aria-label="Report types"
          >
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full rounded-xl p-3 text-left transition ${tab === item.id ? "bg-[#1d5c50] text-white shadow-md" : "text-[#36554e] hover:bg-[#e4efea]"}`}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span
                  className={`mt-1 block text-xs ${tab === item.id ? "text-[#d8eee5]" : "text-[#789089]"}`}
                >
                  {item.description}
                </span>
              </button>
            ))}
          </nav>

          <section className="min-w-0">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#397d70]">
                  Selected report
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#183f37]">
                  {selected.label}
                </h2>
              </div>
              {tab !== "schedules" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => void download("pdf")}
                    disabled={exporting !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#b9cbc3] bg-white px-3 py-2 text-xs font-bold text-[#315c52] hover:bg-[#edf6f1] disabled:opacity-50"
                  >
                    <Download size={15} />{" "}
                    {exporting === "pdf" ? "Preparing..." : "PDF"}
                  </button>
                  <button
                    onClick={() => void download("excel")}
                    disabled={exporting !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#b9cbc3] bg-white px-3 py-2 text-xs font-bold text-[#315c52] hover:bg-[#edf6f1] disabled:opacity-50"
                  >
                    <FileText size={15} />{" "}
                    {exporting === "excel" ? "Preparing..." : "Excel"}
                  </button>
                </div>
              )}
            </div>

            {loading && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="h-28 animate-pulse rounded-2xl bg-[#dce8e2]" />
                <div className="h-28 animate-pulse rounded-2xl bg-[#dce8e2]" />
                <div className="h-28 animate-pulse rounded-2xl bg-[#dce8e2]" />
              </div>
            )}
            {!loading && error && (
              <div className="rounded-2xl border border-[#e9b7ad] bg-[#fff5f2] p-6 text-[#873f35]">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle size={18} /> Could not load report
                </div>
                <p className="mt-2 text-sm">{error}</p>
                <button
                  onClick={() => void loadReport()}
                  className="mt-4 rounded-lg bg-[#873f35] px-4 py-2 text-sm font-bold text-white"
                >
                  Try again
                </button>
              </div>
            )}
            {!loading && !error && data === null && tab !== "schedules" && (
              <EmptyState message="No report data for this selection." />
            )}

            {/* Z-REPORT */}
            {!loading && !error && data && tab === "z-report" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Revenue", money(zReport?.revenue)],
                    ["Sessions", zReport?.sessionCount ?? 0],
                    ["Invoices", zReport?.invoiceCount ?? 0],
                    ["Discounts", money(zReport?.discounts)],
                    [
                      "Voids",
                      `${money(zReport?.voidAmount)} (${zReport?.voidCount ?? 0})`,
                    ],
                    ["Udhaar issued", money(zReport?.udhaarIssued)],
                    ["Udhaar received", money(zReport?.udhaarReceived)],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-[#789089]">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-black text-[#1d5c50]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_300px]">
                  <div className="rounded-2xl border border-[#cad8d2] bg-white p-5">
                    <h3 className="font-black">Tender breakdown</h3>
                    <div className="mt-4 space-y-3">
                      {Object.entries(zReport?.tenderBreakdown ?? {}).map(
                        ([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-sm">
                              <span className="capitalize text-[#617972]">
                                {key}
                              </span>
                              <b>{money(value)}</b>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-[#e6efeb]">
                              <div
                                className="h-2 rounded-full bg-[#3e9b76]"
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
                  <div className="rounded-2xl border border-[#cad8d2] bg-[#e9f4ee] p-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#267254]">
                      <ShieldCheck size={18} /> Closure state
                    </div>
                    <p className="mt-5 text-2xl font-black">
                      {zReport?.isSealed ? "Sealed" : "Open"}
                    </p>
                    {zReport?.note && (
                      <p className="mt-3 text-xs text-[#a14b3f]">
                        {zReport.note}
                      </p>
                    )}
                    {!zReport?.isSealed && isManagement && (
                      <button
                        disabled={sealing}
                        onClick={() => void seal()}
                        className="mt-5 w-full rounded-lg bg-[#1d5c50] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {sealing ? "Sealing..." : "Seal daily report"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* CASH RECONCILIATION */}
            {!loading && !error && data && tab === "cash-reconciliation" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
                  {[
                    ["Opening cash", money(cashRecon?.openingCash)],
                    ["Cash collected", money(cashRecon?.cashTenderTotal)],
                    ["Expected cash", money(cashRecon?.expectedCash)],
                    ["Counted cash", money(cashRecon?.actualCashCounted)],
                    ["Difference", money(cashRecon?.discrepancy)],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-[#789089]">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-black text-[#1d5c50]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                {cashRecon?.hasUnreflectedCorrections && (
                  <div className="rounded-2xl border border-[#e0c98f] bg-[#fffbf0] p-4 text-sm text-[#8a6d1f]">
                    This day has post-seal manual corrections not reflected in
                    the totals above. Check Sealed Reports for detail.
                  </div>
                )}
                <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                      <tr>
                        <th className="px-5 py-4">Time</th>
                        <th className="px-5 py-4">Invoice</th>
                        <th className="px-5 py-4">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cashRecon?.transactions ?? []).map((txn) => (
                        <tr key={txn.id} className="border-t border-[#e6eeea]">
                          <td className="px-5 py-4">
                            {new Date(txn.createdAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-[#5f776f]">
                            {txn.invoiceId}
                          </td>
                          <td className="px-5 py-4 font-bold text-[#1d5c50]">
                            {money(txn.amount)}
                          </td>
                        </tr>
                      ))}
                      {(cashRecon?.transactions ?? []).length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-5 py-6 text-center text-[#617972]"
                          >
                            No cash transactions for this date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SHIFT REPORT */}
            {!loading &&
              !error &&
              data &&
              tab === "shift-report" &&
              (isManagement ? (
                shiftReportRows.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                        <tr>
                          <th className="px-5 py-4">Staff</th>
                          <th className="px-5 py-4">Sessions</th>
                          <th className="px-5 py-4">Invoices</th>
                          <th className="px-5 py-4">Sales</th>
                          <th className="px-5 py-4">Discounts</th>
                          <th className="px-5 py-4">Voids</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftReportRows.map((row, index) => (
  <tr
    key={`${row.staffId}-${index}`}
    className="border-t border-[#e6eeee]"
  >
                            <td className="px-5 py-4 font-bold">
                              {row.staffName}
                            </td>
                            <td className="px-5 py-4">{row.sessionCount}</td>
                            <td className="px-5 py-4">{row.invoiceCount}</td>
                            <td className="px-5 py-4 font-bold text-[#1d5c50]">
                              {money(row.totalSales)}
                            </td>
                            <td className="px-5 py-4">
                              {money(row.totalDiscounts)}
                            </td>
                            <td className="px-5 py-4">{row.voidCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No shift data for this date." />
                )
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ["Sessions", ownShiftReport?.sessionCount ?? 0],
                    ["Invoices", ownShiftReport?.invoiceCount ?? 0],
                    ["Total sales", money(ownShiftReport?.totalSales)],
                    ["Discounts", money(ownShiftReport?.totalDiscounts)],
                    ["Voids", ownShiftReport?.voidCount ?? 0],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-[#789089]">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-black text-[#1d5c50]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              ))}

            {/* MONTHLY SUMMARY */}
            {!loading && !error && data && tab === "monthly-summary" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["This month", money(summary?.totalRevenue)],
                    ["Previous month", money(summary?.previousMonthRevenue)],
                    [
                      "Trend",
                      summary?.trendPercent === null ||
                      summary?.trendPercent === undefined
                        ? "No baseline"
                        : `${summary.trendPercent}%`,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-[#789089]">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-black text-[#1d5c50]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                {(summary?.revenueByBranch?.length ?? 0) > 0 && (
                  <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                        <tr>
                          <th className="px-5 py-4">Branch</th>
                          <th className="px-5 py-4">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary?.revenueByBranch?.map((row) => (
                          <tr
                            key={row.branchId}
                            className="border-t border-[#e6eeea]"
                          >
                            <td className="px-5 py-4 font-mono text-xs text-[#5f776f]">
                              {row.branchId}
                            </td>
                            <td className="px-5 py-4 font-bold text-[#1d5c50]">
                              {money(row.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {summary?.hasUnreflectedCorrections && (
                  <div className="rounded-2xl border border-[#e0c98f] bg-[#fffbf0] p-4 text-sm text-[#8a6d1f]">
                    Corrections recorded on:{" "}
                    {(summary.datesWithCorrections ?? []).join(", ")} — not
                    reflected in totals above.
                  </div>
                )}
              </div>
            )}

            {/* UDHAAR AGING */}
            {!loading && !error && data && tab === "udhaar-aging" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    [
                      "Total outstanding",
                      money(aging?.summary?.totalOutstanding),
                    ],
                    [
                      "Overdue (90+ days)",
                      money(aging?.summary?.overdueBalance),
                    ],
                    ["Active accounts", aging?.summary?.activeAccounts ?? 0],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-[#789089]">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-black text-[#1d5c50]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#cad8d2] bg-white p-5">
                  <h3 className="font-black">Aging buckets</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Current", aging?.summary?.buckets?.current],
                      ["1–30 days", aging?.summary?.buckets?.days1to30],
                      ["30–60 days", aging?.summary?.buckets?.days30to60],
                      ["60–90 days", aging?.summary?.buckets?.days60to90],
                      ["90+ days", aging?.summary?.buckets?.days90plus],
                    ].map(([label, value]) => {
                      const numeric = Number(value ?? 0);
                      const max = Math.max(
                        1,
                        Number(aging?.summary?.totalOutstanding ?? 1),
                      );
                      return (
                        <div key={String(label)}>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#617972]">{label}</span>
                            <b>{money(numeric)}</b>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-[#e6efeb]">
                            <div
                              className="h-2 rounded-full bg-[#3e9b76]"
                              style={{
                                width: `${Math.min(100, (numeric / max) * 100)}%`,
                              }}
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
              <div className="space-y-4">
                <div
                  className={`rounded-2xl border p-6 ${reconciliation?.reconciled ? "border-[#a9d2bd] bg-[#effaf3]" : "border-[#e7b7ad] bg-[#fff5f2]"}`}
                >
                  <div className="flex items-center gap-2 font-black">
                    {reconciliation?.reconciled ? (
                      <CheckCircle2 className="text-[#27805a]" />
                    ) : (
                      <AlertTriangle className="text-[#a14b3f]" />
                    )}
                    {reconciliation?.reconciled
                      ? "Figures reconcile"
                      : "Discrepancy detected"}
                  </div>
                  <p className="mt-2 text-sm text-[#5f776f]">
                    {reconciliation?.isSealed
                      ? "This day's Z-report is sealed."
                      : "This day's Z-report is not sealed yet."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["Invoice total", money(reconciliation?.invoiceTotal)],
                    ["Payment total", money(reconciliation?.paymentTotal)],
                    ["Z-Report revenue", money(reconciliation?.zReportRevenue)],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-[#789089]">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-black text-[#1d5c50]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                {(reconciliation?.discrepancies ?? []).length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-[#e7b7ad] bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#fff5f2] text-xs uppercase tracking-wider text-[#a14b3f]">
                        <tr>
                          <th className="px-5 py-3">Field</th>
                          <th className="px-5 py-3">Expected</th>
                          <th className="px-5 py-3">Actual</th>
                          <th className="px-5 py-3">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reconciliation?.discrepancies ?? []).map((item) => (
                          <tr
                            key={item.field}
                            className="border-t border-[#f0dcd7]"
                          >
                            <td className="px-5 py-3">{item.field}</td>
                            <td className="px-5 py-3">
                              {money(item.expected)}
                            </td>
                            <td className="px-5 py-3">{money(item.actual)}</td>
                            <td className="px-5 py-3 font-bold text-[#a14b3f]">
                              {money(item.difference)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {reconciliation?.manualCorrections &&
                  reconciliation.manualCorrections.count > 0 && (
                    <div className="rounded-2xl border border-[#e0c98f] bg-[#fffbf0] p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#8a6d1f]">
                        Manual corrections (
                        {reconciliation.manualCorrections.count}) — total{" "}
                        {money(reconciliation.manualCorrections.total)}
                      </p>
                      {reconciliation.manualCorrections.note && (
                        <p className="mt-2 text-sm text-[#5f776f]">
                          {reconciliation.manualCorrections.note}
                        </p>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* SEALED REPORTS */}
            {!loading &&
              !error &&
              tab === "sealed-reports" &&
              (sealedReports.length > 0 ? (
                <div className="space-y-3">
                  {sealedReports.map((report) => {
                    const corrections =
                      report.items?.filter((item) =>
                        item.label?.startsWith("CORRECTION"),
                      ) ?? [];
                    return (
                      <article
                        key={report.id}
                        className="rounded-2xl border border-[#cad8d2] bg-white p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black">
                              {new Date(report.reportDate).toLocaleDateString()}{" "}
                              <span className="ml-2 text-xs font-normal text-[#5f776f]">
                                Branch {report.branchId}
                              </span>
                            </h3>
                            <p className="mt-1 text-sm text-[#5f776f]">
                              Reconciled cash: {money(report.reconciledCash)} ·
                              Sealed:{" "}
                              {report.sealedAt
                                ? new Date(report.sealedAt).toLocaleString()
                                : "-"}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f4ee] px-3 py-1 text-xs font-bold text-[#267254]">
                            <ShieldCheck size={14} /> Approved
                          </span>
                        </div>
                        {corrections.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-[#edc4bc] bg-[#fff7f4] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#a14b3f]">
                              Corrections
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-[#70423b]">
                              {corrections.map((item) => (
                                <li key={item.id}>
                                  {item.label}: {money(item.amount)}
                                </li>
                              ))}
                            </ul>
                            {report.netReconciledCash !== undefined && (
                              <p className="mt-3 text-sm font-bold text-[#70423b]">
                                Net reconciled cash:{" "}
                                {money(report.netReconciledCash)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-[#5f776f]">
                            No post-seal corrections recorded.
                          </p>
                        )}
                        {isManagement && (
                          <div className="mt-4">
                            {correctingId === report.id ? (
                              <div className="rounded-xl border border-[#cad8d2] bg-[#f8fbf9] p-4">
                                <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                                  Correction type
                                  <select
                                    value={correctionType}
                                    onChange={(event) =>
                                      setCorrectionType(
                                        event.target.value as
                                          | "revenue"
                                          | "udhaar",
                                      )
                                    }
                                    className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                                  >
                                    <option value="revenue">
                                      Revenue Adjustment
                                    </option>
                                    <option value="udhaar">
                                      Udhaar Adjustment
                                    </option>
                                  </select>
                                </label>
                                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-[#68817a]">
                                  Amount
                                  <input
                                    type="number"
                                    value={correctionAmount}
                                    onChange={(event) =>
                                      setCorrectionAmount(event.target.value)
                                    }
                                    className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                                  />
                                </label>
                                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-[#68817a]">
                                  Reason
                                  <input
                                    value={correctionReason}
                                    onChange={(event) =>
                                      setCorrectionReason(event.target.value)
                                    }
                                    className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                                  />
                                </label>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    disabled={submittingCorrection}
                                    onClick={() =>
                                      void submitCorrection(report.id)
                                    }
                                    className="rounded-lg bg-[#1d5c50] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                                  >
                                    {submittingCorrection
                                      ? "Saving..."
                                      : "Save correction"}
                                  </button>
                                  <button
                                    onClick={() => setCorrectingId(null)}
                                    className="rounded-lg border border-[#c9d7d1] px-4 py-2 text-xs font-bold text-[#5f776f]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setCorrectingId(report.id)}
                                className="rounded-lg border border-[#b9cbc3] bg-white px-3 py-2 text-xs font-bold text-[#315c52] hover:bg-[#edf6f1]"
                              >
                                + Add correction
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No sealed reports found for this date range." />
              ))}

            {/* TOP CUSTOMERS */}
            {!loading &&
              !error &&
              data &&
              tab === "top-customers" &&
              (rankedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                      <tr>
                        <th className="px-5 py-4">Customer</th>
                        <th className="px-5 py-4">Phone</th>
                        <th className="px-5 py-4">Total spend</th>
                        <th className="px-5 py-4">Visits</th>
                        <th className="px-5 py-4">Outstanding udhaar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedRows.map((item, index) => (
                        <tr
                          key={String(item.customerId ?? index)}
                          className="border-t border-[#e6eeea]"
                        >
                          <td className="px-5 py-4 font-bold">
                            {String(item.fullName ?? "Unknown")}
                          </td>
                          <td className="px-5 py-4 text-[#5f776f]">
                            {String(item.phone ?? "-")}
                          </td>
                          <td className="px-5 py-4 font-bold text-[#1d5c50]">
                            {money(item.totalSpend)}
                          </td>
                          <td className="px-5 py-4">
                            {Number(item.visitCount ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            {money(item.outstandingUdhaar)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No rows found for this report." />
              ))}

            {/* TOP ITEMS */}
            {!loading &&
              !error &&
              data &&
              tab === "top-items" &&
              (rankedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                      <tr>
                        <th className="px-5 py-4">Item</th>
                        <th className="px-5 py-4">Quantity sold</th>
                        <th className="px-5 py-4">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedRows.map((item, index) => (
                        <tr
                          key={String(item.name ?? index)}
                          className="border-t border-[#e6eeea]"
                        >
                          <td className="px-5 py-4 font-bold">
                            {String(item.name ?? "Unknown")}
                          </td>
                          <td className="px-5 py-4">
                            {Number(item.quantity ?? 0)}
                          </td>
                          <td className="px-5 py-4 font-bold text-[#1d5c50]">
                            {money(item.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No rows found for this report." />
              ))}

            {/* STAFF PERFORMANCE */}
            {!loading &&
              !error &&
              data &&
              tab === "staff-performance" &&
              (rankedRows.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                      <tr>
                        <th className="px-5 py-4">Staff</th>
                        <th className="px-5 py-4">Discounts</th>
                        <th className="px-5 py-4">Voids</th>
                        <th className="px-5 py-4">Void amount</th>
                        <th className="px-5 py-4">Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedRows.map((item, index) => (
                        <tr
                          key={String(item.staffId ?? index)}
                          className="border-t border-[#e6eeea]"
                        >
                          <td className="px-5 py-4">
                            <p className="font-bold">
                              {String(item.staffName ?? "Unknown")}
                            </p>
                            <p className="text-xs text-[#5f776f]">
                              {String(item.staffEmail ?? "")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {money(item.discountTotal)}{" "}
                            <span className="text-xs text-[#5f776f]">
                              ({Number(item.discountCount ?? 0)})
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {Number(item.voidCount ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            {money(item.voidAmount)}
                          </td>
                          <td className="px-5 py-4">
                            {item.flaggedForReview ? (
                              <span className="inline-flex items-center gap-1 text-[#a14b3f]">
                                <AlertTriangle size={14} /> Flagged
                              </span>
                            ) : (
                              <span className="text-[#27805a]">Normal</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No rows found for this report." />
              ))}

            {/* PEAK HOURS */}
            {!loading && !error && data && tab === "peak-hours" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#cad8d2] bg-white p-5">
                  <h3 className="font-black">Sessions by hour</h3>
                  {Object.entries(
                    (data as { byHour: Record<string, number> }).byHour ?? {},
                  ).map(([hour, value]) => (
                    <div
                      key={hour}
                      className="mt-3 flex items-center gap-3 text-sm"
                    >
                      <span className="w-12 text-[#68817a]">{hour}:00</span>
                      <div className="h-3 flex-1 rounded-full bg-[#e6efeb]">
                        <div
                          className="h-3 rounded-full bg-[#3e9b76]"
                          style={{
                            width: `${Math.min(100, Number(value) * 10)}%`,
                          }}
                        />
                      </div>
                      <b>{value}</b>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#cad8d2] bg-white p-5">
                  <h3 className="font-black">Sessions by day of week</h3>
                  {Object.entries(
                    (data as { byDayOfWeek: Record<string, number> })
                      .byDayOfWeek ?? {},
                  ).map(([day, value]) => (
                    <div
                      key={day}
                      className="mt-3 flex items-center gap-3 text-sm"
                    >
                      <span className="w-12 text-[#68817a]">
                        {dayNames[Number(day)] ?? day}
                      </span>
                      <div className="h-3 flex-1 rounded-full bg-[#e6efeb]">
                        <div
                          className="h-3 rounded-full bg-[#3e9b76]"
                          style={{
                            width: `${Math.min(100, Number(value) * 10)}%`,
                          }}
                        />
                      </div>
                      <b>{value}</b>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#cad8d2] bg-white p-5 sm:col-span-2">
                  <h3 className="font-black">Total sessions</h3>
                  <p className="mt-5 text-4xl font-black text-[#1d5c50]">
                    {(data as { totalSessions: number }).totalSessions}
                  </p>
                  <p className="mt-2 text-sm text-[#68817a]">
                    Use this view to tune staffing around demand.
                  </p>
                </div>
              </div>
            )}

            {/* SCHEDULES */}
            {tab === "schedules" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#cad8d2] bg-white p-5">
                  <h3 className="font-black">New scheduled delivery</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                      Report type
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
                        className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                      >
                        <option value="daily_closure">Daily Closure</option>
                        <option value="weekly_summary">Weekly Summary</option>
                        <option value="monthly_summary">Monthly Summary</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                      Recipient email
                      <input
                        type="email"
                        value={newScheduleEmail}
                        onChange={(event) =>
                          setNewScheduleEmail(event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                      Attachment format
                      <select
                        value={newScheduleFormat}
                        onChange={(event) =>
                          setNewScheduleFormat(
                            event.target.value as "pdf" | "excel" | "both",
                          )
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                      >
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel</option>
                        <option value="both">Both (PDF + Excel)</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#68817a] sm:col-span-2">
                      Custom message (optional)
                      <textarea
                        value={newScheduleMessage}
                        onChange={(event) =>
                          setNewScheduleMessage(event.target.value)
                        }
                        rows={2}
                        placeholder="Leave blank for default message"
                        className="mt-2 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 py-2 text-sm outline-none"
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                      Hour (Pakistan Time, 0-23)
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={newScheduleHour}
                        onChange={(event) =>
                          setNewScheduleHour(event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#68817a]">
                      Minute (0-59)
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={newScheduleMinute}
                        onChange={(event) =>
                          setNewScheduleMinute(event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-[#c9d7d1] bg-white px-3 text-sm outline-none"
                      />
                    </label>
                  </div>
                  <button
                    disabled={creatingSchedule}
                    onClick={() => void createSchedule()}
                    className="mt-4 rounded-lg bg-[#1d5c50] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {creatingSchedule ? "Saving..." : "Create schedule"}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-[#cad8d2] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#edf5f1] text-xs uppercase tracking-wider text-[#68817a]">
                      <tr>
                        <th className="px-5 py-4">Type</th>
                        <th className="px-5 py-4">Recipient</th>
                        <th className="px-5 py-4">Time (UTC)</th>
                        <th className="px-5 py-4">Last sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((item) => (
                        <tr key={item.id} className="border-t border-[#e6eeea]">
                          <td className="px-5 py-4">{item.reportType}</td>
                          <td className="px-5 py-4">{item.recipientEmail}</td>
                          <td className="px-5 py-4 font-mono text-xs">
                            {item.scheduleCron}
                          </td>
                          <td className="px-5 py-4">
                            {item.lastSentAt
                              ? new Date(item.lastSentAt).toLocaleString()
                              : "Never"}
                          </td>
                        </tr>
                      ))}
                      {schedules.length === 0 && !schedulesLoading && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-6 text-center text-[#617972]"
                          >
                            No scheduled deliveries yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
