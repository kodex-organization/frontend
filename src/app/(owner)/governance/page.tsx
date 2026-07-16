'use client';

import { useState, useEffect } from 'react';
import CancellationModal from '@/features/governance/CancellationModal';
import ManagerApprovalModal from '@/features/governance/ManagerApprovalModal';
import RateOverrideModal from '@/features/governance/RateOverrideModal';
import TakeoverModal from '@/features/governance/TakeoverModal';
import ShiftHandoverScreen from '@/features/governance/ShiftHandoverScreen';
import AuditLogViewer from '@/features/governance/AuditLogViewer';
import {
  listActiveSessions,
  listPausedSessions,
  listPendingCancellationRequests,
} from '@/features/governance/governance.api';

export default function GovernancePage() {
  const [showCancellation, setShowCancellation] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showRateOverride, setShowRateOverride] = useState(false);
  const [showTakeover, setShowTakeover] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // ── Real session data ────────────────────────────────────────────
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState('');

  // ── Takeover — current device's own ID, read automatically ───────
  const [newDeviceId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('cuecloud_device_id') ?? '';
  });

  // ── Pending cancellation requests (for Review picker) ─────────────
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [reviewRequestId, setReviewRequestId] = useState('');
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState('');

  // ── Manual input (no users-list endpoint exists yet for a dropdown) ─
  const [fromUserId, setFromUserId] = useState(
    '099b24f2-9281-4c73-b87c-2848c0d891e6' // Manager
  );
  const fromUserName = 'Demo Manager';

  const demoCurrentRate = 200;

  useEffect(() => {
    async function fetchSessions() {
      try {
        const [activeRes, pausedRes] = await Promise.all([
          listActiveSessions(),
          listPausedSessions(),
        ]);

        const activeList = (activeRes as any) ?? [];
        const pausedList = (pausedRes as any) ?? [];
        const combined = [...activeList, ...pausedList];

        setSessions(combined);
        if (combined.length > 0) {
          setSelectedSessionId((combined[0] as any).id);
        }
      } catch (err) {
        setSessionError('Failed to fetch sessions');
      } finally {
        setLoadingSessions(false);
      }
    }
    fetchSessions();
  }, []);

  useEffect(() => {
    async function fetchPendingRequests() {
      try {
        const data = await listPendingCancellationRequests() as any[];
        setPendingRequests(data);
        if (data.length > 0) {
          setReviewRequestId(data[0].id);
        }
      } catch (err) {
        setRequestsError('Failed to fetch pending requests');
      } finally {
        setLoadingRequests(false);
      }
    }
    fetchPendingRequests();
  }, []);

  return (
    <div className="p-6">

      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Session Governance
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage session policies, approvals, and handovers
      </p>

      {/* Session Picker */}
      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Session
        </label>
        {loadingSessions && (
          <p className="text-sm text-gray-400">Loading sessions...</p>
        )}
        {sessionError && (
          <p className="text-sm text-red-500">{sessionError}</p>
        )}
        {!loadingSessions && !sessionError && sessions.length === 0 && (
          <p className="text-sm text-gray-500">
            No active or paused sessions found. Start a session first.
          </p>
        )}
        {!loadingSessions && sessions.length > 0 && (
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
          >
            {sessions.map((s: any) => (
              <option key={s.id} value={s.id}>
                Table {s.table?.tableNumber ?? s.tableId ?? '?'} — {s.status} ({s.id.slice(0, 8)}...)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Pending Cancellation Requests Picker */}
      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pending Cancellation Requests
        </label>
        {loadingRequests && (
          <p className="text-sm text-gray-400">Loading requests...</p>
        )}
        {requestsError && (
          <p className="text-sm text-red-500">{requestsError}</p>
        )}
        {!loadingRequests && !requestsError && pendingRequests.length === 0 && (
          <p className="text-sm text-gray-500">
            No pending cancellation requests.
          </p>
        )}
        {!loadingRequests && pendingRequests.length > 0 && (
          <select
            value={reviewRequestId}
            onChange={(e) => setReviewRequestId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
          >
            {pendingRequests.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.requestedBy?.fullName ?? 'Unknown'} — {r.reason?.slice(0, 40) ?? 'No reason'} ({r.id.slice(0, 8)}...)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Manual input for Shift Handover (dropdown pending Dev 1's users endpoint) */}
      <div className="mb-8 max-w-md grid grid-cols-1 gap-4 border border-dashed border-gray-300 rounded-md p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          Manual entry — dropdown pending users list endpoint
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transfer From (Outgoing Cashier User ID)
          </label>
          <input
            type="text"
            placeholder="Paste outgoing cashier's user ID"
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          />
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Cancellation Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Request Cancellation
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Submit a session cancellation request for manager approval
          </p>
          <button
            onClick={() => setShowCancellation(true)}
            disabled={!selectedSessionId}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request Cancellation
          </button>
        </div>

        {/* Manager Approval */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Review Cancellation
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Approve or reject pending cancellation requests
          </p>
          <button
            onClick={() => setShowApproval(true)}
            disabled={!selectedSessionId || !reviewRequestId}
            className="px-4 py-2 text-sm text-white bg-yellow-500 rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Review Request
          </button>
        </div>

        {/* Rate Override */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Rate Override
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Override the hourly rate for an active session
          </p>
          <button
            onClick={() => setShowRateOverride(true)}
            disabled={!selectedSessionId}
            className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Override Rate
          </button>
        </div>

        {/* Manager Takeover */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Manager Takeover
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Take over a session from an offline device
          </p>
          <button
            onClick={() => setShowTakeover(true)}
            disabled={!selectedSessionId || !newDeviceId}
            className="px-4 py-2 text-sm text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Take Over Session
          </button>
          {!newDeviceId && (
            <p className="text-xs text-red-500 mt-2">
              No device ID found on this browser — try logging out and back in.
            </p>
          )}
        </div>

        {/* Shift Handover */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Shift Handover
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Transfer all open sessions to incoming cashier
          </p>
          <button
            onClick={() => setShowHandover(true)}
            disabled={!fromUserId}
            className="px-4 py-2 text-sm text-white bg-purple-500 rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Handover
          </button>
        </div>

        {/* Audit Log */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Audit Log
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            View all governance actions for a session
          </p>
          <button
            onClick={() => setShowAuditLog(true)}
            disabled={!selectedSessionId}
            className="px-4 py-2 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View Audit Log
          </button>
        </div>

      </div>

      {/* Modals */}
      {showCancellation && (
        <CancellationModal
          sessionId={selectedSessionId}
          onClose={() => setShowCancellation(false)}
          onSuccess={() => console.log('Cancellation requested!')}
        />
      )}

      {showApproval && (
        <ManagerApprovalModal
          requestId={reviewRequestId}
          sessionId={selectedSessionId}
          onClose={() => setShowApproval(false)}
          onSuccess={() => console.log('Request reviewed!')}
        />
      )}

      {showRateOverride && (
        <RateOverrideModal
          sessionId={selectedSessionId}
          currentRate={demoCurrentRate}
          onClose={() => setShowRateOverride(false)}
          onSuccess={() => console.log('Rate overridden!')}
        />
      )}

      {showTakeover && (
        <TakeoverModal
          sessionId={selectedSessionId}
          onClose={() => setShowTakeover(false)}
          onSuccess={() => console.log('Takeover done!')}
        />
      )}

      {showHandover && (
        <ShiftHandoverScreen
          fromUserId={fromUserId}
          fromUserName={fromUserName}
          onClose={() => setShowHandover(false)}
          onSuccess={() => console.log('Handover done!')}
        />
      )}

      {showAuditLog && (
        <AuditLogViewer
          sessionId={selectedSessionId}
          onClose={() => setShowAuditLog(false)}
        />
      )}

    </div>
  );
}
