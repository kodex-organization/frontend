import type { InvoiceItem } from "../types/invoice";
import { formatCurrency } from "../utils/formatCurrency";

export default function InvoiceItems({
  items,
  currency,
}: {
  items: InvoiceItem[];
  currency?: string | null;
}) {
  const formatAmount = (value: number) =>
    formatCurrency(value, currency);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-slate-950">Invoice items</h2>
        <p className="mt-1 text-sm text-slate-500">
          Session time and other charge lines recorded on this invoice.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
          No line items were recorded.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit price</th>
                <th className="px-5 py-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {item.itemName ?? "Invoice item"}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-600">
                    {item.quantity.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-600">
                    {formatAmount(item.unitPrice)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {formatAmount(item.lineTotal)}
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
