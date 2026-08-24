"use client";

import { Building2, LoaderCircle, MapPin, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { useNotifications } from "@/features/notifications/context";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { reScopeOfflineData } from "@/lib/sync/offline-db";
import {
  ActiveBranchFallbackRequiredError,
  deleteBranch,
  deleteManagedBranch,
  getBranchDeleteBlockers,
  type BranchDeleteBlockers,
} from "../branch-management";
import {
  completeBranchSwitch,
  getAssignedBranches,
  notifyAssignedBranchesChanged,
  type AssignedBranch,
} from "../branch-switching";
import { BranchDeleteBlockedAlert } from "./branch-delete-blocked-alert";

interface BlockedDeleteState {
  branchId: string;
  branchName: string;
  currency: string | null;
  blockers: BranchDeleteBlockers;
}

export function BranchManagementScreen() {
  const router = useRouter();
  const { user, replaceSession } = useAuth();
  const { resetForBranch } = useNotifications();
  const [branches, setBranches] = useState<AssignedBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<BlockedDeleteState | null>(
    null,
  );

  const loadBranches = useCallback(async (notifyShell = false) => {
    setLoading(true);
    try {
      const assigned = await getAssignedBranches();
      setBranches(assigned);
      setLoadError(null);
      if (notifyShell) notifyAssignedBranchesChanged();
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Could not load branches.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const handleDelete = useCallback(
    async (branch: AssignedBranch) => {
      if (!user || deletingBranchId) return;

      const branchName = branch.name ?? `Branch ${branch.id.slice(0, 8)}`;
      if (
        !window.confirm(
          `Delete ${branchName}? Historical records will be retained.`,
        )
      ) {
        return;
      }

      setDeletingBranchId(branch.id);
      setBlockedDelete(null);
      try {
        const result = await deleteManagedBranch(
          branch,
          branches,
          user.branchId,
          {
            deleteBranch,
            switchBranch: async (branchId) => {
              const completion = await completeBranchSwitch(user, branchId, {
                replaceSession,
                reScopeOfflineData,
                refreshBranchState: resetForBranch,
                navigate: (path) => router.replace(path),
              });
              router.refresh();
              if (completion.maintenanceErrors.length > 0) {
                toast.warning(
                  "Branch changed, but some local data could not be refreshed.",
                );
              }
            },
            refreshBranches: () => loadBranches(true),
          },
        );

        toast.success(`${branchName} was deleted.`);
        if (result.fallbackBranch) {
          toast.info(
            `Active branch changed to ${
              result.fallbackBranch.name ?? "another assigned branch"
            }.`,
          );
        }
      } catch (error) {
        const blockers = getBranchDeleteBlockers(error);
        if (blockers) {
          setBlockedDelete({
            branchId: branch.id,
            branchName,
            currency: branch.currency,
            blockers,
          });
        } else if (error instanceof ActiveBranchFallbackRequiredError) {
          toast.error(error.message);
        } else {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not delete the branch.",
          );
        }
      } finally {
        setDeletingBranchId(null);
      }
    },
    [
      branches,
      deletingBranchId,
      loadBranches,
      replaceSession,
      resetForBranch,
      router,
      user,
    ],
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Branches</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage branches assigned to your account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBranches()}
          disabled={loading}
          title="Refresh branches"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {blockedDelete ? (
        <div className="mt-6">
          <BranchDeleteBlockedAlert
            branchName={blockedDelete.branchName}
            blockers={blockedDelete.blockers}
            currency={blockedDelete.currency}
          />
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-6 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void loadBranches()}
            className="mt-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white">
        {loading && branches.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            Loading branches
          </div>
        ) : branches.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
            <Building2 aria-hidden="true" className="h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              No assigned branches found
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {branches.map((branch) => {
              const isActive = branch.id === user?.branchId;
              const needsFallback = isActive && branches.length === 1;
              return (
                <li
                  key={branch.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {branch.name ?? `Branch ${branch.id.slice(0, 8)}`}
                      </p>
                      {isActive ? (
                        <span className="rounded px-2 py-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-200">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {branch.address ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                          {branch.address}
                        </span>
                      ) : null}
                      <span>{branch.timezone ?? "Timezone not set"}</span>
                      <span>{branch.roles.join(", ")}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(branch)}
                    disabled={deletingBranchId !== null || needsFallback}
                    title={
                      needsFallback
                        ? "Assign another branch before deleting the active branch"
                        : `Delete ${branch.name ?? "branch"}`
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingBranchId === branch.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    )}
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
