import { apiFetch } from "@/lib/api/client";
import {
  queueUdhaarChange,
  getActiveOfflineBranchId,
} from "@/lib/sync/offline-db";
import type {
  CustomerBalance,
  LedgerEntry,
  SettlementInput,
  SettlementResult,
  ThresholdSettings,
} from "../types";

export const udhaarService = {
  getBalances() {
    return apiFetch<CustomerBalance[]>("/udhaar/balances");
  },

  getBalance(customerId: string) {
    return apiFetch<{
      customer: {
        id: string;
        fullName: string | null;
        phone: string | null;
      };
      outstandingBalance: number;
      lastRecalculatedAt: string | null;
    }>(`/udhaar/customers/${encodeURIComponent(customerId)}/balance`);
  },

  getEntries(customerId: string) {
    return apiFetch<LedgerEntry[]>(
      `/udhaar/customers/${encodeURIComponent(customerId)}/entries`,
    );
  },

  async recordSettlement(input: SettlementInput): Promise<SettlementResult> {
    const branchId = getActiveOfflineBranchId() || "default";
    const entryId = crypto.randomUUID();

    const mockEntry: LedgerEntry = {
      id: entryId,
      entryType: "credit",
      amount: input.amount,
      runningBalance: 0,
      reason: input.reason || "Offline settlement payment",
      invoicePaymentId: null,
      invoice: null,
      createdBy: null,
      createdByDevice: null,
      createdAt: new Date().toISOString(),
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueUdhaarChange(
        {
          id: entryId,
          branchId,
          customerId: input.customerId,
          entryType: "PAYMENT",
          amount: String(input.amount),
          notes: input.reason || "Offline settlement payment",
          createdAt: new Date().toISOString(),
        },
        "create",
      );

      return {
        entry: mockEntry,
        customerId: input.customerId,
        outstandingBalance: 0,
      };
    }

    try {
      return await apiFetch<SettlementResult>("/udhaar/settlements", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      await queueUdhaarChange(
        {
          id: entryId,
          branchId,
          customerId: input.customerId,
          entryType: "PAYMENT",
          amount: String(input.amount),
          notes: input.reason || "Offline settlement payment",
          createdAt: new Date().toISOString(),
        },
        "create",
      );

      return {
        entry: mockEntry,
        customerId: input.customerId,
        outstandingBalance: 0,
      };
    }
  },

  getThresholds() {
    return apiFetch<ThresholdSettings>("/udhaar/thresholds");
  },

  updateThresholds(input: {
    individualLimit: number;
    aggregateLimit?: number;
  }) {
    return apiFetch<ThresholdSettings>("/udhaar/thresholds", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};
