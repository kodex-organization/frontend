import type { ActiveSession } from "@/features/sessions/types";
import type { UserRole } from "@/lib/auth/session";

export interface GovernanceStaff {
  id: string;
  fullName: string | null;
  email: string | null;
  roles: UserRole[];
  openSessionCount: number;
}

export interface CancellationRequest {
  id: string;
  sessionId: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedBy: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  createdAt: string;
  session: Pick<
    ActiveSession,
    "id" | "status" | "appliedHourlyRate" | "table"
  >;
}

export interface RateOverrideInput {
  sessionId: string;
  newRate: number;
  expectedRate: number;
  reason: string;
}

export interface ShiftHandoverInput {
  fromUserId: string;
  toUserId: string;
}

export interface ManagerTakeoverInput {
  sessionId: string;
  reason: string;
}

export interface AuditLog {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  occurredAt: string;
  actorUser?: {
    fullName: string | null;
    email: string | null;
  } | null;
}
