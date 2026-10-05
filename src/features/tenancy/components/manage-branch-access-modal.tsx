"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { apiFetch, ApiError } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import { X, Check, Ban, AlertCircle, RefreshCw } from "lucide-react";

interface BranchAccessRecord {
  id: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  createdAt: string;
  decidedAt: string | null;
  branch: {
    id: string;
    name: string | null;
  };
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageBranchAccessModal({ isOpen, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [requests, setRequests] = useState<BranchAccessRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>("/branch-access/requests?status=all");
      // Safely unpack whether apiFetch returned raw array or { success, data }
      const records: BranchAccessRecord[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setRequests(records);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load branch access requests"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchRequests();
    }
  }, [isOpen, fetchRequests]);

  const handleDecide = async (id: string, status: "approved" | "rejected") => {
    setActingId(id);
    try {
      await apiFetch(`/branch-access/requests/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(`Request ${status} successfully`);
      void fetchRequests();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : `Failed to ${status} request`
      );
    } finally {
      setActingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this manager's access? They will lose access to this branch immediately."
      )
    ) {
      return;
    }
    setActingId(id);
    try {
      await apiFetch(`/branch-access/requests/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Revoked by Owner" }),
      });
      toast.success("Branch access revoked");
      void fetchRequests();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to revoke access"
      );
    } finally {
      setActingId(null);
    }
  };

  if (!isOpen || !mounted) return null;

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedGrants = requests.filter((r) => r.status === "approved");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Manage Branch Access
            </h2>
            <p className="text-xs text-slate-500">
              Review requests and revoke temporary access for managers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Section 1: Pending Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pending Requests ({pendingRequests.length})
              </h3>
              <button
                type="button"
                onClick={() => void fetchRequests()}
                disabled={loading}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {loading && requests.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading requests...</p>
            ) : pendingRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-400">No pending requests right now.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900">
                          {req.user?.fullName || req.user?.email || "Manager"}
                        </span>
                        <span className="text-[10px] text-slate-400">→</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {req.branch?.name || "Target Branch"}
                        </span>
                      </div>
                      {req.reason && (
                        <p className="mt-1 text-xs text-slate-600 italic">
                          &ldquo;{req.reason}&rdquo;
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        Requested: {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={actingId === req.id}
                        onClick={() => handleDecide(req.id, "approved")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingId === req.id}
                        onClick={() => handleDecide(req.id, "rejected")}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        <Ban size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Active Temporary Access (Revocable) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Active Temporary Access ({approvedGrants.length})
            </h3>

            {approvedGrants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-400">No managers have active secondary access.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {approvedGrants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900">
                          {grant.user?.fullName || grant.user?.email || "Manager"}
                        </span>
                        <span className="text-[10px] text-slate-400">has access to</span>
                        <span className="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {grant.branch?.name || "Branch"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Granted: {grant.decidedAt ? new Date(grant.decidedAt).toLocaleDateString() : "Active"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={actingId === grant.id}
                      onClick={() => handleRevoke(grant.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <AlertCircle size={14} /> Revoke Access
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}