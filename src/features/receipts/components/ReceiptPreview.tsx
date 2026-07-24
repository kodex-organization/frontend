"use client";

import type { MoneyValue, Receipt } from "../types/receipt";

interface Props {
  receipt: Receipt;
}

function formatMoney(value: MoneyValue, currency: string | null) {
  if (value === null) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${currency ? `${currency} ` : ""}${amount.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function actionLabel(action: string | null) {
  return action
    ? action.replace(/^RECEIPT_/, "").replaceAll("_", " ").toLowerCase()
    : "receipt event";
}

export default function ReceiptPreview({ receipt }: Props) {
  const { invoice } = receipt;
  const currency = invoice.branch.currency;
  const tableNumber = invoice.session?.table?.tableNumber;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-green-700">
              {invoice.branch.name || "Branch name unavailable"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900">
              Invoice {invoice.invoiceNumber || "number unavailable"}
            </h2>
            {invoice.branch.address && (
              <p className="mt-1 text-sm text-gray-500">
                {invoice.branch.address}
              </p>
            )}
          </div>
          <div className="text-sm text-gray-600 sm:text-right">
            <p>Receipt ID: {receipt.id}</p>
            <p>Invoice date: {formatDate(invoice.createdAt)}</p>
            {tableNumber !== null && tableNumber !== undefined && (
              <p>Table: {tableNumber}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-gray-500">Invoice status</p>
            <p className="font-semibold text-gray-900">
              {invoice.status ?? "unspecified"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Output count</p>
            <p className="font-semibold text-gray-900">{receipt.printCount}</p>
          </div>
          <div>
            <p className="text-gray-500">Last output</p>
            <p className="font-semibold text-gray-900">
              {formatDate(receipt.printedAt)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Last result</p>
            <p className="font-semibold text-gray-900">
              {receipt.lastPrintStatus
                ? `${receipt.lastPrintStatus} (${receipt.lastPrintMode ?? "unknown mode"})`
                : "Not output yet"}
            </p>
          </div>
        </div>

        {receipt.electronicCopyPath && (
          <p className="mt-3 text-xs text-gray-500">
            Latest server artifact: {receipt.electronicCopyPath}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="font-semibold text-gray-900">Invoice items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-6 py-3">Item</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3 text-right">Unit price</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-6 py-3">
                    {item.itemName || "Unnamed invoice item"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {item.quantity ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {formatMoney(item.unitPrice, currency)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium">
                    {formatMoney(item.lineTotal, currency)}
                  </td>
                </tr>
              ))}
              {invoice.items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-6 text-center text-gray-500"
                  >
                    No invoice items are recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Totals</h3>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Subtotal", invoice.subtotal],
              ["Discount", invoice.discountAmount],
              ["Tax", invoice.taxAmount],
              ["Service charge", invoice.serviceCharge],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4">
                <dt className="text-gray-500">{label}</dt>
                <dd>{formatMoney(value as MoneyValue, currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(invoice.total, currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Payments</h3>
          <div className="mt-4 space-y-3 text-sm">
            {invoice.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">
                    {payment.tenderType ?? "Unspecified method"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>
                <p className="font-medium">
                  {formatMoney(payment.amount, currency)}
                </p>
              </div>
            ))}
            {invoice.payments.length === 0 && (
              <p className="text-gray-500">No payments are recorded.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900">Print audit history</h3>
        <div className="mt-4 space-y-3">
          {receipt.printHistory.map((entry) => (
            <div key={entry.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-col justify-between gap-1 sm:flex-row">
                <p className="font-semibold capitalize">
                  {actionLabel(entry.actionType)}
                </p>
                <p className="text-gray-500">{formatDate(entry.occurredAt)}</p>
              </div>
              <p className="mt-1 text-gray-600">
                User:{" "}
                {entry.actor?.fullName ||
                  entry.actor?.email ||
                  entry.actor?.id ||
                  "Unavailable"}
              </p>
              {entry.details?.printCount !== undefined && (
                <p className="text-gray-600">
                  Copy number: {entry.details.printCount}
                </p>
              )}
              {entry.details?.reprintReason && (
                <p className="mt-1 text-gray-700">
                  Reason: {entry.details.reprintReason}
                </p>
              )}
              {entry.details?.failureMessage && (
                <p className="mt-1 text-red-700">
                  Failure: {entry.details.failureMessage}
                </p>
              )}
            </div>
          ))}
          {receipt.printHistory.length === 0 && (
            <p className="text-sm text-gray-500">
              No print attempts have been audited yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
