"use client";

import React, { useState } from "react";
import type { AuditLogItem, AuditLogsFilterParams, AuditSeverity } from "../../types/audit";

interface AuditLogsTableProps {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  filters: AuditLogsFilterParams;
  onFilterChange: (filters: AuditLogsFilterParams) => void;
  onPageChange: (newPage: number) => void;
}

export function AuditLogsTable({
  logs,
  total,
  page,
  totalPages,
  isLoading,
  filters,
  onFilterChange,
  onPageChange,
}: AuditLogsTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
      case "warning":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
      case "info":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onFilterChange({
        ...filters,
        search: (e.target as HTMLInputElement).value || undefined,
        page: 1,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      {/* Table Filter Bar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"
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
            <input
              type="text"
              placeholder="Search action, entity, or IP (Press Enter)..."
              defaultValue={filters.search || ""}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={filters.severity || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                severity: (e.target.value as AuditSeverity) || undefined,
                page: 1,
              })
            }
            className="py-2 px-3 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Counter Info */}
        <div className="text-xs text-zinc-500 dark:text-zinc-400 self-center">
          Showing <span className="font-semibold text-zinc-900 dark:text-zinc-200">{logs.length}</span> of{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-200">{total}</span> events
        </div>
      </div>

      {/* Logs Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Branch / Device</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="py-4 px-4">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-8 h-8 text-zinc-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>No audit events match your filter criteria.</span>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3 px-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300 font-mono">
                    {new Date(log.occurredAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                    {log.actionType}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{log.entityType}</span>
                    {log.entityId && (
                      <span className="text-[10px] text-zinc-400 block font-mono">
                        {log.entityId.slice(0, 8)}...
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSeverityBadge(
                        log.severity
                      )}`}
                    >
                      {log.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                    {log.actorUser ? (
                      <div>
                        <div className="font-medium">{log.actorUser.fullName || "Unnamed User"}</div>
                        <div className="text-[10px] text-zinc-400">{log.actorUser.email}</div>
                      </div>
                    ) : (
                      <span className="text-zinc-400 italic">System / Unauthenticated</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                    <div>{log.branch?.name || "Global / Tenant"}</div>
                    {log.device?.deviceName && (
                      <span className="text-[10px] text-zinc-400 block">
                        Device: {log.device.deviceName}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{page}</span> of{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages || 1}</span>
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Audit Event Details
                </h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  Event ID: {selectedLog.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block font-semibold uppercase text-[10px]">
                    Action Type
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{selectedLog.actionType}</span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block font-semibold uppercase text-[10px]">
                    Occurred At
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {new Date(selectedLog.occurredAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block font-semibold uppercase text-[10px]">
                    Actor User
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedLog.actorUser?.fullName || selectedLog.actorUserId || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block font-semibold uppercase text-[10px]">
                    IP Address & User Agent
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedLog.ipAddress || "N/A"}
                  </span>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Context Metadata:
                  </span>
                  <pre className="p-3 bg-zinc-950 text-emerald-400 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.oldValues && (
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Previous State (Old Values):
                  </span>
                  <pre className="p-3 bg-zinc-950 text-amber-300 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">
                    {typeof selectedLog.oldValues === "string"
                      ? selectedLog.oldValues
                      : JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Mutated State (New Values):
                  </span>
                  <pre className="p-3 bg-zinc-950 text-blue-300 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">
                    {typeof selectedLog.newValues === "string"
                      ? selectedLog.newValues
                      : JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}