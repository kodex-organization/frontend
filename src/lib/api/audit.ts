import type {
  AnomalyAlertItem,
  AnomalyFilterParams,
  AuditKPIs,
  AuditLogItem,
  AuditLogsFilterParams,
  AuditRetentionPolicy,
  ClockVerificationResult,
} from "../../types/audit";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cuecloud_access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    null
  );
}

function getStoredDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cuecloud_device_id") || null;
}

/**
 * Generic helper for typed API responses
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const deviceId = getStoredDeviceId();

  // Only send "Content-Type": "application/json" when a body is actually present
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceId ? { "x-device-id": deviceId } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message || json.message || "An unexpected error occurred");
  }

  return json.data as T;
}

/**
 * 1. Fetch paginated audit trail logs with dynamic filters
 */
export async function fetchAuditLogs(
  params: AuditLogsFilterParams = {}
): Promise<{
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  logs: AuditLogItem[];
}> {
  const query = new URLSearchParams();

  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.search && params.search.trim()) query.append("search", params.search.trim());
  if (params.severity) query.append("severity", params.severity);
  if (params.actionType) query.append("actionType", params.actionType);
  if (params.entityType) query.append("entityType", params.entityType);
  if (params.actorUserId) query.append("actorUserId", params.actorUserId);
  if (params.branchId && params.branchId !== "all") query.append("branchId", params.branchId);
  if (params.startDate) query.append("startDate", params.startDate);
  if (params.endDate) query.append("endDate", params.endDate);

  const qs = query.toString();
  return request(`/audit/logs${qs ? `?${qs}` : ""}`);
}

/**
 * 2. Fetch high-level Audit KPIs for dashboard summary
 */
export async function fetchAuditKPIs(): Promise<AuditKPIs> {
  return request<AuditKPIs>("/audit/kpis");
}

/**
 * 3. Log a receipt reprint event
 */
export async function logReceiptReprint(payload: {
  invoiceId: string;
  reason: string;
  deviceId?: string;
}): Promise<AuditLogItem> {
  return request<AuditLogItem>("/audit/reprint", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 4. Verify client clock sync and tamper detection
 */
export async function verifyClientClock(payload: {
  clientTimestamp: string;
  deviceId?: string;
  toleranceSeconds?: number;
}): Promise<ClockVerificationResult> {
  return request<ClockVerificationResult>("/audit/check-clock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 5. Fetch anomaly alerts list with filters
 */
export async function fetchAnomalyAlerts(
  params: AnomalyFilterParams = {}
): Promise<{
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  alerts: AnomalyAlertItem[];
}> {
  const query = new URLSearchParams();

  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.severity) query.append("severity", params.severity);
  if (params.anomalyType) query.append("anomalyType", params.anomalyType);
  if (params.branchId && params.branchId !== "all") query.append("branchId", params.branchId);
  if (params.isResolved !== undefined) {
    query.append("isResolved", String(params.isResolved));
  }

  const qs = query.toString();
  return request(`/audit/anomalies${qs ? `?${qs}` : ""}`);
}

/**
 * 6. Trigger active anomaly pattern scan
 */
export async function triggerAnomalyScan(branchId?: string): Promise<{
  scannedAt: string;
  detectedCount: number;
  anomalies: AnomalyAlertItem[];
}> {
  const qs = branchId && branchId !== "all" ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return request(`/audit/anomalies/scan${qs}`, {
    method: "POST",
  });
}

/**
 * 7. Resolve an anomaly alert
 */
export async function resolveAnomaly(
  anomalyId: string,
  resolutionNotes: string
): Promise<AnomalyAlertItem> {
  return request<AnomalyAlertItem>(`/audit/anomalies/${anomalyId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolutionNotes }),
  });
}

/**
 * 8. Fetch audit log retention policy
 */
export async function fetchRetentionPolicy(): Promise<AuditRetentionPolicy> {
  return request<AuditRetentionPolicy>("/audit/retention-policy");
}

/**
 * 9. Update audit log retention policy
 */
export async function updateRetentionPolicy(payload: {
  retentionDays: number;
  autoArchive: boolean;
}): Promise<AuditRetentionPolicy> {
  return request<AuditRetentionPolicy>("/audit/retention-policy", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}