"use client";

import { Invoice } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";
import StatusBadge from "./StatusBadge";

interface Props {
  invoice: Invoice;
}

export default function InvoiceCard({ invoice }: Props) {
  return (
    <div className="border rounded-lg p-5 mb-6 bg-white">

      <div className="flex justify-between items-start">

        <div>

          <h2 className="text-xl font-bold">
            Invoice #{invoice.invoiceNumber}
          </h2>


          <p className="text-gray-500 text-sm">
            Branch: {invoice.branchId}
          </p>


          <p className="text-gray-500 text-sm">
            Session: {invoice.sessionId}
          </p>


        </div>


        <StatusBadge status={invoice.status} />

      </div>





      <div className="
        grid
        grid-cols-2
        gap-4
        mt-4
        text-sm
      ">


        <p>
          <strong>Subtotal:</strong>{" "}
          {formatCurrency(invoice.subtotal)}
        </p>



        <p>
          <strong>Discount:</strong>{" "}
          {formatCurrency(invoice.discountAmount)}
        </p>



        <p>
          <strong>Tax:</strong>{" "}
          {formatCurrency(invoice.taxAmount)}
        </p>



        <p>
          <strong>Service Charge:</strong>{" "}
          {formatCurrency(invoice.serviceCharge)}
        </p>



        <p>
          <strong>Total:</strong>{" "}
          {formatCurrency(invoice.totalAmount)}
        </p>



        <p>
          <strong>Date:</strong>{" "}
          {new Date(invoice.createdAt).toLocaleString()}
        </p>



      </div>


    </div>
  );
}