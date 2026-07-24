"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import BillingWorkspace from "@/features/invoice/components/BillingWorkspace";

export default function InvoicesPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER"]}>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <BillingWorkspace detailBasePath="/invoices" />
      </div>
    </ProtectedRoute>
  );
}
