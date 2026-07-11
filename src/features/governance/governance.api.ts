const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Cancellation Request ──────────────────────────────────────────
export async function createCancellationRequest(data: {
  sessionId: string;
  reason: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/governance/cancellation-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function reviewCancellationRequest(
  requestId: string,
  data: { status: 'approved' | 'rejected'; reviewReason: string }
) {
  const res = await fetch(
    `${BASE_URL}/api/v1/governance/cancellation-request/${requestId}/review`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    }
  );
  return res.json();
}

// ─── Rate Override ─────────────────────────────────────────────────
export async function overrideRate(data: {
  sessionId: string;
  newRate: number;
  reason: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/governance/rate-override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Shift Handover ────────────────────────────────────────────────
export async function shiftHandover(data: {
  fromUserId: string;
  toUserId: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/governance/shift-handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Manager Takeover ──────────────────────────────────────────────
export async function managerTakeover(data: {
  sessionId: string;
  newDeviceId: string;
  reason: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/governance/manager-takeover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Audit Log ─────────────────────────────────────────────────────
export async function getAuditLogs(sessionId: string) {
  const res = await fetch(
    `${BASE_URL}/api/v1/governance/audit-log/${sessionId}`,
    {
      credentials: 'include',
    }
  );
  return res.json();
}