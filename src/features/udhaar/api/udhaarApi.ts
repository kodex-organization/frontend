import { apiFetch } from "@/lib/api/client";

export interface UdhaarCustomerSummary {
  id: string;
  fullName: string | null;
  phone: string | null;
  cnic: string | null;
  outstandingBalance: number;
  status: "pending" | "cleared" | "overdue";
}

export interface UdhaarAgingSummary {
  summary: {
    totalOutstanding: number;
    overdueBalance: number;
    activeAccounts: number;
  };
  buckets: {
    current: number;
    days1to30: number;
    days30to60: number;
    days60to90: number;
    days90plus: number;
  };
}

export interface UdhaarStatementEntry {
  id: string;
  amount: number;
  reason: string | null;
  entryType: string | null;
  createdAt: string;
}

export async function getUdhaarCustomers(q?: string, status: string = "all") {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  return apiFetch<UdhaarCustomerSummary[]>(`/udhaar/customers${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function getUdhaarAging() {
  return apiFetch<UdhaarAgingSummary>("/udhaar/aging");
}

export async function getUdhaarStatement(customerId: string, from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return apiFetch<{ customerId: string; from: string; to: string; entries: UdhaarStatementEntry[] }>(`/udhaar/statements/${encodeURIComponent(customerId)}?${query.toString()}`);
}

export async function createUdhaarAdjustment(payload: { customerId: string; amount: number; reason: string; approvedById?: string | null; approvedByPin?: string | null }) {
  const body: Record<string, any> = {
    customerId: payload.customerId,
    amount: payload.amount,
    reason: payload.reason,
  };

  // Only include optional fields if they have values
  if (payload.approvedById) {
    body.approvedById = payload.approvedById;
  }
  if (payload.approvedByPin) {
    body.approvedByPin = payload.approvedByPin;
  }

  return apiFetch<{ id: string }>("/udhaar/adjustments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function recordSettlement(payload: {
  customerId: string;
  amount: number;
  reason: string;
  invoiceId?: string;
}) {
  return apiFetch<{ id: string; customerId: string; amount: number; newBalance: number }>("/udhaar/settlements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UdhaarThresholdSettings {
  individualLimit: number;
  aggregateLimit?: number;
}

export async function getThresholds() {
  return apiFetch<UdhaarThresholdSettings>("/udhaar/thresholds");
}

export async function updateThresholds(payload: UdhaarThresholdSettings) {
  return apiFetch<UdhaarThresholdSettings>("/udhaar/thresholds", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
