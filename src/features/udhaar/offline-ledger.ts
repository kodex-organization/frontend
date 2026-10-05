import {
  offlineDB,
  queueUdhaarChange,
  getActiveOfflineBranchId,
  type UdhaarOfflinePayload,
} from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";
import type {
  UdhaarAgingSummary,
  UdhaarCustomerSummary,
  UdhaarStatementEntry,
} from "./api/udhaarApi";

/**
 * Offline helpers for the Udhaar module (SRS 3.7 + 3.13).
 *
 * Offline writes are saved in the Dexie `pendingQueue` (entity "udhaar") and the
 * sync manager sends them to POST /sync/push when the server is reachable.
 * While they wait, the screen = last server data + these pending entries, so the
 * cashier immediately sees the balance they just created.
 * The ledger itself stays append-only: we only ever ADD entries, never edit.
 */

/** Same rule the server uses in listCustomers (udhaar.service.ts). */
const OVERDUE_ABOVE = 100;

export type PendingUdhaarEntry = {
  id: string;
  customerId: string;
  /** + increases what the customer owes, - decreases it. */
  signedAmount: number;
  reason: string | null;
  entryType: "debit" | "credit";
  createdAt: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function toSigned(payload: UdhaarOfflinePayload): number {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount)) return 0;
  switch (payload.entryType) {
    case "CHARGE":
      return Math.abs(amount);
    case "PAYMENT":
    case "REVERSAL":
      return -Math.abs(amount);
    case "ADJUSTMENT":
      return amount; // negative adjustment = credit (same as the online rule)
    default:
      return 0;
  }
}

/** Udhaar entries of the active branch that are saved here but not yet on the server. */
export async function getPendingUdhaarEntries(): Promise<PendingUdhaarEntry[]> {
  const branchId = getActiveOfflineBranchId();
  if (!branchId) return [];
  const rows = await offlineDB.pendingQueue.toArray();
  return rows
    .filter((row) => row.entity === "udhaar" && row.status !== "synced")
    .map((row) => row.payload as UdhaarOfflinePayload)
    .filter((payload) => payload.branchId === branchId)
    .map((payload) => {
      const signedAmount = toSigned(payload);
      return {
        id: payload.id,
        customerId: payload.customerId,
        signedAmount,
        reason: payload.notes ?? null,
        entryType: signedAmount < 0 ? ("credit" as const) : ("debit" as const),
        createdAt: payload.createdAt,
      };
    })
    .filter((entry) => entry.signedAmount !== 0);
}

function requireBranchId(): string {
  const branchId = getActiveOfflineBranchId();
  if (!branchId) throw new Error("No active branch. Please sign in again.");
  return branchId;
}

/** Customer paid back some udhaar while offline (credit entry). */
export async function queueOfflineSettlement(input: {
  customerId: string;
  amount: number;
  reason: string;
}) {
  await queueUdhaarChange({
    id: crypto.randomUUID(),
    branchId: requireBranchId(),
    customerId: input.customerId,
    entryType: "PAYMENT",
    amount: String(Math.abs(input.amount)),
    notes: input.reason,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Manual adjustment while offline. The signed-in owner/manager is the approver
 * (exactly like the online endpoint, which approves with the current user).
 * No PIN is ever stored on the device (SRS 5.3: no plaintext credentials).
 */
export async function queueOfflineAdjustment(input: {
  customerId: string;
  amount: number; // + debit, - credit
  reason: string;
}) {
  await queueUdhaarChange({
    id: crypto.randomUUID(),
    branchId: requireBranchId(),
    customerId: input.customerId,
    entryType: "ADJUSTMENT",
    amount: String(input.amount),
    notes: input.reason,
    approvedById: tokenStorage.getAccessContext()?.userId ?? null,
    createdAt: new Date().toISOString(),
  });
}

/** Customer list = server balances + entries still waiting to sync. */
export function applyPendingToCustomers(
  customers: UdhaarCustomerSummary[],
  pending: PendingUdhaarEntry[],
): UdhaarCustomerSummary[] {
  if (pending.length === 0) return customers;
  const delta = new Map<string, number>();
  for (const entry of pending) {
    delta.set(entry.customerId, (delta.get(entry.customerId) ?? 0) + entry.signedAmount);
  }
  return customers.map((customer) => {
    const change = delta.get(customer.id);
    if (!change) return customer;
    const balance = round2(customer.outstandingBalance + change);
    return {
      ...customer,
      outstandingBalance: balance,
      status: balance > 0 ? (balance > OVERDUE_ABOVE ? "overdue" : "pending") : "cleared",
    };
  });
}

/**
 * Aging buckets with the waiting entries added. New debits are "current";
 * payments clear the OLDEST bucket first (SRS 3.7: settle oldest first).
 * This is an estimate until the entries reach the server.
 */
export function applyPendingToAging(
  aging: UdhaarAgingSummary | null,
  before: UdhaarCustomerSummary[],
  after: UdhaarCustomerSummary[],
  pending: PendingUdhaarEntry[],
): UdhaarAgingSummary | null {
  if (!aging || pending.length === 0) return aging;

  const buckets = { ...aging.buckets };
  let overdue = aging.summary.overdueBalance;

  for (const entry of pending) {
    if (entry.signedAmount > 0) buckets.current += entry.signedAmount;
  }
  let credit = pending.reduce((sum, e) => (e.signedAmount < 0 ? sum - e.signedAmount : sum), 0);
  const oldestFirst = ["days90plus", "days60to90", "days30to60", "days1to30", "current"] as const;
  for (const key of oldestFirst) {
    const take = Math.min(buckets[key], credit);
    buckets[key] -= take;
    credit -= take;
    if (key === "days90plus") overdue -= take;
  }

  const beforeById = new Map(before.map((c) => [c.id, c.outstandingBalance]));
  let activeAccounts = aging.summary.activeAccounts;
  for (const customer of after) {
    const was = beforeById.get(customer.id) ?? 0;
    if (was <= 0 && customer.outstandingBalance > 0) activeAccounts += 1;
    if (was > 0 && customer.outstandingBalance <= 0) activeAccounts -= 1;
  }

  const rounded = {
    current: round2(buckets.current),
    days1to30: round2(buckets.days1to30),
    days30to60: round2(buckets.days30to60),
    days60to90: round2(buckets.days60to90),
    days90plus: round2(buckets.days90plus),
  };
  return {
    summary: {
      totalOutstanding: round2(Object.values(rounded).reduce((a, b) => a + b, 0)),
      overdueBalance: round2(Math.max(0, overdue)),
      activeAccounts: Math.max(0, activeAccounts),
    },
    buckets: rounded,
  };
}

/** Waiting entries of one customer, shaped like statement rows, inside the date range. */
export function pendingStatementEntries(
  customerId: string,
  from: string,
  to: string,
  pending: PendingUdhaarEntry[],
): UdhaarStatementEntry[] {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return pending
    .filter((entry) => entry.customerId === customerId)
    .filter((entry) => {
      const time = new Date(entry.createdAt).getTime();
      return (Number.isNaN(start) || time >= start) && (Number.isNaN(end) || time <= end);
    })
    .map((entry) => ({
      id: entry.id,
      amount: Math.abs(entry.signedAmount),
      reason: entry.reason ? `${entry.reason} (waiting to sync)` : "Waiting to sync",
      entryType: entry.entryType,
      createdAt: entry.createdAt,
    }));
}

/** Same, but shaped like the rows of the customer profile "Udhaar Credit Ledger" tab. */
export function pendingHistoryEntries(customerId: string, pending: PendingUdhaarEntry[]) {
  return pending
    .filter((entry) => entry.customerId === customerId)
    .map((entry) => ({
      id: entry.id,
      entryType: entry.entryType,
      amount: Math.abs(entry.signedAmount),
      reason: entry.reason,
      createdAt: entry.createdAt,
    }));
}