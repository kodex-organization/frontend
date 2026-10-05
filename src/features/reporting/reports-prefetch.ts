import {
  cacheScopedJson,
  isNetworkFailure,
  readScopedJson,
} from "@/lib/sync/offline-reference-cache";
import {
  fetchAging,
  fetchAllShifts,
  fetchCashReconciliation,
  fetchMonthlySummary,
  fetchPeakHours,
  fetchReconciliation,
  fetchSchedules,
  fetchSealedReports,
  fetchShiftReport,
  fetchStaffPerformance,
  fetchTopCustomers,
  fetchTopItems,
  fetchZReport,
} from "./api";
import {
  saveReportSnapshot,
  saveSchedulesSnapshot,
  type ReportParams,
} from "./reports-offline";
import type { ReportTab } from "./types";

export const PREFETCH_ENABLED = true;

const MIN_GAP_MS = 15 * 60 * 1000;
const PAUSE_MS = 300;
const NEEDS_BRANCH: ReportTab[] = ["z-report", "cash-reconciliation", "reconciliation"];

export type PrefetchInput = {
  userId: string;
  branchId: string;
  tabs: ReportTab[];
  skip: ReportTab;
  isManagement: boolean;
  date: string;
  cashCount: number;
  openingCash?: number;
  rangeFor: (tab: ReportTab) => { from: string; to: string };
  isCancelled: () => boolean;
};

async function prefetchOne(tab: ReportTab, input: PrefetchInput) {
  const { userId, branchId, date } = input;
  if (NEEDS_BRANCH.includes(tab) && !branchId) return;

  const range = input.rangeFor(tab);
  const params: ReportParams = { date, from: range.from, to: range.to };
  const rangeFrom = `${range.from}T00:00:00.000Z`;
  const rangeTo = `${range.to}T23:59:59.999Z`;
  const scope = branchId || undefined;
  let result: unknown;

  switch (tab) {
    case "z-report":
      result = await fetchZReport(branchId, date);
      break;
    case "cash-reconciliation":
      result = await fetchCashReconciliation(branchId, date, input.cashCount, input.openingCash);
      break;
    case "monthly-summary": {
      const day = new Date(`${date}T00:00:00`);
      result = await fetchMonthlySummary(scope, day.getFullYear(), day.getMonth() + 1);
      break;
    }
    case "udhaar-aging":
      result = await fetchAging(scope);
      break;
    case "top-customers":
      result = await fetchTopCustomers(scope, rangeFrom, rangeTo);
      break;
    case "top-items":
      result = await fetchTopItems(scope, rangeFrom, rangeTo);
      break;
    case "staff-performance":
      result = await fetchStaffPerformance(scope, rangeFrom, rangeTo);
      break;
    case "peak-hours":
      result = await fetchPeakHours(scope, rangeFrom, rangeTo);
      break;
    case "reconciliation":
      result = await fetchReconciliation(branchId, date);
      break;
    case "shift-report":
      result = input.isManagement
        ? await fetchAllShifts(scope, rangeFrom, rangeTo)
        : await fetchShiftReport(userId, rangeFrom, rangeTo);
      break;
    case "sealed-reports":
      result = await fetchSealedReports(scope, range.from, range.to);
      break;
    case "schedules":
      await saveSchedulesSnapshot(userId, await fetchSchedules());
      return;
    default:
      return;
  }

  await saveReportSnapshot(userId, branchId, tab, params, result);
}

export async function prefetchReports(input: PrefetchInput) {
  if (!PREFETCH_ENABLED) return;
  const { userId, branchId, tabs, skip, date, isCancelled } = input;
  if (!userId) return;

  const stampName = `reports:${userId}:${branchId || "all"}:prefetch:${date}`;
  const last = await readScopedJson<number>(stampName);
  if (last && Date.now() - last.data < MIN_GAP_MS) return;
  await cacheScopedJson(stampName, Date.now());

  for (const tab of tabs) {
    if (tab === skip) continue;
    if (isCancelled()) return;
    try {
      await prefetchOne(tab, input);
    } catch (error) {
      if (isNetworkFailure(error)) {
        await cacheScopedJson(stampName, 0);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
}