"use client";

import { useState } from "react";

interface Props {
  isReprint: boolean;
  hasUnresolvedPrint: boolean;
  isOnline: boolean;
  onConfirm: (reprintReason: string | null) => void;
  onClose: () => void;
  loading: boolean;
}

export default function PrintConfirmModal({
  isReprint,
  hasUnresolvedPrint,
  isOnline,
  onConfirm,
  onClose,
  loading,
}: Props) {
  const [reason, setReason] = useState("");
  const normalizedReason = reason.trim();
  const reasonIsValid = !isReprint || normalizedReason.length >= 5;
  const canConfirm = isOnline && !loading && reasonIsValid;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-receipt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h3
          id="print-receipt-title"
          className="mb-3 text-lg font-semibold text-gray-800"
        >
          {hasUnresolvedPrint
            ? "Resolve Receipt Output"
            : isReprint
              ? "Reprint Receipt"
              : "Print Receipt"}
        </h3>

        <p className="text-gray-600">
          {hasUnresolvedPrint
            ? "The prior output result is unknown. Once its server reservation expires, a new copy is audited as a reprint and requires a reason."
            : isReprint
            ? "A reprint is audited with your user, device, copy number, and reason."
            : "The server will use its configured receipt-printer adapter."}
        </p>

        {isReprint && (
          <label className="mt-5 block text-sm font-medium text-gray-700">
            Reprint reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={loading}
              maxLength={500}
              rows={4}
              placeholder="Explain why another copy is required"
              className="mt-2 w-full rounded-xl border border-gray-300 p-3 font-normal outline-none focus:border-green-600"
            />
            <span className="mt-1 block text-xs text-gray-500">
              At least 5 characters; stored in the receipt audit history.
            </span>
          </label>
        )}

        {!isOnline && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Printing is unavailable offline. Reconnect before confirming.
          </p>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Development mode generates a simulated printable artifact and never
          reports a physical print or drawer opening.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(isReprint ? normalizedReason : null)
            }
            disabled={!canConfirm}
            className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Printing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
