"use client";

import { Invoice } from "../types/invoice";
import StatusBadge from "./StatusBadge";
import { formatCurrency } from "../utils/formatCurrency";

interface Props {
  invoices: Invoice[];
}

export default function TransactionTable({ invoices }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              Date
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              Invoice #
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              Branch
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              Payment Method
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              Amount
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              Invoice Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100 bg-white">
          {invoices.flatMap((invoice) =>
            invoice.payments.map((payment) => (
              <tr
                key={payment.id}
                className="transition hover:bg-slate-50"
              >
                <td className="px-6 py-4">
                  {new Date(payment.createdAt).toLocaleDateString()}
                </td>

                <td className="px-6 py-4 font-semibold text-slate-800">
                  #{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                </td>

                <td className="px-6 py-4">
                  {invoice.branchId}
                </td>

                <td className="px-6 py-4">
                  {payment.tenderType.toUpperCase()}
                </td>

                <td className="px-6 py-4 font-medium">
                  {formatCurrency(Number(payment.amount))}
                </td>

                <td className="px-6 py-4">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))
          )}

          {invoices.flatMap((i) => i.payments).length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="py-8 text-center text-gray-500"
              >
                No transaction history found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}