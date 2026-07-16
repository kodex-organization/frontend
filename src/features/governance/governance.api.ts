import { apiFetch } from '@/lib/api/client';

// ─── Cancellation Request ──────────────────────────────────────────
export async function createCancellationRequest(data: {
  sessionId: string;
  reason: string;
}) {
  return apiFetch('/governance/cancellation-request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function reviewCancellationRequest(
  requestId: string,
  data: { status: 'approved' | 'rejected'; reviewReason: string }
) {
  return apiFetch(`/governance/cancellation-request/${requestId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Rate Override ─────────────────────────────────────────────────
export async function overrideRate(data: {
  sessionId: string;
  newRate: number;
  reason: string;
}) {
  return apiFetch('/governance/rate-override', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Shift Handover ────────────────────────────────────────────────
export async function shiftHandover(data: {
  fromUserId: string;
  toUserId: string;
}) {
  return apiFetch('/governance/shift-handover', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Manager Takeover ──────────────────────────────────────────────
export async function managerTakeover(data: {
  sessionId: string;
  reason: string;
}) {
  return apiFetch('/governance/manager-takeover', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Audit Log ─────────────────────────────────────────────────────
export async function getAuditLogs(sessionId: string) {
  return apiFetch(`/governance/audit-log/${sessionId}`);
}

// ─── Sessions (for session picker) ─────────────────────────────────
export async function listSessions() {
  return apiFetch('/sessions');
}
// ─── Pending Cancellation Requests (for review picker) ──────────────
export async function listPendingCancellationRequests() {
  return apiFetch('/governance/cancellation-requests');
}
