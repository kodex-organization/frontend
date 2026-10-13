import { apiFetch } from "@/lib/api/client";
import { offlineDB, getActiveOfflineBranchId } from "@/lib/sync/offline-db";

export interface LiveTableSession {
  id: string;
  tableId: string;
  startedAt: string;
  expectedEndTime?: string;
  status: string;
  branch: {
    id: string;
    name: string;
  };
  table?: {
    tableNumber: string;
    status: string;
  };
  customer?: {
    fullName: string;
  };
}

export interface LiveTableOverview {
  activeSessionsCount: number;
  sessions: LiveTableSession[];
}

export interface RevenueKPIs {
  totalRevenue: number;
  tableRevenue: number;
  canteenRevenue: number;
  paymentMethods: Record<string, number>;
}

export interface OutstandingUdhaar {
  totalOutstanding: number;
  outstandingList: Array<{
    customerId: string;
    fullName: string;
    balance: number;
  }>;
}

export interface SyncDeviceStatus {
  id: string;
  deviceId: string;
  lastSyncedAt: string;
  lastHeartbeatAt: string;
  device: {
    deviceName: string;
    deviceType: string;
  };
  branch: {
    name: string;
  };
}

export interface RevenueTrend {
  today: number[];
  lastWeek: number[];
}

export interface TableHeatmap {
  [tableNumber: string]: {
    [dayOfWeek: number]: {
      [hourOfDay: number]: number;
    };
  };
}

export interface AnomalyItem {
  id: string;
  type: string;
  message: string;
  branchName?: string;
  customerName?: string;
  createdAt: string;
}

export interface TransactionItem {
  id: string;
  transactionType: string;
  referenceNumber: string;
  customerName: string;
  branchName: string;
  amount: number;
  detail: string;
  createdAt: string;
}

export async function getOfflineRevenueSnapshot(branchId?: string): Promise<{
  totalRevenue: number;
  tableRevenue: number;
  canteenRevenue: number;
  paymentMethods: Record<string, number>;
  revenueTrend: RevenueTrend;
}> {
  const scopeBranchId = branchId || getActiveOfflineBranchId();
  const cached = await offlineDB.cachedInvoices.toArray();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const invoices = cached
    .map((entry) => entry.data as {
      branchId?: string;
      branch?: { id?: string };
      status?: string | null;
      total?: number | string;
      createdAt?: string;
      items?: Array<{ itemType?: string | null; lineTotal?: number | string }>;
      payments?: Array<{ tenderType?: string | null; amount?: number | string }>;
    })
    .filter((invoice) => {
      const invoiceBranchId = invoice.branch?.id || invoice.branchId;
      const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : null;
      const createdKey = createdAt && !Number.isNaN(createdAt.getTime())
        ? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`
        : "";
      return (
        (!scopeBranchId || invoiceBranchId === scopeBranchId) &&
        invoice.status !== "void" &&
        createdKey === todayKey
      );
    });

  const trend = Array.from({ length: 24 }, () => 0);
  let totalRevenue = 0;
  let tableRevenue = 0;
  let canteenRevenue = 0;
  const paymentMethods: Record<string, number> = {};

  for (const invoice of invoices) {
    const total = Number(invoice.total || 0);
    totalRevenue += total;
    const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) trend[createdAt.getHours()] += total;

    for (const item of invoice.items || []) {
      const lineTotal = Number(item.lineTotal || 0);
      if (item.itemType === "session_time" || item.itemType === "table_time") {
        tableRevenue += lineTotal;
      } else if (item.itemType === "menu_item" || item.itemType === "canteen") {
        canteenRevenue += lineTotal;
      }
    }
    for (const payment of invoice.payments || []) {
      const tender = payment.tenderType || "UNKNOWN";
      paymentMethods[tender] = (paymentMethods[tender] || 0) + Number(payment.amount || 0);
    }
  }

  return {
    totalRevenue,
    tableRevenue,
    canteenRevenue,
    paymentMethods,
    revenueTrend: { today: trend, lastWeek: Array.from({ length: 24 }, () => 0) },
  };
}

export const DashboardApi = {
  getLiveTables: (branchId?: string) =>
    apiFetch<LiveTableOverview>(`/dashboard/live-tables${branchId ? `?branchId=${branchId}` : ""}`),

  getKPIs: (branchId?: string, date?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    if (date) params.append("date", date);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<RevenueKPIs>(`/dashboard/kpis${query}`);
  },

  getUdhaar: (branchId?: string) =>
    apiFetch<OutstandingUdhaar>(`/dashboard/udhaar${branchId ? `?branchId=${branchId}` : ""}`),

  getStaffPerformance: (branchId?: string, date?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    if (date) params.append("date", date);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<{ sessionsHandledByUser: Record<string, number> }>(`/dashboard/staff-performance${query}`);
  },

  getSyncStatus: (branchId?: string) =>
    apiFetch<SyncDeviceStatus[]>(`/dashboard/sync-status${branchId ? `?branchId=${branchId}` : ""}`),

  getRevenueTrend: (branchId?: string, date?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    if (date) params.append("date", date);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<RevenueTrend>(`/dashboard/revenue-trend${query}`);
  },

  getTableHeatmap: (branchId?: string) =>
    apiFetch<TableHeatmap>(`/dashboard/table-heatmap${branchId ? `?branchId=${branchId}` : ""}`),

  getAnomalies: (branchId?: string) =>
    apiFetch<AnomalyItem[]>(`/dashboard/anomalies${branchId ? `?branchId=${branchId}` : ""}`),

  getTransactions: (category: string, branchId?: string, date?: string) => {
    const params = new URLSearchParams();
    params.append("category", category);
    if (branchId) params.append("branchId", branchId);
    if (date) params.append("date", date);
    return apiFetch<TransactionItem[]>(`/dashboard/transactions?${params.toString()}`);
  },
};
