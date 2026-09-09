"use client";

import { Building2, LoaderCircle } from "lucide-react";
import React from "react";
import type { AssignedBranch } from "../branch-switching";

interface BranchSelectorProps {
  branches: AssignedBranch[];
  activeBranchId: string;
  switching: boolean;
  onSwitch: (branchId: string) => void;
  showSingle?: boolean;
}

export function BranchSelector({
  branches,
  activeBranchId,
  switching,
  onSwitch,
  showSingle = false,
}: BranchSelectorProps) {
  if (branches.length <= 1 && !showSingle) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 text-slate-700">
      {switching ? (
        <LoaderCircle
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin text-brand-600"
        />
      ) : (
        <Building2
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-brand-600"
        />
      )}
      <label htmlFor="active-branch" className="sr-only">
        Active branch
      </label>
      <select
        id="active-branch"
        aria-label="Active branch"
        value={activeBranchId}
        disabled={switching || branches.length === 0}
        onChange={(event) => onSwitch(event.target.value)}
        className="h-9 w-full max-w-64 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-wait disabled:bg-slate-50"
      >
        {!branches.some((branch) => branch.id === activeBranchId) && <option value={activeBranchId}>Select an active branch</option>}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name ?? `Branch ${branch.id.slice(0, 8)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
