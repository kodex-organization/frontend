import { apiFetch } from "@/lib/api/client";

export interface BranchReportMetrics {
  revenue: number;
  sessionCount: number;
  sessionDurationSeconds: number;
  udhaarIssued: number;
  udhaarReceived: number;
  outstandingUdhaar: number;
}

export interface BranchReportRow extends BranchReportMetrics {
  branchId: string;
  branchName: string | null;
}

export interface CrossBranchReport {
  tenantId: string;
  period: { from: string; to: string };
  totals: BranchReportMetrics;
  branches: BranchReportRow[];
}

export interface CrossBranchReportFilters {
  from: string;
  to: string;
  branchIds: string[];
}

export function buildCrossBranchReportPath(
  filters: CrossBranchReportFilters,
) {
  const query = new URLSearchParams({
    from: `${filters.from}T00:00:00.000Z`,
    to: `${filters.to}T23:59:59.999Z`,
  });
  if (filters.branchIds.length > 0) {
    query.set("branchIds", filters.branchIds.join(","));
  }
  return `/reporting/cross-branch?${query.toString()}`;
}

export function getCrossBranchReport(filters: CrossBranchReportFilters) {
  return apiFetch<CrossBranchReport>(buildCrossBranchReportPath(filters));
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
