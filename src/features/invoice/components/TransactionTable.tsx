import Link from "next/link";

import type { BillingTransaction } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";
import StatusBadge from "./StatusBadge";

function tenderLabel(value: BillingTransaction["tenderType"]) {
  return value
    ? value
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ")
    : "Unspecified";
}

export default function TransactionTable({
  transactions = [],
}: {
  transactions?: BillingTransaction[];
}) {
  // Safe guard: check if transactions is missing OR empty
  if (!transactions || transactions.length === 0) {
    return (
      <p className="border-t border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
        No payment transactions match this date range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border-t border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Invoice</th>
            <th className="px-5 py-3">Method</th>
            <th className="px-5 py-3">Reference</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3">Invoice status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(transaction.createdAt))}
              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/billing/${transaction.invoice.id}`}
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {transaction.invoice.invoiceNumber ??
                    transaction.invoice.id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-5 py-4 text-slate-700">
                {tenderLabel(transaction.tenderType)}
              </td>
              <td className="px-5 py-4 text-slate-500">
                {transaction.paymentReference ?? "—"}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                {formatCurrency(
                  transaction.amount,
                  transaction.invoice.branch.currency,
                )}
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={transaction.invoice.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}