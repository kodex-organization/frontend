"use client";

import { useMemo, useState, useRef, useEffect, type FormEvent } from "react";
import { useUdhaarLedger } from "@/features/udhaar/hooks/useUdhaarLedger";
import { type UdhaarThresholdSettings } from "@/features/udhaar/api/udhaarApi";
import { useBranchCurrency } from "@/features/tenancy/useBranchCurrency";
import { formatCurrency } from "@/features/invoice/utils/formatCurrency";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/lib/toast";
import {
  AlertCircle,
  Clock,
  Coins,
  CreditCard,
  Download,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";

const statusOptions = ["all", "pending", "cleared", "overdue"] as const;

function formatAmount(value: unknown, currency: string) {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return formatCurrency(Number.isFinite(num) ? num : 0, currency);
}

function getInitials(name?: string) {
  if (!name) return "CU";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function UdhaarPage() {
  const { user } = useAuth();
  const currency = useBranchCurrency();

  // Role permissions
  const userRoles = useMemo(
    () => (user?.roles ?? []).map((r) => r.toUpperCase()),
    [user?.roles]
  );
  const isOwner = userRoles.includes("OWNER");
  const isManager = userRoles.includes("MANAGER");
  const isCashier = userRoles.includes("CASHIER");

  // Only management can modify ledger balances manually
  const canAdjustLedger = isOwner || isManager;
  // Counter roles that physically collect customer payments
  const canSettleDebt = isOwner || isManager || isCashier;

  const {
    filteredCustomers,
    aging,
    loading,
    error,
    snapshotAt,
    pendingCount,
    recordLedgerSettlement,
    loadThresholds,
    saveThresholds,
    search,
    setSearch,
    status,
    setStatus,
    refresh,
    loadStatement,
    addAdjustment,
    statement,
  } = useUdhaarLedger();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [statementRange, setStatementRange] = useState({ from: "", to: "" });

  // Manual Adjustment State
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    customerId: "",
    amount: "",
    reason: "",
    approvedByPin: "",
  });
  const [adjustmentState, setAdjustmentState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Settlement State
  const [showSettlement, setShowSettlement] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    customerId: "",
    amount: "",
    reason: "Debt repayment / cash settlement",
  });
  const [settlementCustomerSearch, setSettlementCustomerSearch] = useState("");
  const [showSettlementDropdown, setShowSettlementDropdown] = useState(false);
  const [settlementSubmitting, setSettlementSubmitting] = useState(false);

  // Credit Thresholds State
  const [showThresholds, setShowThresholds] = useState(false);
  const [thresholdsForm, setThresholdsForm] = useState<UdhaarThresholdSettings>({
    individualLimit: 5000,
    aggregateLimit: 50000,
  });
  const [thresholdsSubmitting, setThresholdsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const filteredCustomerOptions = useMemo(() => {
    if (!customerSearch.trim()) return filteredCustomers;
    const query = customerSearch.toLowerCase();
    return filteredCustomers.filter(
      (c) =>
        (c.fullName?.toLowerCase().includes(query) || "") ||
        (c.phone?.toLowerCase().includes(query) || "")
    );
  }, [filteredCustomers, customerSearch]);

  const filteredSettlementOptions = useMemo(() => {
    if (!settlementCustomerSearch.trim()) return filteredCustomers;
    const query = settlementCustomerSearch.toLowerCase();
    return filteredCustomers.filter(
      (c) =>
        (c.fullName?.toLowerCase().includes(query) || "") ||
        (c.phone?.toLowerCase().includes(query) || "")
    );
  }, [filteredCustomers, settlementCustomerSearch]);

  useEffect(() => {
    if (!showAdjustment && !showSettlement && !showThresholds) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        setShowSettlement(false);
        setShowThresholds(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showAdjustment, showSettlement, showThresholds]);

  const closeModal = () => {
    setShowAdjustment(false);
    setAdjustmentForm({ customerId: "", amount: "", reason: "", approvedByPin: "" });
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setAdjustmentState("idle");
  };

  const openAdjustmentModal = (customerId?: string) => {
    if (!canAdjustLedger) {
      toast.error("Access denied: Only managers and owners can make manual adjustments.");
      return;
    }
    if (customerId) {
      const customer = filteredCustomers.find((c) => c.id === customerId);
      setAdjustmentForm((current) => ({ ...current, customerId }));
      setCustomerSearch(customer?.fullName ?? "");
    } else {
      setAdjustmentForm({ customerId: "", amount: "", reason: "", approvedByPin: "" });
      setCustomerSearch("");
    }
    setShowCustomerDropdown(false);
    setAdjustmentState("idle");
    setShowAdjustment(true);
  };

  const openSettlementModal = (customerId?: string) => {
    if (!canSettleDebt) {
      toast.error("Access denied: Accountants cannot process debt settlements.");
      return;
    }
    if (customerId) {
      const customer = filteredCustomers.find((c) => c.id === customerId);
      setSettlementForm({
        customerId,
        amount: customer?.outstandingBalance ? String(customer.outstandingBalance) : "",
        reason: "Debt repayment / cash settlement",
      });
      setSettlementCustomerSearch(customer?.fullName ?? "");
    } else {
      setSettlementForm({
        customerId: "",
        amount: "",
        reason: "Debt repayment / cash settlement",
      });
      setSettlementCustomerSearch("");
    }
    setShowSettlementDropdown(false);
    setShowSettlement(true);
  };

  const handleSettlementSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSettleDebt) {
      toast.error("Unauthorized: Settle debt is reserved for cashiers and managers.");
      return;
    }
    if (!settlementForm.customerId) {
      toast.error("Please select a customer.");
      return;
    }
    const amount = Number(settlementForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive payment amount.");
      return;
    }
    try {
      setSettlementSubmitting(true);
      const result = await recordLedgerSettlement({
        customerId: settlementForm.customerId,
        amount,
        reason: settlementForm.reason || "Debt repayment / cash settlement",
      });
      toast.success(
        result.mode === "offline"
          ? `Settlement of ${formatCurrency(amount, currency)} saved on this device. It will sync when the connection returns.`
          : `Settlement of ${formatCurrency(amount, currency)} recorded.`,
      );
      setShowSettlement(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to record settlement");
    } finally {
      setSettlementSubmitting(false);
    }
  };

  const openThresholdsModal = async () => {
    try {
      const current = await loadThresholds();
      setThresholdsForm(current);
      setShowThresholds(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to load threshold settings");
    }
  };

  const handleThresholdsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setThresholdsSubmitting(true);
      await saveThresholds(thresholdsForm);
      toast.success("Credit thresholds updated successfully.");
      setShowThresholds(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update credit thresholds");
    } finally {
      setThresholdsSubmitting(false);
    }
  };

  const handleStatementOpen = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setStatementRange({ from: "", to: "" });
  };

  const handleStatementView = async () => {
    if (!selectedCustomerId || !statementRange.from || !statementRange.to) return;
    await loadStatement(selectedCustomerId, statementRange.from, statementRange.to);
  };

  const handleAdjustmentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canAdjustLedger) {
      toast.error("Unauthorized: Adjustments require manager or owner privileges.");
      return;
    }
    if (!adjustmentForm.customerId) {
      setAdjustmentState("error");
      return;
    }
    setAdjustmentState("loading");
    const saved = await addAdjustment({
      customerId: adjustmentForm.customerId,
      amount: Number(adjustmentForm.amount),
      reason: adjustmentForm.reason,
      approvedByPin: adjustmentForm.approvedByPin || undefined,
    });
    if (saved) {
      setAdjustmentState("success");
      setTimeout(() => closeModal(), 1000);
    } else {
      setAdjustmentState("error");
    }
  };

  const exportStatement = () => {
    if (!statement) return;
    const rows = [
      "id,amount,reason,entryType,createdAt",
      ...statement.entries.map(
        (entry) =>
          `${entry.id},${entry.amount},${(entry.reason ?? "").replace(/,/g, " ")},${
            entry.entryType ?? ""
          },${entry.createdAt}`
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `udhaar-statement-${statement.customerId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedCustomer = useMemo(
    () => filteredCustomers.find((c) => c.id === selectedCustomerId),
    [filteredCustomers, selectedCustomerId]
  );

  // Arithmetic calculation: ensures numeric summing instead of string concatenation
  const statementSummary = useMemo(() => {
    if (!statement) return { totalDebits: 0, totalCredits: 0, netMovement: 0, count: 0 };
    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of statement.entries) {
      const rawAmount = Number(entry.amount ?? 0);
      const type = String(entry.entryType ?? (entry as any).type ?? "").toLowerCase();
      const isCredit = type === "credit" || rawAmount < 0;
      const amount = Math.abs(rawAmount);

      if (isCredit) {
        totalCredits += amount;
      } else {
        totalDebits += amount;
      }
    }

    return {
      totalDebits,
      totalCredits,
      netMovement: totalDebits - totalCredits,
      count: statement.entries.length,
    };
  }, [statement]);

  const handlePrintStatement = () => {
    const cleanup = () => {
      document.body.classList.remove("printing-statement");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("printing-statement");
    window.print();
    setTimeout(cleanup, 1500);
  };

  if (loading) {
    return (
      <section className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="h-16 animate-pulse rounded-xl bg-slate-200/70" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-slate-200/70" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="max-w-7xl mx-auto m-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
        <h3 className="font-bold text-base">Failed to load Udhaar Ledger</h3>
        <p className="mt-1 text-sm text-rose-600">{error}</p>
        <button
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 cursor-pointer"
          onClick={() => void refresh()}
        >
          Retry Connection
        </button>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/60 pb-16 text-slate-900 print:min-h-0 print:bg-white print:p-0 print:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 print:p-0 print:m-0 print:max-w-none">
        <div className="udhaar-non-printable space-y-6 print:hidden">
          {snapshotAt && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800"
            >
              You are offline. Showing the Udhaar ledger saved on{" "}
              <span className="font-semibold">{new Date(snapshotAt).toLocaleString()}</span>.
              It refreshes automatically when the connection returns.
            </div>
          )}

          {pendingCount > 0 && (
            <div
              role="status"
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800"
            >
              <span className="font-semibold">{pendingCount}</span> Udhaar{" "}
              {pendingCount === 1 ? "entry is" : "entries are"} saved on this device and waiting to sync.
              Balances above already include {pendingCount === 1 ? "it" : "them"}.
            </div>
          )}

          {/* Page Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Finance & Credit Control
                </p>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Udhaar Ledger
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                Track outstanding customer debt, aging buckets, and settlement receipts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isOwner && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
                  onClick={openThresholdsModal}
                >
                  <SlidersHorizontal size={14} className="text-slate-500" />
                  Credit Limits
                </button>
              )}

              {canAdjustLedger && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
                  onClick={() => openAdjustmentModal()}
                >
                  <Plus size={14} className="text-slate-500" />
                  Manual Adjustment
                </button>
              )}

              {canSettleDebt && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 cursor-pointer"
                  onClick={() => openSettlementModal()}
                >
                  <Coins size={14} />
                  Record Settlement
                </button>
              )}
            </div>
          </header>

          {/* KPI Cards */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Outstanding
                </span>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <CreditCard size={16} />
                </span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {aging ? formatAmount(aging.summary.totalOutstanding, currency) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Total active credit across all accounts</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Overdue (90+ Days)
                </span>
                <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
                  <AlertCircle size={16} />
                </span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-amber-700">
                {aging ? formatAmount(aging.summary.overdueBalance, currency) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Requires collection priority</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Active Accounts
                </span>
                <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <Users size={16} />
                </span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {aging ? String(aging.summary.activeAccounts) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Customers with outstanding balance</p>
            </div>
          </section>

          {/* Aging Buckets Overview */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Aging Analysis</h2>
                <p className="text-xs text-slate-500">Unsettled credit broken down by debt duration.</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                <Clock size={13} /> Real-time aging
              </span>
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {aging ? (
                Object.entries(aging.buckets).map(([bucket, value]) => {
                  const label =
                    bucket === "current"
                      ? "Current (0-1d)"
                      : bucket === "days1to30"
                      ? "1 - 30 Days"
                      : bucket === "days30to60"
                      ? "30 - 60 Days"
                      : bucket === "days60to90"
                      ? "60 - 90 Days"
                      : "90+ Days (Overdue)";

                  const isOverdue = bucket === "days90plus" && value > 0;

                  return (
                    <div
                      key={bucket}
                      className={`rounded-lg border p-3 transition ${
                        isOverdue
                          ? "border-amber-200 bg-amber-50/50"
                          : "border-slate-200/80 bg-slate-50/50"
                      }`}
                    >
                      <p className="text-[11px] font-medium text-slate-500">{label}</p>
                      <p
                        className={`mt-1.5 text-base font-bold ${
                          isOverdue ? "text-amber-700" : "text-slate-900"
                        }`}
                      >
                        {formatAmount(value, currency)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="col-span-full py-4 text-center text-xs text-slate-400">
                  No aging breakdown recorded.
                </p>
              )}
            </div>
          </section>

          {/* Customer Ledger Table */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Customer Accounts</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                  {filteredCustomers.length}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or phone..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="relative w-full sm:w-auto">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === "all" ? "All Statuses" : opt.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="p-12 text-center">
                <UserCheck className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No customer ledgers found</p>
                <p className="text-xs text-slate-400">Try adjusting your filters or search keywords.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {getInitials(customer.fullName ?? "")}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {customer.fullName ?? "Walk-in Customer"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {customer.phone || "No phone"}
                          {customer.cnic && (
                            <>
                              {" "}<span className="text-slate-300">·</span> CNIC: {customer.cnic}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          customer.status === "overdue"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : customer.status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {customer.status.toUpperCase()}
                      </span>

                      <span className="min-w-[100px] text-right font-mono text-sm font-bold text-slate-900">
                        {formatAmount(customer.outstandingBalance, currency)}
                      </span>

                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
                          onClick={() => void handleStatementOpen(customer.id)}
                        >
                          Statement
                        </button>

                        {canAdjustLedger && (
                          <button
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
                            onClick={() => openAdjustmentModal(customer.id)}
                          >
                            Adjust
                          </button>
                        )}

                        {canSettleDebt && (
                          <button
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 cursor-pointer"
                            onClick={() => openSettlementModal(customer.id)}
                          >
                            Settle Debt
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Customer Statement Inspection Drawer */}
        {selectedCustomerId && (
          <section
            id="printable-account-statement"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* Screen Controls Header (Hidden in Print) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Account Statement</h2>
                <p className="text-xs text-slate-500">
                  {selectedCustomer ? (
                    <>
                      Inspecting ledger for <strong className="text-slate-700">{selectedCustomer.fullName}</strong> ({selectedCustomer.phone || "No phone"})
                    </>
                  ) : (
                    "Inspect itemized ledger transactions across date ranges."
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={statementRange.from}
                  onChange={(e) =>
                    setStatementRange((cur) => ({ ...cur, from: e.target.value }))
                  }
                  className="h-8.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={statementRange.to}
                  onChange={(e) =>
                    setStatementRange((cur) => ({ ...cur, to: e.target.value }))
                  }
                  className="h-8.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
                <button
                  className="h-8.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 cursor-pointer"
                  onClick={() => void handleStatementView()}
                >
                  Fetch
                </button>
                {statement && (
                  <>
                    <button
                      className="h-8.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      onClick={handlePrintStatement}
                    >
                      <Printer size={13} /> Print
                    </button>
                    <button
                      className="h-8.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      onClick={exportStatement}
                    >
                      <Download size={13} /> CSV
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Print-Only Formal Statement Header */}
            <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                    CueCloud POS
                  </h1>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Customer Account Statement
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-0.5">
                  <p className="font-mono font-medium">
                    Statement ID: {statement?.customerId.slice(0, 8).toUpperCase()}
                  </p>
                  <p>
                    Generated: {new Date().toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer Details</div>
                  <p className="font-bold text-slate-900 text-sm">{selectedCustomer?.fullName ?? "Customer"}</p>
                  <p className="text-slate-600">Phone: {selectedCustomer?.phone || "—"}</p>
                  {selectedCustomer?.cnic && <p className="text-slate-600">CNIC: {selectedCustomer.cnic}</p>}
                  <p className="text-slate-600">
                    Status: <span className="font-semibold uppercase text-slate-800">{selectedCustomer?.status ?? "—"}</span>
                  </p>
                </div>

                <div className="space-y-1 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Statement Overview</div>
                  <p className="text-slate-700">
                    Period: <strong className="text-slate-900">{statementRange.from || "Start"} to {statementRange.to || "Present"}</strong>
                  </p>
                  <p className="text-slate-700">
                    Transactions: <strong className="text-slate-900">{statement?.entries.length ?? 0} entries</strong>
                  </p>
                  <p className="text-sm font-bold text-slate-900 pt-1">
                    Current Balance: {formatAmount(selectedCustomer?.outstandingBalance ?? 0, currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 print:border-none print:bg-white print:p-0">
              {statement ? (
                statement.entries.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500">
                    No ledger entries recorded for this date range.
                  </p>
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold print:text-slate-900 print:border-b-2 print:border-slate-800">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Type</th>
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                        {statement.entries.map((entry) => {
                          const rawAmount = Number(entry.amount ?? 0);
                          const type = String(entry.entryType ?? (entry as any).type ?? "").toLowerCase();
                          const isCredit = type === "credit" || rawAmount < 0;
                          const absAmount = Math.abs(rawAmount);

                          return (
                            <tr key={entry.id} className="text-slate-800">
                              <td className="py-2.5 text-slate-500 print:text-slate-700">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2.5">
                                <span
                                  className={`font-semibold text-[10px] tracking-wider px-1.5 py-0.5 rounded ${
                                    isCredit
                                      ? "text-emerald-700 bg-emerald-100 print:bg-transparent print:border print:border-emerald-700"
                                      : "text-slate-600 bg-slate-200/80 print:bg-transparent print:border print:border-slate-600"
                                  }`}
                                >
                                  {entry.entryType ?? (entry as any).type ?? (isCredit ? "credit" : "debit")}
                                </span>
                              </td>
                              <td className="py-2.5 font-medium">
                                {entry.reason ?? (entry as any).description ?? "No description recorded"}
                              </td>
                              <td
                                className={`py-2.5 text-right font-mono font-bold ${
                                  isCredit ? "text-emerald-700" : "text-slate-900"
                                }`}
                              >
                                {isCredit ? `- ${formatAmount(absAmount, currency)}` : formatAmount(absAmount, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-300 print:border-slate-800">
                        <tr className="font-semibold text-slate-700">
                          <td colSpan={3} className="pt-3 text-right">Period Total Debits:</td>
                          <td className="pt-3 text-right font-mono font-bold text-slate-900">
                            {formatAmount(statementSummary.totalDebits, currency)}
                          </td>
                        </tr>
                        <tr className="font-semibold text-slate-700">
                          <td colSpan={3} className="py-1 text-right">Period Total Credits / Payments:</td>
                          <td className="py-1 text-right font-mono font-bold text-emerald-700">
                            - {formatAmount(statementSummary.totalCredits, currency)}
                          </td>
                        </tr>
                        <tr className="font-bold text-slate-900 border-t border-slate-200 print:border-slate-400">
                          <td colSpan={3} className="py-2 text-right">Net Period Movement:</td>
                          <td className="py-2 text-right font-mono font-bold text-slate-950">
                            {formatAmount(statementSummary.netMovement, currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Print-Only Signature & Acknowledgement Footer */}
                    <div className="hidden print:block mt-10 pt-6 border-t border-slate-300 text-xs">
                      <div className="flex justify-between items-end pb-8">
                        <div className="text-center">
                          <div className="w-48 border-b border-slate-400 mb-1" />
                          <p className="text-[10px] uppercase font-bold text-slate-500">Prepared By (Staff)</p>
                        </div>
                        <div className="text-center">
                          <div className="w-48 border-b border-slate-400 mb-1" />
                          <p className="text-[10px] uppercase font-bold text-slate-500">Customer Signature</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-center text-slate-400">
                        This is an official computer-generated statement from CueCloud POS. In case of any discrepancies, please present this statement to the club manager within 7 days.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-center py-6 text-xs text-slate-500">
                  Pick dates above and click <strong>Fetch</strong> to inspect entries.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Manual Adjustment Modal */}
        {showAdjustment && canAdjustLedger && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto print:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              ref={modalRef}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Manual Ledger Adjustment</h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Adjust credit balance directly with an audit trail. Use negative amounts (e.g. -50) to credit/reduce debt.
              </p>

              <form className="mt-4 space-y-3.5" onSubmit={handleAdjustmentSubmit}>
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Target Customer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={customerInputRef}
                    type="text"
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      setAdjustmentForm((cur) => ({ ...cur, customerId: "" }));
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                  {showCustomerDropdown && customerSearch && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                      {filteredCustomerOptions.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400">No matching customers</div>
                      ) : (
                        filteredCustomerOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setAdjustmentForm((cur) => ({ ...cur, customerId: c.id }));
                              setCustomerSearch(`${c.fullName} (${c.phone})`);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs transition hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                          >
                            <p className="font-semibold text-slate-900">{c.fullName}</p>
                            <p className="text-[11px] text-slate-500">
                              {c.phone} · Balance:{" "}
                              <span className="font-bold text-slate-800">
                                {formatAmount(c.outstandingBalance, currency)}
                              </span>
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Adjustment Amount ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="e.g. 100 or -50"
                    value={adjustmentForm.amount}
                    onChange={(e) =>
                      setAdjustmentForm((cur) => ({ ...cur, amount: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Audit Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g., Billing discrepancy correction, Cash received directly"
                    value={adjustmentForm.reason}
                    onChange={(e) =>
                      setAdjustmentForm((cur) => ({ ...cur, reason: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Manager PIN <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter PIN if required"
                    value={adjustmentForm.approvedByPin}
                    onChange={(e) =>
                      setAdjustmentForm((cur) => ({ ...cur, approvedByPin: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {adjustmentState === "success" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
                    ✓ Adjustment saved successfully.
                  </div>
                )}
                {adjustmentState === "error" && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700">
                    ✗ Please verify the fields and try again.
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustmentState === "loading"}
                    className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {adjustmentState === "loading" ? "Saving..." : "Save Adjustment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Settlement Modal */}
        {showSettlement && canSettleDebt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto print:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSettlement(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Record Debt Settlement</h3>
                <button
                  type="button"
                  onClick={() => setShowSettlement(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Log a customer debt payment to clear or reduce their open credit balance.
              </p>

              <form onSubmit={handleSettlementSubmit} className="space-y-3.5">
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Customer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search customer..."
                    value={settlementCustomerSearch}
                    onChange={(e) => {
                      setSettlementCustomerSearch(e.target.value);
                      setShowSettlementDropdown(true);
                      setSettlementForm((cur) => ({ ...cur, customerId: "" }));
                    }}
                    onFocus={() => setShowSettlementDropdown(true)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                  {showSettlementDropdown && settlementCustomerSearch && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                      {filteredSettlementOptions.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400">No matching customers</div>
                      ) : (
                        filteredSettlementOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSettlementForm((cur) => ({
                                ...cur,
                                customerId: c.id,
                                amount: c.outstandingBalance > 0 ? String(c.outstandingBalance) : cur.amount,
                              }));
                              setSettlementCustomerSearch(`${c.fullName || "Customer"} (${c.phone || "No phone"})`);
                              setShowSettlementDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs transition hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                          >
                            <p className="font-semibold text-slate-900">{c.fullName}</p>
                            <p className="text-[11px] text-slate-500">
                              {c.phone} · Balance:{" "}
                              <span className="font-bold text-slate-800">
                                {formatAmount(c.outstandingBalance, currency)}
                              </span>
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Settlement Amount ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 1000"
                    value={settlementForm.amount}
                    onChange={(e) =>
                      setSettlementForm((cur) => ({ ...cur, amount: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Notes / Receipt Memo
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cash received at register, bank ref #4321"
                    value={settlementForm.reason}
                    onChange={(e) =>
                      setSettlementForm((cur) => ({ ...cur, reason: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettlement(false)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settlementSubmitting || !settlementForm.customerId || !settlementForm.amount}
                    className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {settlementSubmitting ? "Processing..." : "Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credit Thresholds Modal */}
        {showThresholds && isOwner && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto print:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowThresholds(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Credit Limit & Governance</h3>
                <button
                  type="button"
                  onClick={() => setShowThresholds(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Set hard limits on allowed customer credit to prevent cashiers from issuing excessive unpaid debt.
              </p>

              <form onSubmit={handleThresholdsSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Individual Customer Credit Ceiling ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={thresholdsForm.individualLimit}
                    onChange={(e) =>
                      setThresholdsForm({
                        ...thresholdsForm,
                        individualLimit: Number(e.target.value),
                      })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Prevents checkout if this customer's balance exceeds this amount.
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Club-Wide Aggregate Limit ({currency}) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={thresholdsForm.aggregateLimit || ""}
                    onChange={(e) =>
                      setThresholdsForm({
                        ...thresholdsForm,
                        aggregateLimit: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="e.g. 100000"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Total unpaid balance permitted across all accounts combined.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowThresholds(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={thresholdsSubmitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {thresholdsSubmitting ? "Saving..." : "Save Limits"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}