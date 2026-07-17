"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";

function ReceiptsContent() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Receipts</h1>
        <p className="mt-2 text-gray-500">
          View and reprint receipts by invoice.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 text-gray-500 shadow">
        Use an invoice's detail page to view or print its receipt.
      </div>
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