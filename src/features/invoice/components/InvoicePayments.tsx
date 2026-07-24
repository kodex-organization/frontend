import type { InvoicePayment } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";

function labelTender(value: InvoicePayment["tenderType"]) {
  return value
    ? value
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ")
    : "Unspecified";
}

export default function InvoicePayments({
  payments,
  currency,
}: {
  payments: InvoicePayment[];
  currency?: string | null;
}) {
  const formatAmount = (value: number) =>
    formatCurrency(value, currency);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-slate-950">Payments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Real payment transactions recorded against this invoice.
        </p>
      </div>

      {payments.length === 0 ? (
        <p className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
          No payments have been recorded.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Tender</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(payment.createdAt))}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {labelTender(payment.tenderType)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {payment.paymentReference ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                    {formatAmount(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
