"use client";

import React, { useState, useEffect } from "react";
import { Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiError } from "@/lib/api/client";
import { fetchBranches } from "@/lib/api/branch";
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
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    void fetchBranches({ limit: 100 }).then((res) => {
      // Filter out user's current branch
      const otherBranches = (res.branches || []).filter(
        (b) => b.id !== user?.branchId
      );
      setBranches(otherBranches);
      if (otherBranches[0]) {
        setTargetBranchId(otherBranches[0].id);
      }
    });
  }, [isOpen, user?.branchId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId) {
      setError("Please select a branch.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Points directly to our new branch-access module
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
        err instanceof ApiError ? err.message : "Failed to submit branch access request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Request Branch Access
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            As a manager, accessing or managing another branch requires explicit approval from the Owner.
          </p>

          {error && <Alert variant="error">{error}</Alert>}

          {branches.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 border border-slate-200">
              No other branches available in this organization.
            </div>
          ) : (
            <>
              <FormField label="Select branch you need access to" htmlFor="targetBranchId">
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
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Reason / justification for access:
                </label>
                <textarea
                  id="branchAccessReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Covering evening shift for manager on leave"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
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
    </div>
  );
}