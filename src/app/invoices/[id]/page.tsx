"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/security/ProtectedRoute";
import InvoiceDetails from "@/features/invoice/components/InvoiceDetails";

export default function InvoicePage() {
  const params = useParams<{ id: string }>();

  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER"]}>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <InvoiceDetails
          invoiceId={params.id}
          backHref="/invoices"
        />
      </div>
    </ProtectedRoute>
  );
}
