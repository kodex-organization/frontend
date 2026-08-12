"use client";

import { useEffect, useState } from "react";

import type { ActiveSession } from "./types";

function billableSeconds(session: ActiveSession, now: number) {
  const end = session.endedAt ? Date.parse(session.endedAt) : now;
  const paused = session.pauses.reduce((total, pause) => {
    const resumedAt = pause.resumedAt ? Date.parse(pause.resumedAt) : end;
    return total + Math.max(0, resumedAt - Date.parse(pause.pausedAt));
  }, 0);

  return Math.max(
    0,
    Math.floor((end - Date.parse(session.startedAt) - paused) / 1000),
  );
}

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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const seconds = billableSeconds(session, now);
  const duration = [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  const charge =
    (Number(session.appliedHourlyRate) * seconds) / 3600;

  return (
    <div>
      <p className="font-mono text-3xl font-bold text-slate-900">
        {duration}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Running charge{" "}
        <span className="font-semibold text-emerald-700">
          {formatCharge(charge, session?.branch?.currency || "PKR")}
        </span>
      </p>
    </div>
  );
}
