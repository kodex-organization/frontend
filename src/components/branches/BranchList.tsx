"use client";

import React, { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { BranchItem } from "../../types/branch";

interface BranchListProps {
  branches: BranchItem[];
  isLoading: boolean;
  onEditBranch: (branch: BranchItem) => void;
  onEditConfig: (branch: BranchItem) => void;
  onDeleteBranch: (branchId: string) => void;
}

export function BranchList({
  branches,
  isLoading,
  onEditBranch,
  onEditConfig,
  onDeleteBranch,
}: BranchListProps) {
  const [pendingDelete, setPendingDelete] = useState<BranchItem | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 bg-white border border-slate-200 rounded-2xl animate-pulse h-64 shadow-xs"
          />
        ))}
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          No branches found
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Create your first venue branch to start configuring tables, shifts, and staff.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {branches.map((branch) => (
        <div
          key={branch.id}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                  {branch.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {branch.address}
                </p>
              </div>

              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 border ${
                  branch.isActive
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {branch.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>

            {/* Operational Pills */}
            <div className="grid grid-cols-2 gap-2 my-4 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Operating Hours
                </span>
                <span className="font-semibold text-slate-800">
                  {branch.operatingHoursStart || "10:00"} - {branch.operatingHoursEnd || "02:00"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Peak Multiplier
                </span>
                <span className="font-semibold text-slate-800">
                  {Number(branch.peakHourMultiplier ?? 1.0).toFixed(2)}x Rate
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Standard Tax / GST
                </span>
                <span className="font-semibold text-slate-800">
                  {branch.standardTaxPercent ?? 16}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Max Credit Cap
                </span>
                <span className="font-semibold text-slate-800">
                  {branch.currency || "PKR"} {Number(branch.maxUdhaarPerCustomer ?? 5000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Counts */}
            {branch._count && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 pb-3 border-b border-slate-100 font-medium">
                <span>{branch._count.tablesCatalog ?? 0} Tables</span>
                <span>•</span>
                <span>{branch._count.users ?? 0} Staff</span>
                <span>•</span>
                <span>{branch._count.sessions ?? 0} Sessions</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-4 mt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditBranch(branch)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
              >
                Edit Profile
              </button>

              <button
                onClick={() => onEditConfig(branch)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
              >
                Configure Rules
              </button>
            </div>

            <button
              onClick={() => setPendingDelete(branch)}
              className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
              title="Delete / Deactivate Branch"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>

    <ConfirmModal
      isOpen={Boolean(pendingDelete)}
      title="Delete branch"
      description={pendingDelete ? `This will remove ${pendingDelete.name} and any associated branch configuration. This action cannot be undone.` : ""}
      confirmText="Delete branch"
      cancelText="Keep branch"
      variant="danger"
      onConfirm={() => {
        if (pendingDelete) {
          onDeleteBranch(pendingDelete.id);
        }
        setPendingDelete(null);
      }}
      onCancel={() => setPendingDelete(null)}
    />
  </>
  );
}