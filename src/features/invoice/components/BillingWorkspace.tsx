"use client";

import { FormEvent, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useInvoices } from "../hooks/useInvoices";
import { useTransactions } from "../hooks/useTransactions";
import type { InvoiceStatus } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";
import InvoiceTable from "./InvoiceTable";
import TransactionTable from "./TransactionTable";
import { fetchBranches } from "@/lib/api/branch";
import type { BranchItem } from "@/types/branch";
import { useEffect } from "react";

const statusOptions: Array<{
  value: "" | InvoiceStatus;
  label: string;
}> = [
    { value: "", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "partially_paid", label: "Partially paid" },
    { value: "paid", label: "Paid" },
    { value: "void", label: "Voided" },
    { value: "draft", label: "Draft" },
  ];

function dateRange(date: string) {
  if (!date) return {};

  const from = new Date(`${date}T00:00:00`);
  const to = new Date(`${date}T23:59:59.999`);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export default function BillingWorkspace({
  detailBasePath = "/billing",
}: {
  detailBasePath?: string;
}) {
  const isOnline = useOnlineStatus();
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [date, setDate] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [branchId, setBranchId] = useState("");
  useEffect(() => { void fetchBranches({ limit: 100 }).then((result) => setBranches(result.branches)); }, []);
  useEffect(() => { setBranchId(""); setInvoicePage(1); }, [user?.branchId]);
  const range = useMemo(() => dateRange(date), [date]);

  const {
    invoices,
    pagination,
    loading,
    error,
    refresh,
  } = useInvoices({
    page: invoicePage,
    pageSize: 25,
    search: search || undefined,
    status: status || undefined,
    ...range,
    branchId: branchId || undefined,
  });
  const transactionState = useTransactions({
    page: transactionPage,
    pageSize: 25,
    ...range,
  });

  const summary = useMemo(() => {
    const safeInvoices = invoices || [];

    return {
      outstanding: safeInvoices.reduce(
        (total, invoice) => total + (invoice?.remainingAmount || 0),
        0,
      ),
      collected: safeInvoices.reduce(
        (total, invoice) => total + (invoice?.paidAmount || 0),
        0,
      ),
      voided: safeInvoices.filter(
        (invoice) => invoice?.status === "void",
      ).length,
    };
  }, [invoices]);

  const displayCurrency =
    (invoices || []).find((invoice) => invoice?.branch?.currency)?.branch
      ?.currency ?? "PKR";

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvoicePage(1);
    setSearch(searchInput.trim());
  }

  return (
    <main className="mx-auto w-full max-w-7xl pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Finance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Billing and transactions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review branch-scoped invoices, balances, payment
            transactions, and receipt links backed by PostgreSQL data.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isOnline
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
            }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"
              }`}
          />
          {isOnline ? "Connected" : "Offline · actions disabled"}
        </span>
      </header>

      <section
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Current result summary"
      >
        <SummaryCard
          label="Invoices shown"
          value={String(invoices?.length ?? 0)}
          detail={`${pagination?.total ?? 0} match current filters`}
        />
        <SummaryCard
          label="Outstanding shown"
          value={formatCurrency(summary.outstanding, displayCurrency)}
          detail="Calculated from visible invoices"
        />
        <SummaryCard
          label="Collected shown"
          value={formatCurrency(summary.collected, displayCurrency)}
          detail="Calculated from visible invoices"
        />
        <SummaryCard
          label="Voided shown"
          value={String(summary.voided)}
          detail="Visible invoices marked void"
        />
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h2 className="font-semibold text-slate-950">
                Invoices
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search by invoice number or narrow the real result set.
              </p>
            </div>
            <form
              onSubmit={applySearch}
              className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_160px_160px_160px_auto]"
            >
              <label className="sr-only" htmlFor="invoice-search">
                Search invoice number
              </label>
              <input
                id="invoice-search"
                type="search"
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
                placeholder="Invoice number"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <label className="sr-only" htmlFor="invoice-status">
                Invoice status
              </label>
              <select
                id="invoice-status"
                value={status}
                onChange={(event) => {
                  setInvoicePage(1);
                  setStatus(
                    event.target.value as "" | InvoiceStatus,
                  );
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="invoice-branch">Invoice branch</label>
              <select id="invoice-branch" value={branchId} onChange={(event) => { setInvoicePage(1); setBranchId(event.target.value); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500">
                <option value="">Active branch</option>
                <option value="all">All branches</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name ?? "Unnamed branch"}</option>)}
              </select>
              <label className="sr-only" htmlFor="invoice-date">
                Invoice date
              </label>
              <input
                id="invoice-date"
                type="date"
                value={date}
                onChange={(event) => {
                  setInvoicePage(1);
                  setTransactionPage(1);
                  setDate(event.target.value);
                }}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {loading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} retry={refresh} />
        ) : (
          <>
            <InvoiceTable
              invoices={invoices}
              detailBasePath={detailBasePath}
            />
            {pagination && (
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPage={setInvoicePage}
              />
            )}
          </>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <h2 className="font-semibold text-slate-950">
            Payment transactions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Invoice-specific payment records from the current branch.
          </p>
        </div>

        {transactionState.loading ? (
          <LoadingRows />
        ) : transactionState.error ? (
          <ErrorState
            message={transactionState.error}
            retry={transactionState.refresh}
          />
        ) : (
          <>
            <TransactionTable
              transactions={transactionState.transactions}
            />
            <PaginationControls
              page={transactionState?.pagination?.page ?? 1}
  totalPages={transactionState?.pagination?.totalPages ?? 1}
              onPage={setTransactionPage}
            />
          </>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function LoadingRows() {
  return (
    <div
      className="space-y-3 border-t border-slate-200 p-5"
      aria-label="Loading billing records"
    >
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-12 animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => Promise<void>;
}) {
  return (
    <div className="border-t border-slate-200 px-6 py-10 text-center">
      <h3 className="font-semibold text-red-800">
        Billing data could not be loaded
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-red-600">
        {message}
      </p>
      <button
        type="button"
        onClick={() => void retry()}
        className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Retry
      </button>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
      <p className="text-xs text-slate-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}