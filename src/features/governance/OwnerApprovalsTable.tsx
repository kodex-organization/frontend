"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Clock,
  User,
  Building2,
  ShieldAlert,
  RefreshCw,
  Mail,
  Phone,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiError } from "@/lib/api/client";
import { toast } from "@/lib/toast";

export interface OwnerApprovalItem {
  id: string;
  requestType: "staff_creation" | "branch_access";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  branchId: string | null;
  branchName: string | null;
  requestedById: string | null;
  requestedByName: string;
  requestedByEmail: string | null;
  payload: any;
}

export function OwnerApprovalsTable() {
  const [mounted, setMounted] = useState(false);
  const [approvals, setApprovals] = useState<OwnerApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"staff_creation" | "branch_access">(
    "branch_access"
  );
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<OwnerApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load staff creation requests (from legacy governance endpoint)
      let staffItems: OwnerApprovalItem[] = [];
      try {
        const staffData = await apiFetch<any>("/governance/owner-approvals");
        const list = Array.isArray(staffData)
          ? staffData
          : Array.isArray(staffData?.data)
          ? staffData.data
          : [];
        staffItems = list.filter((i: any) => i.requestType === "staff_creation");
      } catch {
        staffItems = [];
      }

      // 2. Load branch access requests from our new branch-access API
      let branchItems: OwnerApprovalItem[] = [];
      try {
        const branchRes = await apiFetch<any>("/branch-access/requests?status=pending");
        const list = Array.isArray(branchRes)
          ? branchRes
          : Array.isArray(branchRes?.data)
          ? branchRes.data
          : [];

        branchItems = list
          .filter((r: any) => r.status === "pending")
          .map((r: any) => ({
            id: r.id,
            requestType: "branch_access" as const,
            status: r.status,
            createdAt: r.createdAt,
            branchId: r.branch?.id || null,
            branchName: r.branch?.name || null,
            requestedById: r.user?.id || null,
            requestedByName: r.user?.fullName || r.user?.email || "Manager",
            requestedByEmail: r.user?.email || null,
            payload: {
              userReason: r.reason,
              targetBranchId: r.branch?.id,
            },
          }));
      } catch (err) {
        console.error("Failed to load branch access requests", err);
      }

      setApprovals([...staffItems, ...branchItems]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load pending owner approval requests."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const handleReview = async (
    id: string,
    requestType: "staff_creation" | "branch_access",
    status: "approved" | "rejected",
    reviewReason?: string
  ) => {
    setProcessingId(id);
    try {
      if (requestType === "branch_access") {
        // Points to our new branch-access decision endpoint
        await apiFetch(`/branch-access/requests/${id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason: reviewReason }),
        });
      } else {
        // Staff creation approval
        await apiFetch(`/governance/owner-approvals/${id}/review`, {
          method: "POST",
          body: JSON.stringify({ status, reviewReason }),
        });
      }

      toast.success(
        status === "approved"
          ? "Branch access granted successfully!"
          : "Request rejected."
      );
      setRejectingItem(null);
      setRejectReason("");
      await loadApprovals();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${status} request.`);
    } finally {
      setProcessingId(null);
    }
  };

  const staffCreationRequests = approvals.filter(
    (item) => item.requestType === "staff_creation"
  );
  const branchAccessRequests = approvals.filter(
    (item) => item.requestType === "branch_access"
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/75 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Owner Approvals
            </h2>
            {approvals.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {approvals.length} pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and authorise cross-branch staff creations and manager branch access requests.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadApprovals()}
          isLoading={loading}
          className="self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6 bg-white">
        <button
          type="button"
          onClick={() => setActiveTab("staff_creation")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "staff_creation"
              ? "border-brand-600 text-brand-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <span>Staff Creation Requests</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              activeTab === "staff_creation"
                ? "bg-brand-100 text-brand-800 font-bold"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {staffCreationRequests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("branch_access")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "branch_access"
              ? "border-brand-600 text-brand-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <span>Branch Access Requests</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              activeTab === "branch_access"
                ? "bg-brand-100 text-brand-800 font-bold"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {branchAccessRequests.length}
          </span>
        </button>
      </div>

      {error && (
        <div className="p-6">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {/* Tab Content: Staff Creation Requests */}
      {activeTab === "staff_creation" && (
        <div>
          {staffCreationRequests.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-70" />
              <p className="text-sm font-medium text-slate-800">
                No pending staff creation requests
              </p>
              <p className="text-xs text-slate-500 mt-1">
                When managers create staff for other branches, their requests will appear here for your review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {staffCreationRequests.map((item) => {
                const p = item.payload || {};
                const isProcessing = processingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          {p.fullName ?? "Candidate"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Role: {p.role ?? "CASHIER"}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Pending Approval
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </div>
                        {p.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{p.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            Target Branch: <strong className="text-slate-800">{item.branchName ?? p.targetBranchId}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            Requested by: <strong className="text-slate-800">{item.requestedByName}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          Requested on {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={isProcessing}
                        disabled={isProcessing}
                        onClick={() => handleReview(item.id, "staff_creation", "approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Approve & Create
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => setRejectingItem(item)}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 cursor-pointer"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Branch Access Requests */}
      {activeTab === "branch_access" && (
        <div>
          {branchAccessRequests.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-70" />
              <p className="text-sm font-medium text-slate-800">
                No pending branch access requests
              </p>
              <p className="text-xs text-slate-500 mt-1">
                When managers request permission to access another branch, their requests will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {branchAccessRequests.map((item) => {
                const p = item.payload || {};
                const isProcessing = processingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          {item.requestedByName}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                          Branch Access Request
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            Target Branch: <strong className="text-slate-800">{item.branchName ?? p.targetBranchId}</strong>
                          </span>
                        </div>
                        {p.userReason && (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700 italic">
                            &ldquo;{p.userReason}&rdquo;
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          Requested on {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={isProcessing}
                        disabled={isProcessing}
                        onClick={() => handleReview(item.id, "branch_access", "approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Grant Access
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => setRejectingItem(item)}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 cursor-pointer"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal using Portal */}
      {rejectingItem && mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center gap-2 text-rose-700 font-semibold mb-2">
                <AlertCircle className="h-5 w-5" />
                <span>Reject Request</span>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Are you sure you want to reject this request for{" "}
                <strong>
                  {rejectingItem.requestType === "staff_creation"
                    ? rejectingItem.payload?.fullName || "staff member"
                    : rejectingItem.requestedByName}
                </strong>
                ?
              </p>

              <label
                htmlFor="rejectReason"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Reason for rejection (optional):
              </label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Access not required at this time"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 mb-4"
                rows={3}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRejectingItem(null);
                    setRejectReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() =>
                    handleReview(
                      rejectingItem.id,
                      rejectingItem.requestType,
                      "rejected",
                      rejectReason
                    )
                  }
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}