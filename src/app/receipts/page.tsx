"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { receiptService } from "@/features/receipts/services/receiptService";
import { useOnlineStatus } from "@/lib/connectivity/online-status";

function ReceiptsContent() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [invoiceId, setInvoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedInvoiceId = invoiceId.trim();
    if (!normalizedInvoiceId || !isOnline) return;

    setLoading(true);
    setError(null);
    try {
      const receipt =
        await receiptService.ensureReceiptForInvoice(normalizedInvoiceId);
      router.push(`/receipts/${receipt.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The receipt could not be opened",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Receipts</h1>
        <p className="mt-2 text-gray-500">
          Open the server receipt associated with a real invoice.
        </p>
        <Link
          href="/billing"
          className="mt-3 inline-flex text-sm font-semibold text-green-700 hover:text-green-800"
        >
          Browse branch invoices
        </Link>
      </div>

      <form
        onSubmit={openReceipt}
        className="max-w-2xl rounded-2xl border bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-gray-700">
          Invoice ID
          <input
            type="text"
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            placeholder="Paste the invoice UUID"
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-gray-300 p-3 font-normal outline-none focus:border-green-600"
          />
        </label>

        <p className="mt-2 text-sm text-gray-500">
          If the paid-invoice flow has not created its receipt yet, this action
          creates one idempotently after verifying branch and tenant access.
        </p>

        {!isOnline && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Receipt lookup is unavailable offline.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!isOnline || loading || !invoiceId.trim()}
          className="mt-5 rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? "Opening..." : "Open receipt"}
        </button>
      </form>
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER"]}>
      <ReceiptsContent />
    </ProtectedRoute>
  );
}
