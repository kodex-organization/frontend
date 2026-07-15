"use client";

import { useParams } from "next/navigation";
import ReceiptDetails from "@/features/receipts/components/ReceiptDetails";

export default function ReceiptPage() {
  const params = useParams();

  return (
    <div className="p-6">
      <ReceiptDetails receiptId={params.id as string} />
    </div>
  );
}