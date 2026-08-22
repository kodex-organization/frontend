export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditActor {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
}

export interface AuditBranch {
  id: string;
  name: string | null;
}

export interface AuditDevice {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
}

export interface AuditLogItem {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  actorUserId: string | null;
  deviceId: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: AuditSeverity;
  details: Record<string, any> | null;
  occurredAt: string;
  actorUser?: AuditActor | null;
  branch?: AuditBranch | null;
  device?: AuditDevice | null;
}

export interface AnomalyAlertItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  userId: string | null;
  anomalyType: string;
  severity: AuditSeverity;
  description: string;
  metadata: Record<string, any> | null;
  isResolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  detectedAt: string;
  user?: { id: string; fullName: string | null; email: string | null } | null;
  branch?: { id: string; name: string | null } | null;
  resolvedBy?: { id: string; fullName: string | null } | null;
}

export interface AuditRetentionPolicy {
  id: string;
  tenantId: string;
  retentionDays: number;
  autoArchive: boolean;
  lastArchivedAt: string | null;
  updatedAt: string;
}

export interface AuditKPIs {
  totalLogs: number;
  anomaliesToday: number;
  tamperCount: number;
  reprintCount: number;
}

export interface ClockVerificationResult {
  isTampered: boolean;
  serverTime: string;
  clientTime: string;
  diffSeconds: number;
  toleranceSeconds: number;
}

export interface AuditLogsFilterParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  actionType?: string;
  entityType?: string;
  actorUserId?: string;
  branchId?: string;
  severity?: AuditSeverity;
  search?: string;
}

export interface AnomalyFilterParams {
  page?: number;
  limit?: number;
  isResolved?: boolean;
  severity?: AuditSeverity;
  anomalyType?: string;
  branchId?: string;
}