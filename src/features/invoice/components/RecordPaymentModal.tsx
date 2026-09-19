"use client";

import { useState } from "react";

import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { invoiceService } from "../services/invoiceService";
import type {
  PaymentResult,
  TenderType,
} from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";

const tenderOptions: Array<{
  value: TenderType;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_wallet", label: "Mobile wallet" },
  { value: "udhaar", label: "Udhaar / credit" },
  { value: "other", label: "Other" },
];

export default function RecordPaymentModal({
  invoiceId,
  remainingAmount,
  standardTotal,
  cardTotal,
  currency,
  isCustomerBlocked = false,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  remainingAmount: number;
  standardTotal?: number;
  cardTotal?: number;
  currency: string | null;
  isCustomerBlocked?: boolean;
  onClose: () => void;
  onSuccess: (result: PaymentResult) => void;
}) {
  const isOnline = useOnlineStatus();
  const [tenderType, setTenderType] = useState<TenderType>("cash");

  const effectiveRemaining =
    tenderType === "card" && cardTotal !== undefined
      ? cardTotal
      : remainingAmount;

  const [amount, setAmount] = useState(effectiveRemaining.toFixed(2));
  const [payerLabel, setPayerLabel] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleTenderTypeChange(newType: TenderType) {
    setTenderType(newType);
    setError("");

    // Auto-adjust default amount to respective total
    if (newType === "card" && cardTotal !== undefined) {
      setAmount(cardTotal.toFixed(2));
    } else if (tenderType === "card") {
      setAmount(remainingAmount.toFixed(2));
    }
  }

  async function submitPayment() {
    const numericAmount = Number(amount);
    const maxAllowed =
      tenderType === "card" && cardTotal !== undefined
        ? cardTotal
        : remainingAmount;

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > Number((maxAllowed + 0.05).toFixed(2))
    ) {
      setError(
        `Enter an amount greater than zero and no more than ${formatCurrency(maxAllowed, currency)}.`,
      );
      return;
    }

    if (tenderType === "udhaar" && isCustomerBlocked) {
      setError("Customer is marked as blocked and cannot receive credit (udhaar).");
      return;
    }

    if (!isOnline) {
      setError("Reconnect before recording a payment.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await invoiceService.addPayment(invoiceId, {
        amount: numericAmount,
        tenderType,
        ...(payerLabel.trim()
          ? { payerLabel: payerLabel.trim() }
          : {}),
        ...(paymentReference.trim()
          ? { paymentReference: paymentReference.trim() }
          : {}),
      });
      onSuccess(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The payment could not be recorded.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2
              id="record-payment-title"
              className="font-semibold text-slate-900"
            >
              Record payment
            </h2>
            <p className="text-xs text-slate-500">
              Remaining balance: {formatCurrency(effectiveRemaining, currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {tenderType === "card" && cardTotal !== undefined && standardTotal !== undefined && standardTotal > cardTotal && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <div className="flex items-center gap-1.5 font-bold">
              <span>💡 PRA 5% Card Tax Concession Applied</span>
            </div>
            <p className="mt-1 text-emerald-800">
              Card payments receive a reduced 5% sales tax rate (saving {formatCurrency(standardTotal - cardTotal, currency)}). Total due is {formatCurrency(cardTotal, currency)}.
            </p>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitPayment();
          }}
          className="mt-4 space-y-4"
        >
          <label className="block text-sm font-medium text-slate-700">
            Amount
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              max={effectiveRemaining}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Payment method
            <select
              value={tenderType}
              onChange={(event) =>
                handleTenderTypeChange(event.target.value as TenderType)
              }
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {tenderOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === "udhaar" && isCustomerBlocked}
                >
                  {option.label}
                  {option.value === "udhaar" && isCustomerBlocked
                    ? " (Blocked - Restricted)"
                    : ""}
                </option>
              ))}
            </select>
            {tenderType === "udhaar" && isCustomerBlocked && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                Customer is marked as blocked and cannot receive credit.
              </p>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Payer label{" "}
            <span className="font-normal text-slate-400">(optional)</span>
            <input
              value={payerLabel}
              maxLength={120}
              onChange={(event) =>
                setPayerLabel(event.target.value)
              }
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Payment reference{" "}
            <span className="font-normal text-slate-400">(optional)</span>
            <input
              value={paymentReference}
              maxLength={255}
              onChange={(event) =>
                setPaymentReference(event.target.value)
              }
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          {tenderType === "cash" && (
            <p className="text-xs leading-5 text-slate-500">
              If the backend has a configured cash-drawer adapter, it
              will be requested only after this cash payment commits.
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isOnline}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Recording…" : "Record payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
