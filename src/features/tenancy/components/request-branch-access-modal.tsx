"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Building2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiError } from "@/lib/api/client";
import { fetchBranches } from "@/lib/api/branch";
import { getAssignedBranches } from "../branch-switching";
import { useAuth } from "@/lib/auth/auth-context";
import type { BranchItem } from "@/types/branch";
import { toast } from "@/lib/toast";

interface RequestBranchAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestBranchAccessModal({
  isOpen,
  onClose,
  onSuccess,
}: RequestBranchAccessModalProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadBranches = useCallback(async () => {
    setLoadingBranches(true);
    setError(null);
    try {
      const [branchRes, assignedList] = await Promise.all([
        fetchBranches({ limit: 100 }),
        getAssignedBranches().catch(() => []),
      ]);

      const allBranches: BranchItem[] = Array.isArray(branchRes)
        ? branchRes
        : Array.isArray((branchRes as any)?.branches)
        ? (branchRes as any).branches
        : Array.isArray((branchRes as any)?.data?.branches)
        ? (branchRes as any).data.branches
        : Array.isArray((branchRes as any)?.data)
        ? (branchRes as any).data
        : [];

      const assignedIds = new Set(
        (Array.isArray(assignedList) ? assignedList : []).map((b) => b.id)
      );
      if (user?.branchId) assignedIds.add(user.branchId);

      const otherBranches = allBranches.filter(
        (b) => b && b.id && !assignedIds.has(b.id)
      );

      setBranches(otherBranches);
      if (otherBranches[0]) {
        setTargetBranchId(otherBranches[0].id);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to load branches."
      );
    } finally {
      setLoadingBranches(false);
    }
  }, [user?.branchId]);

  useEffect(() => {
    if (isOpen) {
      void loadBranches();
    }
  }, [isOpen, loadBranches]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId) {
      setError("Please select a branch.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch("/branch-access/requests", {
        method: "POST",
        body: JSON.stringify({ branchId: targetBranchId, reason }),
      });
      toast.success("Branch access request submitted for Owner approval.");
      setReason("");
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to submit branch access request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Request Branch Access
              </h3>
              <p className="text-[11px] text-slate-500">
                Cross-branch access requires owner approval.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="space-y-2">
              <Alert variant="error">{error}</Alert>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadBranches()}
                className="w-full text-xs"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry loading branches
              </Button>
            </div>
          )}

          {loadingBranches ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-6 text-xs text-slate-500 border border-slate-200">
              <RefreshCw className="h-4 w-4 animate-spin text-brand-600" />
              <span>Loading available branches in your organization...</span>
            </div>
          ) : branches.length === 0 ? (
            !error && (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 border border-slate-200">
                No other branches available in this organization.
              </div>
            )
          ) : (
            <>
              <FormField
                label="Select target branch"
                htmlFor="targetBranchId"
              >
                <Select
                  id="targetBranchId"
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name ?? "Unnamed branch"}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div>
                <label
                  htmlFor="branchAccessReason"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Reason / justification for access
                </label>
                <textarea
                  id="branchAccessReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Covering evening shift for manager on leave"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                >
                  Submit Request
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}