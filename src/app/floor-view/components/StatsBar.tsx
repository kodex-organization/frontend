// src/modules/floor-view/components/StatsBar.tsx
"use client";

import type { Stats } from "../types";

interface StatsBarProps {
  stats: Stats;
  onRefresh: () => void | Promise<void>;
  lastUpdated: Date | null;
  refreshing?: boolean;
}

export function StatsBar({
  stats,
  onRefresh,
  lastUpdated,
  refreshing = false,
}: StatsBarProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between sm:items-end mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-slate-200/60 px-3 py-2 rounded-lg shadow-sm transition-all hover:shadow-md">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
          <span className="text-sm font-black text-slate-800">{stats.total}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200/60 px-3 py-2 rounded-lg shadow-sm transition-all hover:shadow-md">
          <span className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Available</span>
          <span className="text-sm font-black text-slate-800">{stats.available}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200/60 px-3 py-2 rounded-lg shadow-sm transition-all hover:shadow-md">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Occupied</span>
          <span className="text-sm font-black text-slate-800">{stats.occupied}</span>
        </div>
        {stats.overtime > 0 && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/60 px-3 py-2 rounded-lg shadow-sm transition-all hover:shadow-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Overtime</span>
            <span className="text-sm font-black text-rose-800">{stats.overtime}</span>
          </div>
        )}
        {stats.paused > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 px-3 py-2 rounded-lg shadow-sm transition-all hover:shadow-md">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Paused</span>
            <span className="text-sm font-black text-amber-800">{stats.paused}</span>
          </div>
        )}
      </div>
      <div className="flex flex-row items-center gap-3">
        {lastUpdated && (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg transition-all hover:bg-brand-700 hover:shadow-md hover:shadow-brand-500/20 text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh Floor"}
        </button>
      </div>
    </div>
  );
}
