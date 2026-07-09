"use client";

import { useParams } from "next/navigation";
import InvoiceDetails from "@/features/invoice/components/InvoiceDetails";

export default function InvoiceDetailPage() {
  const params = useParams();

  const invoiceId = params.id as string;

  return (
    <div className="p-6">
      <InvoiceDetails invoiceId={invoiceId} />
    </div>
  );
}