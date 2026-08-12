"use client";

import { useMemo, useState, useRef, useEffect, type FormEvent } from "react";

import { useUdhaarLedger } from "@/features/udhaar/hooks/useUdhaarLedger";

const statusOptions = ["all", "pending", "cleared", "overdue"] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "PKR" }).format(value);
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
  const {
    filteredCustomers,
    aging,
    loading,
    error,
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

  useEffect(() => {
    if (!showAdjustment) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handleEscape);
    customerInputRef.current?.focus();
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showAdjustment]);

  const closeModal = () => {
    setShowAdjustment(false);
    setAdjustmentForm({ customerId: "", amount: "", reason: "", approvedByPin: "" });
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setAdjustmentState("idle");
  };

  const openAdjustmentModal = (customerId?: string) => {
  if (customerId) {
    const customer = filteredCustomers.find((c) => c.id === customerId);
    setAdjustmentForm((current) => ({ ...current, customerId }));
    setCustomerSearch(customer?.fullName ?? ""); // 👈 Set to clean name so search matches
  } else {
    setAdjustmentForm({ customerId: "", amount: "", reason: "", approvedByPin: "" });
    setCustomerSearch("");
  }
  setShowCustomerDropdown(false);
  setAdjustmentState("idle");
  setShowAdjustment(true);
};

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Outstanding",
        value: aging ? formatCurrency(aging.summary.totalOutstanding) : "—",
        tone: "bg-slate-900 text-white border-slate-800",
        accent: "text-slate-400",
      },
      {
        label: "Overdue Balance",
        value: aging ? formatCurrency(aging.summary.overdueBalance) : "—",
        tone: "bg-amber-500 text-white border-amber-600",
        accent: "text-amber-100",
      },
      {
        label: "Active Accounts",
        value: aging ? String(aging.summary.activeAccounts) : "—",
        tone: "bg-emerald-600 text-white border-emerald-700",
        accent: "text-emerald-100",
      },
    ],
    [aging]
  );

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
      setTimeout(() => closeModal(), 1200);
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

  if (loading) {
    return (
      <section className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="max-w-7xl mx-auto m-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
        <h3 className="font-semibold text-lg">Failed to load Udhaar Ledger</h3>
        <p className="mt-1 text-sm text-rose-600">{error}</p>
        <button
          className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800"
          onClick={() => void refresh()}
        >
          Retry Connection
        </button>
      </section>
    );
  }

  return (
    <main className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Finance & Credit
            </p>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
            Udhaar Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor customer credit balances, aging buckets, and manual ledger adjustments.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          onClick={() => openAdjustmentModal()}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Manual Adjustment
        </button>
      </header>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md ${card.tone}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider ${card.accent}`}>
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{card.value}</p>
          </article>
        ))}
      </section>

      {/* Aging Analysis Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aging Analysis</h2>
            <p className="text-xs text-slate-500">Outstanding credit balances grouped by debt age.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
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

              const isOverdueBucket = bucket === "days90plus";

              return (
                <div
                  key={bucket}
                  className={`rounded-xl border p-4 transition ${
                    isOverdueBucket && value > 0
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-slate-200/80 bg-slate-50/50"
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p
                    className={`mt-2 text-lg font-bold ${
                      isOverdueBucket && value > 0 ? "text-amber-700" : "text-slate-900"
                    }`}
                  >
                    {formatCurrency(value)}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="col-span-full py-4 text-center text-sm text-slate-400">
              No aging breakdown available.
            </p>
          )}
        </div>
      </section>

      {/* Main Unified Customer Ledger Table */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Customer Ledger</h2>
              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {filteredCustomers.length}
              </span>
            </div>
            <p className="text-xs text-slate-500">Filter and view customer account balances.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or phone..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all"
                    ? "All Statuses"
                    : option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">No customer accounts found</p>
            <p className="mt-1 text-xs text-slate-500">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="flex flex-col gap-4 p-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                    {getInitials(customer.fullName ?? "")}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {customer.fullName ?? "Unnamed Customer"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customer.phone ?? "No Phone"}{" "}
                      <span className="text-slate-300">|</span>{" "}
                      {customer.cnic ? `CNIC: ${customer.cnic}` : "No CNIC registered"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      customer.status === "overdue"
                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
                        : customer.status === "pending"
                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                    }`}
                  >
                    {customer.status}
                  </span>

                  <span className="text-base font-extrabold text-slate-900 min-w-[90px] text-right">
                    {formatCurrency(customer.outstandingBalance)}
                  </span>

                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                    onClick={() => void handleStatementOpen(customer.id)}
                  >
                    Statement
                  </button>

                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                    onClick={() => openAdjustmentModal(customer.id)}
                  >
                    Adjust
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Customer Statement Drawer */}
      {selectedCustomerId && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Customer Statement</h2>
              <p className="text-xs text-slate-500">
                Select a date range to generate and inspect itemized ledger entries.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={statementRange.from}
                onChange={(event) =>
                  setStatementRange((current) => ({ ...current, from: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={statementRange.to}
                onChange={(event) =>
                  setStatementRange((current) => ({ ...current, to: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                onClick={() => void handleStatementView()}
              >
                Fetch
              </button>
              {statement && (
                <>
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => window.print()}
                  >
                    Print
                  </button>
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={exportStatement}
                  >
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
            {statement ? (
              statement.entries.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-500">
                  No ledger entries recorded for this date range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Description / Reason</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {statement.entries.map((entry) => (
                        <tr key={entry.id} className="text-slate-800">
                          <td className="py-2.5 text-slate-500">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5">
                            <span className="font-semibold uppercase text-[10px] tracking-wider text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded">
                              {entry.entryType ?? "ADJUSTMENT"}
                            </span>
                          </td>
                          <td className="py-2.5 font-medium">
                            {entry.reason ?? "No reason recorded"}
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-900">
                            {formatCurrency(entry.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <p className="text-center py-6 text-xs text-slate-500">
                Pick a starting and ending date above, then click <strong>Fetch</strong> to view the customer's itemized statement.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustment && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            ref={modalRef}
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-900">Manual Udhaar Adjustment</h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Adjust customer credit balance directly with a required audit reason. Use negative numbers (e.g. -20) to record payments or reduce balance.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleAdjustmentSubmit}>
                {/* Customer Dropdown */}
                <div className="relative">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Customer
                  </label>
                  <input
                    ref={customerInputRef}
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      setAdjustmentForm((current) => ({ ...current, customerId: "" }));
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {showCustomerDropdown && customerSearch && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {filteredCustomerOptions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">No customers found</div>
                      ) : (
                        filteredCustomerOptions.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setAdjustmentForm((current) => ({
                                ...current,
                                customerId: customer.id,
                              }));
                              setCustomerSearch(
                                `${customer.fullName} (${customer.phone})`
                              );
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs transition hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <p className="font-semibold text-slate-900">{customer.fullName}</p>
                            <p className="text-slate-500">
                              {customer.phone} · Balance:{" "}
                              <span className="font-medium text-slate-700">
                                {formatCurrency(customer.outstandingBalance)}
                              </span>
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Amount (PKR)
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="e.g. 50 or -20"
                    value={adjustmentForm.amount}
                    onChange={(e) =>
                      setAdjustmentForm((current) => ({ ...current, amount: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Reason Input */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Reason
                  </label>
                  <textarea
                    required
                    placeholder="e.g., Opening balance adjustment, System correction"
                    value={adjustmentForm.reason}
                    onChange={(e) =>
                      setAdjustmentForm((current) => ({ ...current, reason: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    rows={2}
                  />
                </div>

                {/* Manager PIN (Optional) */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Manager PIN <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter PIN if required"
                    value={adjustmentForm.approvedByPin}
                    onChange={(e) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        approvedByPin: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Status Alerts */}
                {adjustmentState === "success" && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                    ✓ Adjustment saved successfully.
                  </div>
                )}
                {adjustmentState === "error" && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                    ✗ Unable to save adjustment. Check fields and try again.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={adjustmentState === "loading"}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {adjustmentState === "loading" ? "Saving..." : "Save Adjustment"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </main>
  );
}