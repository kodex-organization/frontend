"use client";

import { useState } from "react";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import DateFilter from "@/features/invoice/components/DateFilter";
import InvoiceTable from "@/features/invoice/components/InvoiceTable";
import TransactionTable from "@/features/invoice/components/TransactionTable";
import { useInvoices } from "@/features/invoice/hooks/useInvoices";

function InvoicesContent() {
  const [date, setDate] = useState("");
  const { invoices, loading, error, refresh } = useInvoices(date);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Invoices</h1>
        <p className="mt-2 text-gray-500">
          Invoice history and transaction records.
        </p>
      </div>

      <div className="rounded-xl bg-white shadow">
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-2xl font-semibold">Invoice List</h2>
          <DateFilter date={date} setDate={setDate} onFilter={refresh} />
        </div>

        {loading ? (
          <div className="p-6 text-gray-500">Loading invoices...</div>
        ) : error ? (
          <div className="space-y-3 p-6">
            <p className="text-red-500">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Retry
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-gray-500">No invoices found.</div>
        ) : (
          <InvoiceTable invoices={invoices} />
        )}
      </div>

      <div className="mt-10 rounded-xl bg-white shadow">
        <div className="border-b p-6">
          <h2 className="text-2xl font-semibold">Transaction History</h2>
        </div>

        {loading ? (
          <div className="p-6 text-gray-500">Loading transactions...</div>
        ) : error ? (
          <div className="p-6 text-red-500">{error}</div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-gray-500">No transactions found.</div>
        ) : (
          <TransactionTable invoices={invoices} />
        )}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER"]}>
      <InvoicesContent />
    </ProtectedRoute>
  );
}
