"use client";

import { InvoiceItem } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";

export default function InvoiceItems({
  items,
}: {
  items: InvoiceItem[];
}) {
  return (
    <div className="border rounded-lg p-5 mb-6">
      <h3 className="font-semibold mb-3">
        Items
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td>{item.description}</td>

              <td>{item.quantity}</td>

              <td>
                {formatCurrency(item.unitPrice)}
              </td>

              <td>
                {formatCurrency(item.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}