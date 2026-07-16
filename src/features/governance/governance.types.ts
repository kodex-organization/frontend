export interface CancellationRequest {
  id: string;
  sessionId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  createdAt: string;
}

export interface RateOverrideInput {
  sessionId: string;
  newRate: number;
  reason: string;
}

export interface ShiftHandoverInput {
  fromUserId: string;
  toUserId: string;
}

export interface ManagerTakeoverInput {
  sessionId: string;
  newDeviceId: string;
  reason: string;
}

export interface AuditLog {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  occurredAt: string;
  actorUser?: {
    fullName: string;
    email: string;
  };
}