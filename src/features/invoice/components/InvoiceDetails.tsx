"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useInvoice } from "../hooks/useInvoice";
import { formatCurrency } from "../utils/formatCurrency";
import InvoiceItems from "./InvoiceItems";
import InvoicePayments from "./InvoicePayments";
import RecordPaymentModal from "./RecordPaymentModal";
import StatusBadge from "./StatusBadge";
import VoidInvoiceModal from "./VoidInvoiceModal";
import SplitPaymentPanel from "@/features/payments/components/SplitPaymentPanel";

// --- COMPACT JWT TOKEN & ERROR HELPERS ---
function findJwtToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const val = localStorage.getItem(localStorage.key(i) || "");
      if (val?.includes("eyJ")) {
        const m = val.match(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/);
        if (m) return m[0];
      }
    }
  } catch { }
  return null;
}

function parseErrorMessage(err: any): string {
  if (typeof err === "string") return err;
  return err?.message || err?.error || "An error occurred";
}

export default function InvoiceDetails({
  invoiceId,
  backHref = "/billing",
}: {
  invoiceId: string;
  backHref?: string;
}) {
  const { user } = useAuth() as any;
  const isOnline = useOnlineStatus();
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const { invoice, loading, error, refresh, setInvoice } = useInvoice(invoiceId);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (error || !invoice) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="font-semibold text-red-900">Invoice details are unavailable</h1>
        <p className="mt-2 text-sm text-red-700">{error ?? "Invoice not found."}</p>
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

  // --- DYNAMIC TAX & TOTAL CALCULATIONS ---
  const subtotal = Number(invoice.subtotal ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const serviceCharge = Number(invoice.serviceCharge ?? 0);

  // Projected Tax Calculations
  const standardTax = Number((netSubtotal * 0.16).toFixed(2));
  const cardTax = Number((netSubtotal * 0.05).toFixed(2));

  const standardTotal = Number((netSubtotal + standardTax + serviceCharge).toFixed(2));
  const cardTotal = Number((netSubtotal + cardTax + serviceCharge).toFixed(2));

  const paymentsList = invoice.payments ?? [];
  const isFullyPaidByCard =
    paymentsList.length > 0 &&
    paymentsList.every((p) => String(p.tenderType).toLowerCase() === "card");

  // Display saved DB total if paid, or dynamic projected total if open
  const displayTax = invoice.status === "paid"
    ? Number(invoice.taxAmount ?? 0)
    : (isFullyPaidByCard ? cardTax : standardTax);

  const displayTotal = invoice.status === "paid"
    ? Number(invoice.total ?? 0)
    : (isFullyPaidByCard ? cardTotal : standardTotal);

  const paidAmount = paymentsList.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const remainingAmount = Math.max(0, displayTotal - paidAmount);

  const currency = invoice.branch?.currency ?? "PKR";
  const formatAmount = (val: number) => formatCurrency(isNaN(val) ? 0 : val, currency);

  const currentStatus = String(invoice.status);

  const canVoid =
    currentStatus !== "void" &&
    currentStatus !== "voided" &&
    !!user?.roles?.some((role: string) => ["OWNER", "MANAGER"].includes(role));

  const canPay =
    !!user?.roles?.some((role: string) => ["OWNER", "MANAGER", "CASHIER"].includes(role)) &&
    remainingAmount > 0 &&
    ["open", "draft", "partially_paid"].includes(currentStatus);

  const canApplyDiscount =
    currentStatus !== "void" &&
    currentStatus !== "voided" &&
    currentStatus !== "paid" &&
    !!user?.roles?.some((role: string) => ["OWNER", "MANAGER", "CASHIER"].includes(role));

  return (
    <main className="mx-auto w-full max-w-6xl pb-12">

      <Link href={backHref} className="text-sm font-semibold text-slate-600 hover:text-emerald-700">
        ← Back to billing
      </Link>

      <header className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Billing</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {invoice.invoiceNumber ?? "Invoice details"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Created{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(invoice.createdAt)
            )}{" "}
            · {invoice.branch?.name ?? "Current branch"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.receiptId && (
            <Link
              href={`/receipts/${invoice.receiptId}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View receipt
            </Link>
          )}
          {canApplyDiscount && (
            <button
              type="button"
              onClick={() => setShowDiscountModal(true)}
              disabled={!isOnline}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Discount
            </button>
          )}
          {canPay && (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Record payment
            </button>
          )}
          {canVoid && (
            <button
              type="button"
              onClick={() => setShowVoidModal(true)}
              disabled={!isOnline}
              className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Void invoice
            </button>
          )}
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Total" value={formatAmount(displayTotal)} />
        <Summary label="Paid" value={formatAmount(paidAmount)} />
        <Summary label="Remaining" value={formatAmount(remainingAmount)} />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Status</p>
          <div className="mt-4">
            <StatusBadge status={invoice.status} />
          </div>
        </article>
      </section>

      {/* --- DUAL TAX COMPARISON CARD FOR OPEN INVOICES --- */}
      {invoice.status !== "paid" && invoice.status !== "void" && (
        <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900">
            💡 Settlement Tax Comparison (PRA Rules)
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-sm">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                100% Card Payment (5% Tax)
              </span>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatAmount(cardTotal)}</p>
              <p className="text-xs text-slate-500">
                Tax: {formatAmount(cardTax)} · Save {formatAmount(standardTax - cardTax)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                Cash / Udhaar / Wallet (16% Tax)
              </span>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatAmount(standardTotal)}</p>
              <p className="text-xs text-slate-500">Tax: {formatAmount(standardTax)}</p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Session context</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Table" value={invoice.session?.table?.tableNumber ? `Table ${invoice.session.table.tableNumber}` : "Not linked"} />
            <Detail label="Session" value={invoice.sessionId ? invoice.sessionId : "Not linked"} />
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Customer context</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Detail
              label="Customer"
              value={
                <span className="flex items-center gap-2">
                  <span>{invoice.customer?.fullName ?? "Walk-in customer"}</span>
                  {invoice.customer?.isBlocked && (
                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                      Blocked
                    </span>
                  )}
                </span>
              }
            />
            <Detail label="Phone" value={invoice.customer?.phone ?? "Not recorded"} />
          </dl>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Amount breakdown</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Detail label="Subtotal" value={formatAmount(subtotal)} />
          <Detail label="Discount" value={formatAmount(discountAmount)} />
          <Detail
            label={`Tax (${isFullyPaidByCard ? "5% Card" : "16% Standard"})`}
            value={formatAmount(displayTax)}
          />
          <Detail label="Service charge" value={formatAmount(serviceCharge)} />
          <Detail label="Total" value={formatAmount(displayTotal)} />
        </dl>
      </section>

      <div className="mt-5 space-y-5">
        <InvoiceItems items={invoice.items} currency={currency} />

        {remainingAmount > 0 && invoice.status !== "paid" && invoice.status !== "void" ? (
          <SplitPaymentPanel
            invoiceId={invoice.id}
            standardTotal={standardTotal}
            cardTotal={cardTotal}
            onSuccess={() => void refresh()}
            isCustomerBlocked={Boolean(invoice.customer?.isBlocked)}
            customerName={invoice.customer?.fullName ?? null}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No additional tender allocation is needed because this invoice is fully covered.
          </div>
        )}

        <InvoicePayments payments={invoice.payments} currency={currency} />
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          invoiceId={invoice.id}
          remainingAmount={remainingAmount}
          standardTotal={standardTotal}
          cardTotal={cardTotal}
          currency={currency}
          isCustomerBlocked={Boolean(invoice.customer?.isBlocked)}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(result) => {
            if (result?.invoice) {
              setInvoice(result.invoice);
            }
            setShowPaymentModal(false);
            void refresh();
            toast.success("Payment recorded successfully.");
          }}
        />
      )}

      {showDiscountModal && (
        <ApplyDiscountModal
          invoiceId={invoice.id}
          onClose={() => setShowDiscountModal(false)}
          onSuccess={() => {
            setShowDiscountModal(false);
            void refresh();
            toast.success("Invoice discount applied successfully.");
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

// --- DISCOUNT MODAL COMPONENT ---
function ApplyDiscountModal({
  invoiceId,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth() as any;
  const isOwnerOrManager =
    user?.isOwner ||
    user?.roles?.some((role: string) =>
      ["OWNER", "MANAGER", "ADMIN"].includes(String(role).toUpperCase())
    );

  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [managerPin, setManagerPin] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid discount amount.");
      return;
    }

    if (!reason.trim()) {
      setError("Reason code / explanation is required.");
      return;
    }

    if (!isOwnerOrManager && !managerPin.trim()) {
      setError("Manager PIN approval is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const token = findJwtToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const rawBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
      const res = await fetch(`${rawBase}/api/v1/billing/invoices/${invoiceId}/discount`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          discountType,
          amount: numericAmount,
          reason,
          managerPin: managerPin.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseErrorMessage(errData));
      }

      onSuccess();
    } catch (err: any) {
      setError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-900">Apply Invoice Discount</h2>
        <p className="mt-1 text-xs text-slate-500">
          {isOwnerOrManager ? "Auto-authorized under your Owner/Manager account." : "Requires reason code and manager authorization PIN."}
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Discount Type</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType("fixed")}
                className={`rounded-xl border py-2 text-xs font-semibold ${discountType === "fixed" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                Fixed PKR
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("percentage")}
                className={`rounded-xl border py-2 text-xs font-semibold ${discountType === "percentage" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                Percentage %
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Discount Value ({discountType === "fixed" ? "PKR" : "%"})</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder={discountType === "fixed" ? "100" : "10"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Reason Code / Note *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              required
            >
              <option value="">Select a reason...</option>
              <option value="Customer Loyalty">Customer Loyalty</option>
              <option value="Promotional Offer">Promotional Offer</option>
              <option value="Service Quality Issue">Service Quality Issue</option>
              <option value="Manager Approval">Manager Discretionary Special</option>
            </select>
          </div>

          {!isOwnerOrManager && (
            <div>
              <label className="block text-xs font-semibold text-slate-700">Manager Authorization PIN *</label>
              <input
                type="password"
                placeholder="Enter Manager PIN"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? "Applying..." : "Apply Discount"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
    </div>
  );
}