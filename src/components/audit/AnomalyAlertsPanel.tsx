"use client";

import React, { useState } from "react";
import type { AnomalyAlertItem, AuditSeverity } from "../../types/audit";
import { resolveAnomaly, triggerAnomalyScan } from "../../lib/api/audit";

interface AnomalyAlertsPanelProps {
  alerts: AnomalyAlertItem[];
  isLoading: boolean;
  onRefresh: () => void;
  branchId?: string;
}

export function AnomalyAlertsPanel({
  alerts,
  isLoading,
  onRefresh,
  branchId,
}: AnomalyAlertsPanelProps) {
  const [filterResolved, setFilterResolved] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Resolution Modal State
  const [activeAlert, setActiveAlert] = useState<AnomalyAlertItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredAlerts = alerts.filter((a) => a.isResolved === filterResolved);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      setScanMessage(null);
      const res = await triggerAnomalyScan(branchId);
      setScanMessage(`Scan finished: ${res.detectedCount} new pattern anomalies detected.`);
      onRefresh();
    } catch (err: any) {
      setScanMessage(err.message || "Failed to execute anomaly scan.");
    } finally {
      setScanning(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlert) return;
    if (!resolutionNotes.trim()) {
      setErrorMessage("Resolution justification/notes are required.");
      return;
    }

    try {
      setResolving(true);
      setErrorMessage(null);
      await resolveAnomaly(activeAlert.id, resolutionNotes.trim());
      setActiveAlert(null);
      setResolutionNotes("");
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resolve anomaly.");
    } finally {
      setResolving(false);
    }
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800";
      case "warning":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800";
      case "info":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800";
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Header Actions & Scan Trigger */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Anomaly & Compliance Alert Center
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
              {alerts.filter((a) => !a.isResolved).length} Unresolved
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Automated monitoring for unauthorized voids, abnormal discounts, and clock tampering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter unresolved vs resolved */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilterResolved(false)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                !filterResolved
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              Active Alerts
            </button>
            <button
              onClick={() => setFilterResolved(true)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterResolved
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              Resolved History
            </button>
          </div>

          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {scanning ? "Scanning..." : "Trigger Scan"}
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800/80 text-xs font-medium text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span>{scanMessage}</span>
          <button
            onClick={() => setScanMessage(null)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Alerts Listing */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <div className="animate-spin w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full mx-auto mb-2" />
            Loading anomaly events...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <svg
              className="w-10 h-10 text-brand-500 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">
              No {filterResolved ? "resolved history" : "active anomalies"} found
            </p>
            <p className="text-zinc-400 mt-0.5">
              {filterResolved
                ? "Resolved incidents will show up here."
                : "Your system has no pending security or operational anomalies."}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadge(
                      alert.severity
                    )}`}
                  >
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    {alert.anomalyType}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(alert.detectedAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {alert.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {alert.branch?.name && (
                    <span>
                      <strong className="font-medium text-zinc-600 dark:text-zinc-300">Branch:</strong>{" "}
                      {alert.branch.name}
                    </span>
                  )}
                  {alert.user && (
                    <span>
                      <strong className="font-medium text-zinc-600 dark:text-zinc-300">User:</strong>{" "}
                      {alert.user.fullName || alert.user.email}
                    </span>
                  )}
                  {alert.isResolved && alert.resolvedBy && (
                    <span className="text-brand-600 dark:text-brand-400">
                      <strong>Resolved by:</strong> {alert.resolvedBy.fullName || "Admin"}
                    </span>
                  )}
                </div>

                {alert.resolutionNotes && (
                  <div className="mt-2 text-xs bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900 p-2 rounded-lg text-brand-800 dark:text-brand-300">
                    <strong>Resolution Note:</strong> {alert.resolutionNotes}
                  </div>
                )}
              </div>

              {!alert.isResolved && (
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => {
                      setActiveAlert(alert);
                      setResolutionNotes("");
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 transition-colors shadow-2xs"
                  >
                    Resolve Incident
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Incident Resolution Modal */}
      {activeAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Resolve Anomaly Alert
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Enter an audit justification note explaining the resolution or dismissal of this alert.
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-xs mb-4 text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-0.5">
                {activeAlert.anomalyType}
              </span>
              {activeAlert.description}
            </div>

            {errorMessage && (
              <div className="p-2.5 mb-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Resolution Notes / Action Taken *
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Verified with shift manager, discount was authorized for VIP group."
                  className="w-full p-2.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveAlert(null)}
                  disabled={resolving}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {resolving ? "Saving..." : "Confirm Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}