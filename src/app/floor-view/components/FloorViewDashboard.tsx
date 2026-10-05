// src/modules/floor-view/components/FloorViewDashboard.tsx
"use client";

import { useFloorView } from "../hooks/useFloorView";
import type { Stats } from "../types";
import { FloorCard } from "./FloorCard";
import { NotificationBell } from "./NotificationBell";
import { OvertimeAlert } from "./OvertimeAlert";
import { StatsBar } from "./StatsBar";
import { FullPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/lib/auth/auth-context";
import { sessionApi } from "@/features/sessions/session-api";
import { StartSessionModal } from "@/features/sessions/start-session-modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/toast";
import { useState } from "react";

export function FloorViewDashboard() {
  const { user } = useAuth();
  const selectedBranchId = user?.branchId ?? "";
  const [startSessionModalOpen, setStartSessionModalOpen] = useState(false);
  const [selectedTableIdForStart, setSelectedTableIdForStart] = useState<string | undefined>(undefined);
  const [pendingEndSessionId, setPendingEndSessionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const {
    tables,
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    isOnline,
    lastUpdated,
    fetchData,
    markAsRead,
    markAllAsRead,
    dismissOvertimeAlert,
    updateSessionOptimistically,
    startSessionOptimistically,
  } = useFloorView(selectedBranchId || undefined);

  const stats: Stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    overtime: tables.filter((t) => t.session?.isOvertime).length,
    paused: tables.filter((t) => t.session?.isPaused).length,
  };

  const handlePause = async (sessionId: string) => {
    try {
      setActionLoading(true);
      const result = await sessionApi.action(sessionId, "pause");
      updateSessionOptimistically(sessionId, "paused");
      if (!isOnline || result.offlineQueued) toast.info("Saved offline. Action queued for sync.");
      else {
        toast.info("Session paused");
        await fetchData();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to pause session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (sessionId: string) => {
    try {
      setActionLoading(true);
      const result = await sessionApi.action(sessionId, "resume");
      updateSessionOptimistically(sessionId, "active");
      if (!isOnline || result.offlineQueued) toast.info("Saved offline. Action queued for sync.");
      else {
        toast.success("Session resumed");
        await fetchData();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to resume session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmEndSession = async () => {
    if (!pendingEndSessionId) return;
    const sessionIdToEnd = pendingEndSessionId;
    setPendingEndSessionId(null);
    try {
      setActionLoading(true);
      const result = await sessionApi.action(sessionIdToEnd, "end");
      updateSessionOptimistically(sessionIdToEnd, "ended");
      dismissOvertimeAlert(sessionIdToEnd);
      if (!isOnline || result.offlineQueued) toast.info("Saved offline. Action queued for sync.");
      else {
        toast.success("Session ended and invoice generated successfully");
        await fetchData();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to end session");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && tables.length === 0) {
    return <FullPageLoader text="Fetching floor plan..." />;
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
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                isOnline && !error
                  ? "bg-brand-50 border-brand-200 text-brand-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline && !error
                    ? "bg-brand-500"
                    : "bg-amber-500"
                }`}
              />
              {isOnline && !error ? "Live Sync" : "Connection issue"}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 tracking-wide">
            Real-time table allocation, active timers, and automatic overtime tracking
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setSelectedTableIdForStart(undefined);
              setStartSessionModalOpen(true);
            }}
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2 rounded-md shadow-sm transition-colors"
          >
            + Start Session
          </button>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
          />
        </div>
      </div>

      {error && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span>{error}</span>
          {isOnline && (
            <button
              type="button"
              onClick={() => void fetchData()}
              disabled={refreshing}
              className="font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isOnline && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Offline Mode active. Actions are saved locally and will synchronize when connection returns.
        </div>
      )}

      <div className="mb-6 shadow-sm rounded-xl overflow-hidden border border-rose-100 empty:hidden">
        <OvertimeAlert
          tables={tables}
          onDismiss={dismissOvertimeAlert}
          onEndSession={(sessionId) => setPendingEndSessionId(sessionId)}
        />
      </div>

      {/* Analytical Telemetry Data Ribbon */}
      <div className="mb-6">
        <StatsBar
          stats={stats}
          onRefresh={fetchData}
          lastUpdated={lastUpdated}
          refreshing={refreshing || actionLoading}
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
            No tables configured
          </h5>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            This branch does not have any floor tables configured yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {tables.map((table) => (
            <FloorCard
              key={table.tableId}
              table={table}
              onStartSession={(tableId) => {
                setSelectedTableIdForStart(tableId);
                setStartSessionModalOpen(true);
              }}
              onPauseSession={handlePause}
              onResumeSession={handleResume}
              onEndSession={(sessionId) => setPendingEndSessionId(sessionId)}
            />
          ))}
        </div>
      )}

      {/* Start Session Modal */}
      <StartSessionModal
        open={startSessionModalOpen}
        defaultTableId={selectedTableIdForStart}
        onClose={() => {
          setStartSessionModalOpen(false);
          setSelectedTableIdForStart(undefined);
        }}
        onStarted={async (session) => {
          if (session) {
            startSessionOptimistically(session);
          }
          if (isOnline) await fetchData();
        }}
      />

      {/* Confirm End Session Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingEndSessionId)}
        title="End Session & Generate Invoice"
        description="Are you sure you want to end this session? The table will be freed immediately and an invoice will be generated."
        confirmText="End Session"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmEndSession}
        onCancel={() => setPendingEndSessionId(null)}
      />
    </div>
  );
}

