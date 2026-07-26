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
  currency,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  remainingAmount: number;
  currency: string | null;
  onClose: () => void;
  onSuccess: (result: PaymentResult) => void;
}) {
  const isOnline = useOnlineStatus();
  const [amount, setAmount] = useState(
    remainingAmount.toFixed(2),
  );
  const [tenderType, setTenderType] =
    useState<TenderType>("cash");
  const [payerLabel, setPayerLabel] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitPayment() {
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > remainingAmount
    ) {
      setError(
        `Enter an amount greater than zero and no more than ${remainingAmount.toFixed(2)}.`,
      );
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
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2
            id="record-payment-title"
            className="text-lg font-semibold text-slate-950"
          >
            Record payment
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Remaining balance:{" "}
            {formatCurrency(remainingAmount, currency)}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!isOnline && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Payments cannot be recorded while this device is offline.
            </p>
          )}

          {error && (
            <p
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={remainingAmount}
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
                setTenderType(event.target.value as TenderType)
              }
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {tenderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitPayment()}
            disabled={submitting || !isOnline}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Recording…" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
