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

  // Calculate stats
  const stats: Stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    overtime: tables.filter((t) => t.session?.isOvertime).length,
    paused: tables.filter((t) => t.session?.isPaused).length,
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading floor view...</p>
          <p className="text-xs text-gray-400 mt-1">Fetching live table data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            🏠 Floor View
            <span className="text-sm font-normal text-gray-400 ml-2">
              Live
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full ml-2 animate-pulse"></span>
            </span>
          </h1>
          <p className="text-sm text-gray-500">
            Real-time table status • Auto-refreshes every 30 seconds
          </p>
        </div>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
        />
      </div>

      {/* Overtime Alert Banner */}
      {showOvertimeAlert && (
        <OvertimeAlert
          tables={tables}
          onDismiss={() => setShowOvertimeAlert(false)}
        />
      )}

      {/* Stats Bar */}
      <StatsBar stats={stats} onRefresh={fetchData} lastUpdated={lastUpdated} />

      {/* Table Grid */}
      {tables.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">No tables available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((table) => (
            <FloorCard key={table.tableId} table={table} />
          ))}
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
