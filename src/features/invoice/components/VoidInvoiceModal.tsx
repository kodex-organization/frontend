"use client";

import { useState } from "react";
import { invoiceService } from "../services/invoiceService";

interface Props {
  invoiceId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function VoidInvoiceModal({
  invoiceId,
  onClose,
  onSuccess,
}: Props) {
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirmVoid() {
    if (
      !managerEmail.trim() ||
      !managerPassword.trim() ||
      !reason.trim()
    ) {
      alert("Please complete all fields.");
      return;
    }

    try {
      setLoading(true);

      // Backend currently ignores these fields.
      // They are collected here for future integration
      // with Developer 2 & Developer 6.

      await invoiceService.voidInvoice(invoiceId);

      alert("Invoice voided successfully.");

      onSuccess?.();
      onClose();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to void invoice."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/40
        px-4
      "
    >
      <div
        className="
          w-full
          max-w-md
          rounded-2xl
          bg-white
          shadow-xl
        "
      >
        {/* Header */}

        <div className="border-b p-5">
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-full
                bg-red-100
                text-xl
              "
            >
              ⚠️
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Void Invoice
              </h2>

              <p className="text-sm text-gray-500">
                Manager approval is required.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-green-50 border border-green-100 p-4">
            <p className="text-xs text-gray-500">
              Invoice ID
            </p>

            <p className="mt-1 break-all font-semibold text-gray-800">
              {invoiceId}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">
              Manager Email
            </label>

            <input
              type="email"
              value={managerEmail}
              onChange={(e) =>
                setManagerEmail(e.target.value)
              }
              placeholder="manager@example.com"
              className="
                w-full
                rounded-xl
                border
                p-3
                outline-none
                focus:border-green-500
              "
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">
              Manager Password
            </label>

            <input
              type="password"
              value={managerPassword}
              onChange={(e) =>
                setManagerPassword(e.target.value)
              }
              placeholder="Enter password"
              className="
                w-full
                rounded-xl
                border
                p-3
                outline-none
                focus:border-green-500
              "
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">
              Reason
            </label>

            <textarea
              rows={3}
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              placeholder="Reason for voiding this invoice"
              className="
                w-full
                rounded-xl
                border
                p-3
                outline-none
                resize-none
                focus:border-green-500
              "
            />
          </div>

          <div
            className="
              rounded-xl
              border
              border-red-200
              bg-red-50
              p-3
            "
          >
            <p className="text-sm text-red-700">
              This invoice will remain in history and be
              marked as VOIDED. It cannot be edited after
              being voided.
            </p>
          </div>
        </div>

        {/* Footer */}

        <div className="flex justify-end gap-3 border-t p-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="
              rounded-xl
              border
              px-5
              py-2
              hover:bg-gray-100
            "
          >
            Cancel
          </button>

          <button
            onClick={confirmVoid}
            disabled={loading}
            className="
              rounded-xl
              bg-red-600
              px-5
              py-2
              text-white
              hover:bg-red-700
              disabled:opacity-50
            "
          >
            {loading ? "Voiding..." : "Void Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}