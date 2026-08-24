import { apiFetch } from "@/lib/api/client";

export interface LiveTableSession {
  id: string;
  tableId: string;
  startedAt: string;
  expectedEndTime?: string;
  status: string;
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
