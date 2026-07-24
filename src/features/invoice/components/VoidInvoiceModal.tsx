"use client";

import { useState } from "react";

import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { invoiceService } from "../services/invoiceService";
import type { Invoice } from "../types/invoice";

export default function VoidInvoiceModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: (invoice: Invoice) => void;
}) {
  const isOnline = useOnlineStatus();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirmVoid() {
    if (reason.trim().length < 3) {
      setError("Enter a clear reason of at least 3 characters.");
      return;
    }

    if (!isOnline) {
      setError("Reconnect before voiding an invoice.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      onSuccess(
        await invoiceService.voidInvoice(
          invoice.id,
          reason.trim(),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The invoice could not be voided.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-invoice-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2
            id="void-invoice-title"
            className="text-lg font-semibold text-slate-950"
          >
            Void invoice {invoice.invoiceNumber ?? ""}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your authenticated OWNER or MANAGER role authorizes this
            action. No manager password is collected in the browser.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            The invoice and its payment history remain in the audit
            trail, but no further payments or prints will be allowed.
          </p>

          {!isOnline && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Invoice voiding is unavailable offline.
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
            Reason
            <textarea
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </label>
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
            onClick={() => void confirmVoid()}
            disabled={submitting || !isOnline}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Voiding…" : "Confirm void"}
          </button>
        </div>
      </div>
    </div>
  );
}
