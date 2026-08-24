import { AlertTriangle } from "lucide-react";
import React from "react";

import type { BranchDeleteBlockers } from "../branch-management";

interface BranchDeleteBlockedAlertProps {
  branchName: string;
  blockers: BranchDeleteBlockers;
  currency?: string | null;
}

function formatBalance(value: number, currency?: string | null) {
  if (!currency) return value.toLocaleString("en-PK", { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString("en-PK", { maximumFractionDigits: 2 });
  }
}

export function BranchDeleteBlockedAlert({
  branchName,
  blockers,
  currency,
}: BranchDeleteBlockedAlertProps) {
  return (
    <div
      role="alert"
      className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-950"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{branchName} cannot be deleted</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt>Active sessions</dt>
              <dd className="font-semibold">{blockers.activeSessions}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Paused sessions</dt>
              <dd className="font-semibold">{blockers.pausedSessions}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Customers with unsettled udhaar</dt>
              <dd className="font-semibold">
                {blockers.unsettledUdhaarCustomers}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Unsettled balance</dt>
              <dd className="font-semibold">
                {formatBalance(blockers.unsettledUdhaarBalance, currency)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
