"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getAuditLogs } from "./governance.api";
import type { AuditLog } from "./governance.types";

interface Props {
  sessionId: string;
  onClose: () => void;
}

export default function AuditLogViewer({ sessionId, onClose }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchLogs() {
      setLoading(true);
      setError("");
      try {
        const data = await getAuditLogs(sessionId);
        if (active) setLogs(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Failed to fetch audit logs",
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
  }, [reloadKey, sessionId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="governance-audit-title"
    >
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="governance-audit-title"
            className="text-xl font-bold text-gray-800"
          >
            Governance Audit Log
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit log"
            className="text-xl font-bold text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <p className="mb-4 break-all text-sm text-gray-500">
          Session ID: {sessionId}
        </p>

        {loading && (
          <div className="py-8 text-center">
            <p className="text-blue-500">Loading audit logs...</p>
          </div>
        )}

        {!loading && error && (
          <div className="py-8 text-center">
            <p className="text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-3 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500">
              No governance actions are recorded for this session.
            </p>
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-md border border-gray-200 p-3"
              >
                <div className="mb-1 flex items-start justify-between gap-4">
                  <span className="text-sm font-semibold text-blue-600">
                    {log.actionType}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(log.occurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Entity: {log.entityType} — {log.entityId}
                </p>
                {log.actorUser && (
                  <p className="text-xs text-gray-500">
                    By:{" "}
                    {log.actorUser.fullName ??
                      log.actorUser.email ??
                      "Unknown staff"}
                  </p>
                )}
                {log.newValues && (
                  <p className="mt-1 break-words text-xs text-gray-500">
                    Changes: {log.newValues}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
