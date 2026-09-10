"use client";

import { Building2, ChevronDown, LoaderCircle } from "lucide-react";
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
    <div className="relative flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
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
      <div className="min-w-0 flex-1">
      <label htmlFor="active-branch" className="block text-[10px] font-semibold uppercase leading-3 tracking-wide text-slate-500">
        Active branch
      </label>
      <select
        id="active-branch"
        aria-label="Active branch"
        value={activeBranchId}
        disabled={switching || branches.length === 0}
        onChange={(event) => onSwitch(event.target.value)}
        className="block h-5 w-full cursor-pointer appearance-none truncate border-0 bg-transparent py-0 pl-0 pr-5 text-sm font-medium leading-5 text-slate-800 outline-none disabled:cursor-wait disabled:text-slate-500"
      >
        {!branches.some((branch) => branch.id === activeBranchId) && <option value={activeBranchId}>Select an active branch</option>}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name ?? `Branch ${branch.id.slice(0, 8)}`}
          </option>
        ))}
      </select>
      </div>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
