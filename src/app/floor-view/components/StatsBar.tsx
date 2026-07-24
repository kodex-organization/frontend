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
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg shadow-sm">
        Total: <span className="font-bold">{stats.total}</span>
      </div>
      <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg shadow-sm">
        Available: <span className="font-bold">{stats.available}</span>
      </div>
      <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg shadow-sm">
        Occupied: <span className="font-bold">{stats.occupied}</span>
      </div>
      {stats.overtime > 0 && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg shadow-sm">
          Overtime: <span className="font-bold">{stats.overtime}</span>
        </div>
      )}
      {stats.paused > 0 && (
        <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg shadow-sm">
          ⏸ Paused: <span className="font-bold">{stats.paused}</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
