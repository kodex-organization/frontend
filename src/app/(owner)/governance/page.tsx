"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/security/ProtectedRoute";
import AuditLogViewer from "@/features/governance/AuditLogViewer";
import CancellationModal from "@/features/governance/CancellationModal";
import {
  listEligibleStaff,
  listPendingCancellationRequests,
} from "@/features/governance/governance.api";
import type {
  CancellationRequest,
  GovernanceStaff,
} from "@/features/governance/governance.types";
import ManagerApprovalModal from "@/features/governance/ManagerApprovalModal";
import RateOverrideModal from "@/features/governance/RateOverrideModal";
import ShiftHandoverScreen from "@/features/governance/ShiftHandoverScreen";
import TakeoverModal from "@/features/governance/TakeoverModal";
import { sessionApi } from "@/features/sessions/session-api";
import type { ActiveSession } from "@/features/sessions/types";
import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";

function formatRate(value: number | string) {
  const rate = Number(value);
  return Number.isFinite(rate)
    ? `${rate.toFixed(2)}/hr`
    : "Rate unavailable";
}

function GovernanceContent() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const canManage = Boolean(
    user?.roles.some((role) => role === "OWNER" || role === "MANAGER"),
  );
  const [showCancellation, setShowCancellation] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showRateOverride, setShowRateOverride] = useState(false);
  const [showTakeover, setShowTakeover] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const [pendingRequests, setPendingRequests] = useState<
    CancellationRequest[]
  >([]);
  const [reviewRequestId, setReviewRequestId] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState("");

  const [staff, setStaff] = useState<GovernanceStaff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionError("");
    try {
      const [active, paused] = await Promise.all([
        sessionApi.active(),
        sessionApi.paused(),
      ]);
      const combined = [...active, ...paused];
      setSessions(combined);
      setSelectedSessionId((current) =>
        combined.some((session) => session.id === current)
          ? current
          : (combined[0]?.id ?? ""),
      );
    } catch {
      setSessionError("Failed to fetch branch sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadPendingRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestsError("");
    try {
      const requests = await listPendingCancellationRequests();
      setPendingRequests(requests);
      setReviewRequestId((current) =>
        requests.some((request) => request.id === current)
          ? current
          : (requests[0]?.id ?? ""),
      );
    } catch {
      setRequestsError("Failed to fetch pending cancellation requests");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    setStaffError("");
    try {
      setStaff(await listEligibleStaff());
    } catch {
      setStaffError("Failed to fetch eligible branch staff");
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setLoadingSessions(false);
      setLoadingRequests(false);
      setLoadingStaff(false);
      return;
    }

    if (!canManage) {
      setPendingRequests([]);
      setStaff([]);
      setLoadingRequests(false);
      setLoadingStaff(false);
      void loadSessions();
      return;
    }

    void Promise.all([loadSessions(), loadPendingRequests(), loadStaff()]);
  }, [
    canManage,
    isOnline,
    loadPendingRequests,
    loadSessions,
    loadStaff,
  ]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );
  const selectedRequest = useMemo(
    () =>
      pendingRequests.find((request) => request.id === reviewRequestId) ?? null,
    [pendingRequests, reviewRequestId],
  );
  const currentRate = Number(selectedSession?.appliedHourlyRate);
  const hasValidRate = Number.isFinite(currentRate) && currentRate > 0;
  const canHandover =
    staff.length > 1 && staff.some((member) => member.openSessionCount > 0);

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-800">
        Session Governance
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        {canManage
          ? "Manage branch-scoped session policies, approvals, and handovers."
          : "Submit a branch session cancellation request for manager review."}
      </p>
      {notice && (
        <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      {!isOnline && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Governance changes are unavailable while this device is offline.
          Reconnect before reviewing, overriding, handing over, or taking over
          a session.
        </div>
      )}

      <div className="mb-6 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Open session
          </label>
          {loadingSessions && (
            <p className="text-sm text-gray-400">Loading sessions...</p>
          )}
          {sessionError && (
            <p className="text-sm text-red-500">{sessionError}</p>
          )}
          {!loadingSessions && !sessionError && sessions.length === 0 && (
            <p className="text-sm text-gray-500">
              No active or paused sessions found.
            </p>
          )}
          {!loadingSessions && sessions.length > 0 && (
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  Table {session.table?.tableNumber ?? "?"} — {session.status} —
                  {formatRate(session.appliedHourlyRate)}
                </option>
              ))}
            </select>
          )}
        </div>

        {canManage && <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Pending cancellation request
          </label>
          {loadingRequests && (
            <p className="text-sm text-gray-400">Loading requests...</p>
          )}
          {requestsError && (
            <p className="text-sm text-red-500">{requestsError}</p>
          )}
          {!loadingRequests &&
            !requestsError &&
            pendingRequests.length === 0 && (
              <p className="text-sm text-gray-500">
                No pending cancellation requests.
              </p>
            )}
          {!loadingRequests && pendingRequests.length > 0 && (
            <select
              value={reviewRequestId}
              onChange={(event) => setReviewRequestId(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {pendingRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  Table {request.session.table?.tableNumber ?? "?"} —{" "}
                  {request.requestedBy?.fullName ??
                    request.requestedBy?.email ??
                    "Unknown staff"}{" "}
                  — {request.reason ?? "No reason"}
                </option>
              ))}
            </select>
          )}
        </div>}
      </div>

      {canManage && <div className="mb-8 max-w-4xl rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700">
          Eligible branch staff
        </p>
        {loadingStaff && (
          <p className="mt-1 text-sm text-gray-400">Loading staff...</p>
        )}
        {staffError && (
          <p className="mt-1 text-sm text-red-500">{staffError}</p>
        )}
        {!loadingStaff && !staffError && (
          <p className="mt-1 text-sm text-gray-500">
            {staff.length} active staff member{staff.length === 1 ? "" : "s"};{" "}
            {staff.reduce(
              (count, member) => count + member.openSessionCount,
              0,
            )}{" "}
            open session
            {staff.reduce(
              (count, member) => count + member.openSessionCount,
              0,
            ) === 1
              ? ""
              : "s"}{" "}
            available for handover.
          </p>
        )}
      </div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          title="Request Cancellation"
          description="Submit the selected session for manager approval."
          label="Request Cancellation"
          color="bg-red-500 hover:bg-red-600"
          disabled={!isOnline || !selectedSession}
          onClick={() => setShowCancellation(true)}
        />
        {canManage && (
          <>
            <ActionCard
              title="Review Cancellation"
              description="Approve or reject a branch-scoped pending request."
              label="Review Request"
              color="bg-yellow-500 hover:bg-yellow-600"
              disabled={!isOnline || !selectedRequest}
              onClick={() => setShowApproval(true)}
            />
            <ActionCard
              title="Rate Override"
              description="Override the selected session's current hourly rate."
              label="Override Rate"
              color="bg-blue-500 hover:bg-blue-600"
              disabled={!isOnline || !selectedSession || !hasValidRate}
              onClick={() => setShowRateOverride(true)}
            />
            <ActionCard
              title="Manager Takeover"
              description="Take over an open session from an offline device."
              label="Take Over Session"
              color="bg-orange-500 hover:bg-orange-600"
              disabled={!isOnline || !selectedSession}
              onClick={() => setShowTakeover(true)}
            />
            <ActionCard
              title="Shift Handover"
              description="Transfer open sessions between eligible branch staff."
              label="Start Handover"
              color="bg-purple-500 hover:bg-purple-600"
              disabled={!isOnline || !canHandover}
              onClick={() => setShowHandover(true)}
            />
            <ActionCard
              title="Audit Log"
              description="View governance actions for the selected session."
              label="View Audit Log"
              color="bg-gray-600 hover:bg-gray-700"
              disabled={!isOnline || !selectedSession}
              onClick={() => setShowAuditLog(true)}
            />
          </>
        )}
      </div>

      {showCancellation && selectedSession && (
        <CancellationModal
          sessionId={selectedSession.id}
          onClose={() => setShowCancellation(false)}
          onSuccess={() => {
            setNotice("Cancellation request submitted for manager review.");
            if (canManage) {
              void loadPendingRequests();
            }
          }}
        />
      )}
      {canManage && showApproval && selectedRequest && (
        <ManagerApprovalModal
          requestId={selectedRequest.id}
          sessionId={selectedRequest.sessionId}
          onClose={() => setShowApproval(false)}
          onSuccess={() =>
            void Promise.all([loadPendingRequests(), loadSessions(), loadStaff()])
          }
        />
      )}
      {canManage && showRateOverride && selectedSession && hasValidRate && (
        <RateOverrideModal
          key={`${selectedSession.id}:${currentRate}`}
          sessionId={selectedSession.id}
          currentRate={currentRate}
          currency={selectedSession.branch.currency}
          onClose={() => setShowRateOverride(false)}
          onSuccess={loadSessions}
        />
      )}
      {canManage && showTakeover && selectedSession && (
        <TakeoverModal
          sessionId={selectedSession.id}
          onClose={() => setShowTakeover(false)}
          onSuccess={() => void Promise.all([loadSessions(), loadStaff()])}
        />
      )}
      {canManage && showHandover && (
        <ShiftHandoverScreen
          staff={staff}
          onClose={() => setShowHandover(false)}
          onSuccess={() => void Promise.all([loadSessions(), loadStaff()])}
        />
      )}
      {canManage && showAuditLog && selectedSession && (
        <AuditLogViewer
          sessionId={selectedSession.id}
          onClose={() => setShowAuditLog(false)}
        />
      )}
    </div>
  );
}

function ActionCard({
  title,
  description,
  label,
  color,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  label: string;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 transition hover:shadow-md">
      <h3 className="mb-1 font-semibold text-gray-700">{title}</h3>
      <p className="mb-3 text-sm text-gray-500">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`rounded-md px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 ${color}`}
      >
        {label}
      </button>
    </div>
  );
}

export default function GovernancePage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER"]}>
      <GovernanceContent />
    </ProtectedRoute>
  );
}
