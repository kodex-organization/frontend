"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/security/ProtectedRoute";
import ReceiptDetails from "@/features/receipts/components/ReceiptDetails";

export default function ReceiptPage() {
  const params = useParams();

  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER"]}>
      <ReceiptDetails receiptId={params.id as string} />
    </ProtectedRoute>
  );
}
