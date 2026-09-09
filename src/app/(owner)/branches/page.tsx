"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BranchItem } from "../../../types/branch";
import { deleteBranch, fetchBranches } from "../../../lib/api/branch";
import { BranchList } from "../../../components/branches/BranchList";
import { BranchModal } from "../../../components/branches/BranchModal";
import { BranchConfigModal } from "../../../components/branches/BranchConfigModal";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { toast } from "@/lib/toast";

export default function OwnerBranchesPage() {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type: "success" | "error" | "warning" } | null>(null);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [selectedBranchForEdit, setSelectedBranchForEdit] = useState<BranchItem | null>(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedBranchForConfig, setSelectedBranchForConfig] = useState<BranchItem | null>(null);

  const loadBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchBranches({ limit: 50 });
      setBranches(res.branches || []);
    } catch (err: any) {
      const msg = err.message?.includes("jwt expired")
        ? "Your session has expired. Please log in again."
        : err.message || "Failed to load branches.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleCreateNew = () => {
    setSelectedBranchForEdit(null);
    setIsBranchModalOpen(true);
  };

  const handleEditBranch = (branch: BranchItem) => {
    setSelectedBranchForEdit(branch);
    setIsBranchModalOpen(true);
  };

  const handleBranchSaved = () => {
    loadBranches();
  };

  const handleEditConfig = (branch: BranchItem) => {
    setSelectedBranchForConfig(branch);
    setIsConfigModalOpen(true);
  };

  const handleConfigSaved = () => {
    loadBranches();
  };

  const handleDeleteBranch = async (branchId: string) => {
    try {
      await deleteBranch(branchId);
      await loadBranches();
      setFeedback({ title: "Branch updated", message: "The branch was deleted successfully.", type: "success" });
    } catch (err: any) {
      setFeedback({ title: "Delete failed", message: err.message || "Failed to delete branch.", type: "error" });
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Multi-Tenant Branch Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your club locations, operational hours, tax rules, and pricing multipliers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBranches}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-xs transition-colors hover:bg-slate-50"
            title="Refresh List"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Deploy New Branch
          </button>
        </div>
      </div>

      {/* Error / Session Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          {error.includes("expired") && (
            <button
              onClick={() => (window.location.href = "/login")}
              className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors"
            >
              Log In Again
            </button>
          )}
        </div>
      )}

      {/* Branch Grid */}
      <BranchList
        branches={branches}
        isLoading={isLoading}
        onEditBranch={handleEditBranch}
        onEditConfig={handleEditConfig}
        onDeleteBranch={handleDeleteBranch}
      />

      {/* Modals */}
      <BranchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        branch={selectedBranchForEdit}
        onSaved={handleBranchSaved}
      />

      <BranchConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        branch={selectedBranchForConfig}
        onConfigUpdated={handleConfigSaved}
      />

      <FeedbackModal
        isOpen={Boolean(feedback)}
        type={feedback?.type ?? "success"}
        title={feedback?.title ?? "Update"}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}