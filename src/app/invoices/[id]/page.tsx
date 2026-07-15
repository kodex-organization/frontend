"use client";

import { useParams } from "next/navigation";
import InvoiceDetails from "@/features/invoice/components/InvoiceDetails";

export default function InvoicePage() {
  const params = useParams();

  return (
    <div className="p-6">
      <InvoiceDetails invoiceId={params.id as string} />
    </div>
  );
}