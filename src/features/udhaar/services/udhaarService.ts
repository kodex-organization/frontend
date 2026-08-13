import { apiFetch } from "@/lib/api/client";
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

  recordSettlement(input: SettlementInput) {
    return apiFetch<SettlementResult>("/udhaar/settlements", {
      method: "POST",
      body: JSON.stringify(input),
    });
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
