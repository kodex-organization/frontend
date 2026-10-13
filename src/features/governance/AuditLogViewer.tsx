"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Clock,
  User,
  Building2,
  AlertTriangle,
  ArrowRightLeft,
  KeyRound,
  FileText,
  WifiOff,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { getAuditLogs } from "./governance.api";
import type { AuditLog } from "./governance.types";
import type { ActiveSession } from "@/features/sessions/types";
import {
  cacheScopedJson,
  readScopedJson,
  isNetworkFailure,
} from "@/lib/sync/offline-reference-cache";

interface Props {
  sessionId?: string;
  sessions?: ActiveSession[];
  onClose: () => void;
}

function formatActionBadge(actionType: string) {
  const upper = actionType.toUpperCase();
  if (upper.includes("CANCEL")) {
    return {
      bg: "bg-rose-50 border-rose-200 text-rose-700",
      icon: AlertTriangle,
      label: "Cancellation",
    };
  }
  if (upper.includes("OVERRIDE") || upper.includes("RATE")) {
    return {
      bg: "bg-blue-50 border-blue-200 text-blue-700",
      icon: KeyRound,
      label: "Rate Override",
    };
  }
  if (upper.includes("HANDOVER")) {
    return {
      bg: "bg-purple-50 border-purple-200 text-purple-700",
      icon: ArrowRightLeft,
      label: "Shift Handover",
    };
  }
  if (upper.includes("TAKEOVER")) {
    return {
      bg: "bg-amber-50 border-amber-200 text-amber-700",
      icon: ShieldCheck,
      label: "Manager Takeover",
    };
  }
  if (upper.includes("APPROVAL") || upper.includes("ACCESS") || upper.includes("APPROV")) {
    return {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
      icon: ShieldCheck,
      label: "Owner Approval",
    };
  }
  return {
    bg: "bg-slate-100 border-slate-200 text-slate-700",
    icon: FileText,
    label: actionType.replace(/_/g, " "),
  };
}

function parseValues(val?: string | null): Record<string, any> | string | null {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return val;
  } catch {
    return val;
  }
}

export default function AuditLogViewer({ sessionId: initialSessionId, sessions = [], onClose }: Props) {
  const [selectedScope, setSelectedScope] = useState<string>(initialSessionId || "all");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [isOfflineCached, setIsOfflineCached] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [actionCategory, setActionCategory] = useState("ALL");

  useEffect(() => {
    let active = true;

    async function fetchLogs() {
      setLoading(true);
      setError("");
      setIsOfflineCached(false);

      const cacheKey = `governance:audit:${selectedScope}`;

      try {
        const data = await getAuditLogs(selectedScope === "all" ? undefined : selectedScope);
        if (active) {
          const safeLogs = Array.isArray(data) ? data : [];
          setLogs(safeLogs);
          void cacheScopedJson<AuditLog[]>(cacheKey, safeLogs);
        }
      } catch (err) {
        if (active) {
          if (isNetworkFailure(err)) {
            // Attempt reading from offline cache
            const cached = await readScopedJson<AuditLog[]>(cacheKey);
            if (cached && Array.isArray(cached.data)) {
              setLogs(cached.data);
              setIsOfflineCached(true);
              setLoading(false);
              return;
            }
          }
          setError(
            err instanceof ApiError ? err.message : "Failed to fetch governance audit logs",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchLogs();
    return () => {
      active = false;
    };
  }, [reloadKey, selectedScope]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      // Category filter
      if (actionCategory !== "ALL") {
        const upper = log.actionType.toUpperCase();
        if (actionCategory === "CANCELLATION" && !upper.includes("CANCEL")) return false;
        if (actionCategory === "OVERRIDE" && !upper.includes("OVERRIDE") && !upper.includes("RATE")) return false;
        if (actionCategory === "HANDOVER" && !upper.includes("HANDOVER")) return false;
        if (actionCategory === "TAKEOVER" && !upper.includes("TAKEOVER")) return false;
        if (actionCategory === "APPROVAL" && !upper.includes("APPROVAL") && !upper.includes("ACCESS") && !upper.includes("APPROV")) return false;
      }

      // Search term
      if (!term) return true;
      const actorName = log.actorUser?.fullName?.toLowerCase() ?? "";
      const actorEmail = log.actorUser?.email?.toLowerCase() ?? "";
      const action = log.actionType.toLowerCase();
      const entity = (log.entityId ?? "").toLowerCase();
      const details = typeof log.newValues === "string" ? log.newValues.toLowerCase() : "";

      return (
        actorName.includes(term) ||
        actorEmail.includes(term) ||
        action.includes(term) ||
        entity.includes(term) ||
        details.includes(term)
      );
    });
  }, [logs, search, actionCategory]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="governance-audit-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              <h2
                id="governance-audit-title"
                className="text-base font-bold text-slate-900"
              >
                Governance Log History
              </h2>
              {isOfflineCached && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  <WifiOff className="h-3 w-3" /> Offline cache
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Audit trail of session cancellations, rate overrides, handovers, takeovers, and authorizations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit log"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="border-b border-slate-150 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Scope dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Log Scope
              </label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-brand-500 focus:outline-none"
              >
                <option value="all">All Governance Actions (Branch History)</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Table {s.table?.tableNumber ?? "?"} ({s.status}) — Session {s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            {/* Action category filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Action Type
              </label>
              <select
                value={actionCategory}
                onChange={(e) => setActionCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-brand-500 focus:outline-none"
              >
                <option value="ALL">All Action Types</option>
                <option value="CANCELLATION">Cancellations & Voids</option>
                <option value="OVERRIDE">Rate Overrides</option>
                <option value="HANDOVER">Shift Handovers</option>
                <option value="TAKEOVER">Manager Takeovers</option>
                <option value="APPROVAL">Owner Approvals</option>
              </select>
            </div>
          </div>

          {/* Search bar & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by staff name, action, or note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              title="Refresh log history"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-brand-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="py-12 text-center space-y-2">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" />
              <p className="text-xs font-medium text-slate-500">Loading log history...</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-12 text-center space-y-3">
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
              <p className="text-xs font-medium text-rose-600">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredLogs.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No governance records found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {logs.length === 0
                  ? "No governance actions (cancellations, overrides, handovers, or takeovers) have been performed yet."
                  : "No logs matched your search or category filter. Try clearing filters."}
              </p>
            </div>
          )}

          {!loading && !error && filteredLogs.length > 0 && (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const badge = formatActionBadge(log.actionType);
                const BadgeIcon = badge.icon;
                const parsedNew = parseValues(log.newValues);

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bg}`}
                        >
                          <BadgeIcon className="h-3 w-3" />
                          {log.actionType.replace(/_/g, " ")}
                        </span>
                        {log.branch?.name && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {log.branch.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.occurredAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          Staff:{" "}
                          <strong className="text-slate-800">
                            {log.actorUser?.fullName ?? log.actorUser?.email ?? "System"}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Entity: <strong className="text-slate-800">{log.entityType}</strong> ({log.entityId ? log.entityId.slice(0, 8) : "N/A"})
                        </span>
                      </div>
                    </div>

                    {parsedNew && (
                      <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-xs border border-slate-150">
                        {typeof parsedNew === "object" ? (
                          <div className="space-y-0.5 font-mono text-[11px] text-slate-700">
                            {Object.entries(parsedNew).map(([key, val]) => (
                              <div key={key} className="flex gap-1.5">
                                <span className="font-semibold text-slate-500">{key}:</span>
                                <span className="text-slate-800">
                                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-700 italic">&ldquo;{parsedNew}&rdquo;</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50/60 text-xs text-slate-500">
          <span>Showing {filteredLogs.length} of {logs.length} logged actions</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
