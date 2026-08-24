import { apiDownload, apiFetch } from "@/lib/api/client";

export type DataExportStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "expired";

export interface DataExportJob {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  requestedByName: string | null;
  requestedByEmail: string | null;
  format: "json";
  status: DataExportStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  checksumSha256: string | null;
  sizeBytes: string | null;
  failureReason: string | null;
  downloadAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataExportPage {
  items: DataExportJob[];
  total: number;
  limit: number;
  offset: number;
}

export function buildDataExportListPath(
  status?: DataExportStatus,
  limit = 100,
  offset = 0,
) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) query.set("status", status);
  return `/tenancy/data-exports/?${query.toString()}`;
}

export function formatExportSize(sizeBytes: string | null) {
  if (sizeBytes === null) return "Unavailable";
  const bytes = Number(sizeBytes);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function canDownloadExport(job: DataExportJob, now = new Date()) {
  return (
    job.status === "completed" &&
    job.downloadAvailable &&
    job.expiresAt !== null &&
    new Date(job.expiresAt) > now
  );
}

export function requestDataExport() {
  return apiFetch<DataExportJob>("/tenancy/data-exports/", {
    method: "POST",
    body: JSON.stringify({ format: "json" }),
  });
}

export function listDataExports(status?: DataExportStatus) {
  return apiFetch<DataExportPage>(buildDataExportListPath(status));
}

export function getDataExport(exportId: string) {
  return apiFetch<DataExportJob & { auditEvents: unknown[] }>(
    `/tenancy/data-exports/${exportId}`,
  );
}

export function downloadDataExport(exportId: string) {
  return apiDownload(`/tenancy/data-exports/${exportId}/download`);
}
