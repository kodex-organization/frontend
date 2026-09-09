import Link from "next/link";

import type { Invoice } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";
import StatusBadge from "./StatusBadge";

function currency(invoice: Invoice, value: number) {
  const safeValue = isNaN(value) ? 0 : value;
  return formatCurrency(safeValue, invoice?.branch?.currency ?? "PKR");
}

export default function InvoiceTable({
  invoices,
  detailBasePath = "/billing",
}: {
  invoices: Invoice[];
  detailBasePath?: string;
}) {
  if (!invoices || invoices.length === 0) {
    return (
      <div className="border-t border-slate-200 px-6 py-12 text-center">
        <h3 className="text-sm font-semibold text-slate-900">
          No invoices match these filters
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Completed sessions will appear here after the backend creates
          their invoice.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Invoice</th>
            <th className="px-5 py-3">Branch</th>
            <th className="px-5 py-3">Session / table</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3 text-right">Remaining</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Created</th>
            <th className="px-5 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {invoices.map((invoice) => {
            const total = Number(invoice.total ?? 0);

            // Calculate paid amount safely from invoice payments array
            const paidAmount = (invoice.payments ?? []).reduce(
              (sum, p) => sum + Number(p.amount ?? 0),
              0
            );

            // Determine remaining balance safely
            const remaining =
              typeof (invoice as any).remainingBalance === "number"
                ? (invoice as any).remainingBalance
                : typeof invoice.remainingAmount === "number" && !isNaN(invoice.remainingAmount)
                ? invoice.remainingAmount
                : Math.max(0, total - paidAmount);

            return (
              <tr key={invoice.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-4">
                  <p className="font-semibold text-slate-900">
                    {invoice.invoiceNumber ?? "Number pending"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {invoice.branch?.name ?? "Current branch"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {invoice.branch?.name ?? "Unknown branch"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  <p>
                    {invoice.session?.table?.tableNumber
                      ? `Table ${invoice.session.table.tableNumber}`
                      : "No table reference"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {invoice.sessionId
                      ? `Session ${invoice.sessionId.slice(0, 8)}`
                      : "Non-session invoice"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-slate-900">
                  {currency(invoice, total)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                  {currency(invoice, remaining)}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <StatusBadge status={invoice.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(invoice.createdAt))}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <Link
                    href={`${detailBasePath}/${invoice.id}`}
                    className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    View details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}