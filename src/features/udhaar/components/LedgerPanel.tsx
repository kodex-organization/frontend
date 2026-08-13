import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FilePenLine,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { LedgerEntry, UdhaarEntryType } from "../types";
import { formatAmount, formatDateTime } from "../utils/format";

interface LedgerPanelProps {
  customerName: string;
  outstandingBalance: number;
  entries: LedgerEntry[];
  loading: boolean;
  error: string;
}

const entryStyles: Record<
  UdhaarEntryType,
  {
    label: string;
    badge: string;
    icon: React.ReactNode;
    amountClass: string;
  }
> = {
  debit: {
    label: "Debit",
    badge: "bg-red-50 text-red-700",
    icon: <ArrowUpFromLine size={14} />,
    amountClass: "text-red-600",
  },
  credit: {
    label: "Credit",
    badge: "bg-emerald-50 text-emerald-700",
    icon: <ArrowDownToLine size={14} />,
    amountClass: "text-emerald-600",
  },
  adjustment: {
    label: "Adjustment",
    badge: "bg-amber-50 text-amber-700",
    icon: <FilePenLine size={14} />,
    amountClass: "text-amber-600",
  },
};

export function LedgerPanel({
  customerName,
  outstandingBalance,
  entries,
  loading,
  error,
}: LedgerPanelProps) {
  const hasBalance = outstandingBalance !== 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Outstanding balance
            </p>
            <p className="mt-1 truncate text-sm font-medium text-slate-500">
              {customerName}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p
              className={`text-2xl font-bold tabular-nums tracking-tight ${
                hasBalance ? "text-red-600" : "text-emerald-700"
              }`}
            >
              {formatAmount(outstandingBalance)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {hasBalance
                ? "Calculated from ledger entries"
                : "Fully settled"}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-900">
            Append-only ledger
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Entries can never be edited or deleted; corrections are made
            with adjustment entries.
          </p>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Loading ledger entries...
          </p>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-red-600">{error}</p>
        ) : entries.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ShieldCheck
              size={28}
              className="mx-auto text-emerald-600"
            />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No ledger entries yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Debits, settlements, and adjustments for this customer will
              appear here in chronological order.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const style = entryStyles[entry.entryType];

              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.badge}`}
                    >
                      {style.icon}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${style.badge}`}
                        >
                          {style.icon}
                          {style.label}
                        </span>
                        {entry.invoice && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            <ReceiptText size={12} />
                            {entry.invoice.paymentReference ??
                              entry.invoice.id.slice(0, 8)}
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm text-slate-600">
                        {entry.reason ?? "No reason provided"}
                      </p>

                      <p className="mt-1.5 text-xs text-slate-400">
                        {formatDateTime(entry.createdAt)} · by{" "}
                        {entry.createdBy?.fullName ?? "Unknown staff"} on{" "}
                        {entry.createdByDevice?.deviceName ??
                          "unknown device"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-6 pl-12 sm:block sm:pl-0 sm:text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${style.amountClass}`}
                    >
                      {entry.entryType === "credit" ? "-" : "+"}
                      {formatAmount(entry.amount)}
                    </p>
                    <p className="text-xs tabular-nums text-slate-400">
                      running{" "}
                      <span className="font-semibold text-slate-600">
                        {formatAmount(entry.runningBalance)}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
