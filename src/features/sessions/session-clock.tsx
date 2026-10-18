"use client";

import type { ActiveSession } from "./types";
import { useSessionTiming } from "./session-timing";

function formatCharge(amount: number, currency: string | null) {
  if (!Number.isFinite(amount)) return "Unavailable";
  if (!currency) return amount.toFixed(2);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function SessionClock({ session }: { session: ActiveSession }) {
  const timing = useSessionTiming(session);

  return (
    <div>
      <p className="font-mono text-3xl font-bold text-slate-900">
        {timing.formattedDuration}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Running charge{" "}
        <span className="font-semibold text-brand-700">
          {formatCharge(timing.charge, session?.branch?.currency || "PKR")}
        </span>
      </p>
    </div>
  );
}
