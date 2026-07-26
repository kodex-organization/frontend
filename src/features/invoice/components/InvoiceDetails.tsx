"use client";

import Link from "next/link";
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useInvoice } from "../hooks/useInvoice";
import { formatCurrency } from "../utils/formatCurrency";
import InvoiceItems from "./InvoiceItems";
import InvoicePayments from "./InvoicePayments";
import RecordPaymentModal from "./RecordPaymentModal";
import StatusBadge from "./StatusBadge";
import VoidInvoiceModal from "./VoidInvoiceModal";

export default function InvoiceDetails({
  invoiceId,
  backHref = "/billing",
}: {
  invoiceId: string;
  backHref?: string;
}) {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] =
    useState(false);
  const {
    invoice,
    loading,
    error,
    refresh,
    setInvoice,
  } = useInvoice(invoiceId);

  if (loading) {
    return (
      <div
        className="space-y-4"
        aria-label="Loading invoice details"
      >
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="font-semibold text-red-900">
          Invoice details are unavailable
        </h1>
        <p className="mt-2 text-sm text-red-700">
          {error ?? "Invoice not found."}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          Retry
        </button>
      </section>
    );
  }

  const currency = invoice.branch.currency;
  const formatAmount = (value: number) =>
    formatCurrency(value, currency);
  const canVoid =
    invoice.status !== "void" &&
    invoice.paidAmount === 0 &&
    !!user?.roles.some((role) =>
      ["OWNER", "MANAGER"].includes(role),
    );
  const canPay =
    !!user?.roles.some((role) =>
      ["OWNER", "MANAGER", "CASHIER"].includes(role),
    ) &&
    invoice.remainingAmount > 0 &&
    (invoice.status === "open" ||
      invoice.status === "partially_paid");

  return (
    <main className="mx-auto w-full max-w-6xl pb-12">
      <ToastContainer position="top-right" />

      <Link
        href={backHref}
        className="text-sm font-semibold text-slate-600 hover:text-emerald-700"
      >
        ← Back to billing
      </Link>

      <header className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Billing
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {invoice.invoiceNumber ?? "Invoice details"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Created{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(invoice.createdAt))}
            {" · "}
            {invoice.branch.name ?? "Current branch"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.receiptId &&
            user?.roles.some((role) =>
              ["OWNER", "MANAGER", "CASHIER"].includes(role),
            ) && (
            <Link
              href={`/receipts/${invoice.receiptId}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View receipt
            </Link>
          )}
          {canPay && (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              disabled={!isOnline}
              title={
                isOnline
                  ? undefined
                  : "Reconnect to record a payment"
              }
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Record payment
            </button>
          )}
          {canVoid && (
            <button
              type="button"
              onClick={() => setShowVoidModal(true)}
              disabled={!isOnline}
              title={
                isOnline
                  ? undefined
                  : "Reconnect to void this invoice"
              }
              className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Void invoice
            </button>
          )}
        </div>
      </header>

      {!isOnline && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You are offline. Current data remains visible, but payments,
          voids, and receipt printing are disabled.
        </p>
      )}

      {invoice.status === "void" && (
        <section className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-red-900">
                This invoice is voided
              </h2>
              <p className="mt-1 text-sm text-red-700">
                {invoice.voidReason ?? "No void reason was recorded."}
              </p>
            </div>
            {invoice.voidedAt && (
              <time className="text-xs font-medium text-red-700">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(invoice.voidedAt))}
              </time>
            )}
          </div>
        </section>
      )}

      <section
        className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Invoice totals"
      >
        <Summary
          label="Total"
          value={formatAmount(invoice.total)}
        />
        <Summary
          label="Paid"
          value={formatAmount(invoice.paidAmount)}
        />
        <Summary
          label="Remaining"
          value={formatAmount(invoice.remainingAmount)}
        />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Status</p>
          <div className="mt-4">
            <StatusBadge status={invoice.status} />
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">
            Session context
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Detail
              label="Table"
              value={
                invoice.session?.table?.tableNumber
                  ? `Table ${invoice.session.table.tableNumber}`
                  : "Not linked"
              }
            />
            <Detail
              label="Session"
              value={
                invoice.sessionId
                  ? invoice.sessionId
                  : "Not linked"
              }
            />
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">
            Customer context
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Detail
              label="Customer"
              value={
                invoice.customer?.fullName ?? "Walk-in customer"
              }
            />
            <Detail
              label="Phone"
              value={invoice.customer?.phone ?? "Not recorded"}
            />
          </dl>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">
          Amount breakdown
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Detail
            label="Subtotal"
            value={formatAmount(invoice.subtotal)}
          />
          <Detail
            label="Discount"
            value={formatAmount(invoice.discountAmount)}
          />
          <Detail
            label="Tax"
            value={formatAmount(invoice.taxAmount)}
          />
          <Detail
            label="Service charge"
            value={formatAmount(invoice.serviceCharge)}
          />
          <Detail
            label="Total"
            value={formatAmount(invoice.total)}
          />
        </dl>
      </section>

      <div className="mt-5 space-y-5">
        <InvoiceItems
          items={invoice.items}
          currency={currency}
        />
        <InvoicePayments
          payments={invoice.payments}
          currency={currency}
        />
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          invoiceId={invoice.id}
          remainingAmount={invoice.remainingAmount}
          currency={currency}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(result) => {
            setInvoice(result.invoice);
            setShowPaymentModal(false);
            toast.success("Payment recorded successfully.");

            if (result.cashDrawer) {
              const drawer = result.cashDrawer;
              if (drawer.status === "opened") {
                toast.success(drawer.message);
              } else if (
                drawer.status === "failed" ||
                drawer.status === "disabled"
              ) {
                toast.warning(drawer.message);
              } else {
                toast.info(drawer.message);
              }
            }
          }}
        />
      )}

      {showVoidModal && (
        <VoidInvoiceModal
          invoice={invoice}
          onClose={() => setShowVoidModal(false)}
          onSuccess={(updated) => {
            setInvoice(updated);
            setShowVoidModal(false);
            toast.success("Invoice voided and audit record created.");
          }}
        />
      )}
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className="mt-1 break-words font-medium text-slate-800"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
