import {
  cacheScopedJson,
  readScopedJson,
} from "@/lib/sync/offline-reference-cache";
import type { ScheduledReport, ReportTab } from "./types";

export type ReportParams = { date: string; from: string; to: string };

type SavedReport = { params: ReportParams; data: unknown };

export type ReportSnapshot = {
  data: unknown;
  savedAt: string;
  exact: boolean;
  params: ReportParams;
};

// Only the filters that change each report's answer go into the key.
function paramPart(tab: ReportTab, params: ReportParams): string {
  switch (tab) {
    case "z-report":
    case "cash-reconciliation":
    case "reconciliation":
      return params.date;
    case "monthly-summary":
      return params.date.slice(0, 7);
    case "udhaar-aging":
      return "current";
    default:
      return `${params.from}_${params.to}`;
  }
}

const exactName = (userId: string, branchId: string, tab: ReportTab, params: ReportParams) =>
  `reports:${userId}:${branchId || "all"}:${tab}:${paramPart(tab, params)}`;

const latestName = (userId: string, branchId: string, tab: ReportTab) =>
  `reports:${userId}:${branchId || "all"}:${tab}:latest`;

const schedulesName = (userId: string) => `reports:${userId}:schedules`;

export async function saveReportSnapshot(
  userId: string,
  branchId: string,
  tab: ReportTab,
  params: ReportParams,
  data: unknown,
) {
  if (!userId || data === undefined || data === null) return;
  const saved: SavedReport = { params, data };
  await Promise.all([
    cacheScopedJson(exactName(userId, branchId, tab, params), saved),
    cacheScopedJson(latestName(userId, branchId, tab), saved),
  ]);
}

export async function readReportSnapshot(
  userId: string,
  branchId: string,
  tab: ReportTab,
  params: ReportParams,
): Promise<ReportSnapshot | null> {
  if (!userId) return null;
  const exact = await readScopedJson<SavedReport>(exactName(userId, branchId, tab, params));
  if (exact) {
    return { data: exact.data.data, savedAt: exact.savedAt, exact: true, params: exact.data.params };
  }
  const latest = await readScopedJson<SavedReport>(latestName(userId, branchId, tab));
  if (latest) {
    return { data: latest.data.data, savedAt: latest.savedAt, exact: false, params: latest.data.params };
  }
  return null;
}

export function describeSavedFilters(tab: ReportTab, params: ReportParams): string {
  switch (tab) {
    case "z-report":
    case "cash-reconciliation":
    case "reconciliation":
      return `This saved copy is for ${params.date}.`;
    case "monthly-summary":
      return `This saved copy is for ${params.date.slice(0, 7)}.`;
    case "udhaar-aging":
      return "";
    default:
      return `This saved copy is for ${params.from} to ${params.to}.`;
  }
}

export function saveSchedulesSnapshot(userId: string, schedules: ScheduledReport[]) {
  if (!userId) return Promise.resolve();
  return cacheScopedJson<ScheduledReport[]>(schedulesName(userId), schedules);
}

export async function readSchedulesSnapshot(userId: string) {
  if (!userId) return null;
  return readScopedJson<ScheduledReport[]>(schedulesName(userId));
}
