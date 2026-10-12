"use client";

import { useEffect, useState } from "react";

import type { ActiveSession } from "./types";

function billableSeconds(session: ActiveSession, now: number) {
  const end = session.endedAt ? Date.parse(session.endedAt) : now;
  const storedPauses = session.pauses || [];
  const paused = storedPauses.reduce((total, pause) => {
    if (!pause.resumedAt) return total;
    const pausedAt = Date.parse(pause.pausedAt);
    const resumedAt = Date.parse(pause.resumedAt);
    return Number.isFinite(pausedAt) && Number.isFinite(resumedAt)
      ? total + Math.max(0, resumedAt - pausedAt)
      : total;
  }, 0);
  const openPause = [...storedPauses].reverse().find((pause) => !pause.resumedAt);
  const activePauseAt = session.status === "paused"
    ? Date.parse(session.pausedAt || openPause?.pausedAt || "")
    : null;
  const activePauseDuration = activePauseAt !== null && Number.isFinite(activePauseAt)
    ? Math.max(0, end - activePauseAt)
    : 0;

  return Math.max(
    0,
    Math.floor((end - Date.parse(session.startedAt) - paused - activePauseDuration) / 1000),
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
        <span className="font-semibold text-brand-700">
          {formatCharge(charge, session?.branch?.currency || "PKR")}
        </span>
      </p>
    </div>
  );
}
