"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  ASSIGNED_BRANCHES_CHANGED_EVENT,
  getAssignedBranches,
} from "./branch-switching";
import {
  cacheBranchCurrency,
  getCachedBranchCurrency,
} from "./branch-currency-cache";

export function useBranchCurrency() {
  const { user } = useAuth();
  const branchId = user?.branchId;
  const [currencies, setCurrencies] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!branchId) return;

    let isCurrent = true;
    const loadCurrency = async () => {
      try {
        const branches = await getAssignedBranches();
        const branch = branches.find((item) => item.id === branchId);
        if (!branch) {
          throw new Error(`Active branch ${branchId} was not returned by the assigned-branches API.`);
        }
        if (isCurrent) {
          const currency = branch.currency || "PKR";
          cacheBranchCurrency(branchId, currency);
          setCurrencies((current) => ({
            ...current,
            [branchId]: currency,
          }));
        }
      } catch (error) {
        console.error("Failed to load the active branch currency:", error);
      }
    };

    void loadCurrency();
    window.addEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, loadCurrency);
    return () => {
      isCurrent = false;
      window.removeEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, loadCurrency);
    };
  }, [branchId]);

  return branchId
    ? currencies[branchId] || getCachedBranchCurrency(branchId)
    : "PKR";
}
