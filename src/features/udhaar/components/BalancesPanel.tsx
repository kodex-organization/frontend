import { CheckCircle2, CircleAlert, UserRound } from "lucide-react";
import type { CustomerBalance } from "../types";
import { formatAmount } from "../utils/format";

interface BalancesPanelProps {
  balances: CustomerBalance[];
  selectedCustomerId: string | null;
  onSelect: (customerId: string) => void;
  loading: boolean;
  error: string;
}

export function BalancesPanel({
  balances,
  selectedCustomerId,
  onSelect,
  loading,
  error,
}: BalancesPanelProps) {
  if (loading) {
    return (
      <p className="px-5 py-8 text-sm text-slate-500">
        Loading balances...
      </p>
    );
  }

  if (error) {
    return (
      <p className="px-5 py-8 text-sm text-red-600">{error}</p>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-slate-500">
          No customers yet. Create customers to start tracking credit.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {balances.map((balance) => {
        const hasBalance = balance.outstandingBalance !== 0;
        const selected = selectedCustomerId === balance.customer.id;

        return (
          <li key={balance.customer.id}>
            <button
              type="button"
              onClick={() => onSelect(balance.customer.id)}
              className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition ${
                selected
                  ? "bg-emerald-50/60"
                  : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  selected
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <UserRound size={17} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {balance.customer.fullName ?? "Unnamed customer"}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {balance.customer.phone ?? "No phone on file"}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`text-sm font-bold tabular-nums ${
                    hasBalance ? "text-red-600" : "text-slate-700"
                  }`}
                >
                  {formatAmount(balance.outstandingBalance)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    hasBalance
                      ? "text-red-500"
                      : "text-emerald-600"
                  }`}
                >
                  {hasBalance ? (
                    <CircleAlert size={12} />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  {hasBalance ? "Owes" : "Cleared"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
