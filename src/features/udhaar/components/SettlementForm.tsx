import { FormEvent, useState } from "react";
import { udhaarService } from "../services/udhaarService";
import type { CustomerSummary } from "../types";

interface SettlementFormProps {
  customer: CustomerSummary;
  outstandingBalance: number;
  onSettled: (amount: number) => void;
}

export function SettlementForm({
  customer,
  outstandingBalance,
  onSettled,
}: SettlementFormProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const parsed = Number(amount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive settlement amount.");
      return;
    }

    if (parsed > outstandingBalance) {
      setError(
        "Settlement exceeds the outstanding balance.",
      );
      return;
    }

    if (outstandingBalance === 0) {
      setError("This customer has no outstanding balance.");
      return;
    }

    setSubmitting(true);

    try {
      await udhaarService.recordSettlement({
        customerId: customer.id,
        amount: parsed,
        reason,
      });
      setAmount("");
      setReason("");
      onSettled(parsed);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not record the settlement.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          Record settlement
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Partial or full credit against this customer.
        </p>
      </div>

      <label className="mt-4 block text-xs font-semibold text-slate-600">
        Amount
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={`Outstanding ${outstandingBalance.toFixed(2)}`}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      </label>

      <label className="mt-3 block text-xs font-semibold text-slate-600">
        Reason
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Cash received on account"
          required
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || outstandingBalance === 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitting ? "Recording..." : "Record settlement"}
      </button>
    </form>
  );
}
