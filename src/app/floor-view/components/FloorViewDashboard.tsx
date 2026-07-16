// src/modules/floor-view/components/FloorViewDashboard.tsx
"use client";

import { useState } from "react";
import { ToastContainer } from "react-toastify";

import { useFloorView } from "../hooks/useFloorView";
import { Stats } from "../types";
import { FloorCard } from "./FloorCard";
import { NotificationBell } from "./NotificationBell";
import { OvertimeAlert } from "./OvertimeAlert";
import { StatsBar } from "./StatsBar";

export function FloorViewDashboard() {
  const {
    tables,
    notifications,
    unreadCount,
    loading,
    lastUpdated,
    fetchData,
    markAsRead,
    markAllAsRead,
  } = useFloorView();

  const [showOvertimeAlert, setShowOvertimeAlert] = useState(true);

  const stats: Stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    overtime: tables.filter((t) => t.session?.isOvertime).length,
    paused: tables.filter((t) => t.session?.isPaused).length,
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-slate-50/50 rounded-2xl border border-slate-100 m-4">
        <div className="text-center p-8 max-w-sm">
          <div className="relative flex items-center justify-center h-12 w-12 mx-auto mb-4">
            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-25"></div>
            <div className="relative rounded-full h-8 w-8 border-2 border-t-blue-600 border-r-blue-600 border-b-slate-200 border-l-slate-200 animate-spin"></div>
          </div>
          <h4 className="text-sm font-semibold text-slate-800">
            Synchronizing Floor System
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Fetching runtime system states and spatial layouts...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* Enterprise Dashboard Header Control */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 pb-5 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Floor Plan Management
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Link
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 tracking-wide">
            Automated backend socket synchronization active (30s refresh
            interval)
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
          />
        </div>
      </div>

      {/* Critical Monitoring System */}
      {showOvertimeAlert && (
        <div className="mb-6 shadow-sm rounded-xl overflow-hidden border border-rose-100">
          <OvertimeAlert
            tables={tables}
            onDismiss={() => setShowOvertimeAlert(false)}
          />
        </div>
      )}

      {/* Analytical Telemetry Data Ribbon */}
      <div className="mb-6">
        <StatsBar
          stats={stats}
          onRefresh={fetchData}
          lastUpdated={lastUpdated}
        />
      </div>

      {/* Interactive Matrix Grid */}
      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 border-dashed max-w-lg mx-auto text-center px-4">
          <svg
            className="w-8 h-8 text-slate-300 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h5 className="font-semibold text-slate-800 text-sm">
            No Hardware Targets Listed
          </h5>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            There are no hardware table elements configured for this spatial
            segment zone yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {tables.map((table) => (
            <FloorCard key={table.tableId} table={table} />
          ))}
        </div>
      )}

      <ToastContainer toastClassName="shadow-lg rounded-xl border border-slate-100 text-xs" />
    </div>
  );
}
