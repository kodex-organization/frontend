'use client';

import { useState, useEffect } from 'react';
import { getAuditLogs } from './governance.api';
import { AuditLog } from './governance.types';
import { ApiError } from '@/lib/api/client';

interface Props {
  sessionId: string;
  onClose: () => void;
}

export default function AuditLogViewer({ sessionId, onClose }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await getAuditLogs(sessionId) as AuditLog[];
        setLogs(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to fetch audit logs');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [sessionId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Audit Log
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Session ID: {sessionId}
        </p>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <p className="text-blue-500">Loading audit logs...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No audit logs found for this session</p>
          </div>
        )}

        {/* Logs List */}
        {!loading && !error && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border border-gray-200 rounded-md p-3"
              >
                <div className="flex justify-between items-start mb-1">
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
                    By: {log.actorUser.fullName} ({log.actorUser.email})
                  </p>
                )}
                {log.newValues && (
                  <p className="text-xs text-gray-500 mt-1">
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