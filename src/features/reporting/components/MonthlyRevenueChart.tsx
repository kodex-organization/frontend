"use client";

import { useMemo, useState } from "react";

type DailyPoint = { date: string; revenue: number };
type WeeklyPoint = { week: number; from: string; to: string; revenue: number };

interface MonthlyRevenueChartProps {
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  formatMoney: (value: number) => string;
}

export default function MonthlyRevenueChart({ daily, weekly, formatMoney }: MonthlyRevenueChartProps) {
  const [view, setView] = useState<"daily" | "weekly">("daily");

  // Normalise both views into one shape so a single renderer can draw them.
  const bars = useMemo(
    () =>
      view === "daily"
        ? daily.map((d) => ({
            key: d.date,
            label: String(Number(d.date.slice(8, 10))),
            tooltip: d.date,
            revenue: d.revenue,
          }))
        : weekly.map((w) => ({
            key: `week-${w.week}`,
            label: `W${w.week}`,
            tooltip: `${w.from} to ${w.to}`,
            revenue: w.revenue,
          })),
    [view, daily, weekly],
  );

  const maxRevenue = Math.max(...bars.map((b) => b.revenue), 0);
  const total = bars.reduce((sum, b) => sum + b.revenue, 0);
  const peak = bars.reduce((best, b) => (b.revenue > best.revenue ? b : best), bars[0] ?? { tooltip: "-", revenue: 0 });
  const average = bars.length > 0 ? total / bars.length : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Revenue This Month</h3>
          <p className="text-xs text-slate-500">
            {view === "daily" ? "Total revenue for each day" : "Total revenue for each week (days 1-7, 8-14, ...)"}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          {(["daily", "weekly"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                view === mode ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-wider text-slate-400">Total</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{formatMoney(total)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-wider text-slate-400">
            Average / {view === "daily" ? "day" : "week"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">{formatMoney(average)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-wider text-slate-400">
            Best {view === "daily" ? "day" : "week"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {maxRevenue > 0 ? `${formatMoney(peak.revenue)} (${peak.tooltip})` : "No revenue yet"}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex h-56 items-end gap-1 border-b border-l border-slate-200 px-1" style={{ minWidth: bars.length * 22 }}>
          {bars.map((bar) => {
            const heightPercent = maxRevenue > 0 ? Math.max((bar.revenue / maxRevenue) * 100, bar.revenue > 0 ? 2 : 0) : 0;
            return (
              <div key={bar.key} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${bar.tooltip}: ${formatMoney(bar.revenue)}`}>
                <div className="w-full rounded-t bg-brand-500 transition-all hover:bg-brand-600" style={{ height: `${heightPercent}%` }} />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1 px-1" style={{ minWidth: bars.length * 22 }}>
          {bars.map((bar) => (
            <span key={bar.key} className="min-w-0 flex-1 text-center text-[10px] font-medium text-slate-400">
              {bar.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
