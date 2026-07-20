"use client";

import { Receipt } from "../types/receipt";

interface Props {
  receipt: Receipt;
}

export default function ReceiptPreview({ receipt }: Props) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-xl font-semibold text-gray-800">
        Receipt Preview
      </h2>

      <div className="space-y-3">
        <p>
          <span className="text-gray-500">Receipt ID:</span>{" "}
          <strong>{receipt.id}</strong>
        </p>
        <p>
          <span className="text-gray-500">Invoice ID:</span>{" "}
          <strong>{receipt.invoiceId}</strong>
        </p>
        <p>
          <span className="text-gray-500">Printed At:</span>{" "}
          <strong>
            {receipt.printedAt
              ? new Date(receipt.printedAt).toLocaleString()
              : "Not printed yet"}
          </strong>
        </p>
      </div>
    </div>
  );
}