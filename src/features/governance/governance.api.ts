import { apiFetch } from "@/lib/api/client";
import type {
  AuditLog,
  CancellationRequest,
  GovernanceStaff,
  ManagerTakeoverInput,
  RateOverrideInput,
  ShiftHandoverInput,
} from "./governance.types";

export async function createCancellationRequest(data: {
  sessionId: string;
  reason: string;
}) {
  return apiFetch<CancellationRequest>("/governance/cancellation-request", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reviewCancellationRequest(
  requestId: string,
  data: { status: "approved" | "rejected"; reviewReason: string },
) {
  return apiFetch<CancellationRequest>(
    `/governance/cancellation-request/${requestId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export async function listPendingCancellationRequests() {
  return apiFetch<CancellationRequest[]>(
    "/governance/cancellation-requests",
  );
}

export async function listEligibleStaff() {
  return apiFetch<GovernanceStaff[]>("/governance/eligible-staff");
}

export async function overrideRate(data: RateOverrideInput) {
  return apiFetch("/governance/rate-override", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function shiftHandover(data: ShiftHandoverInput) {
  return apiFetch<{ transferredCount: number; sessionIds: string[] }>(
    "/governance/shift-handover",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function managerTakeover(data: ManagerTakeoverInput) {
  return apiFetch("/governance/manager-takeover", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAuditLogs(sessionId: string) {
  return apiFetch<AuditLog[]>(`/governance/audit-log/${sessionId}`);
}
