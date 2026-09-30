"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { tokenStorage } from "@/lib/auth/session";
import { useNotifications } from "@/features/notifications/context";
import { reScopeOfflineData } from "@/lib/sync/offline-db";
import { toast } from "@/lib/toast";
import {
  ASSIGNED_BRANCHES_CHANGED_EVENT,
  completeBranchSwitch,
  getAssignedBranches,
  type AssignedBranch,
} from "../branch-switching";
import { BranchSelector } from "./branch-selector";
import { RequestBranchAccessModal } from "./request-branch-access-modal";
import { ManageBranchAccessModal } from "./manage-branch-access-modal";

export function GlobalBranchSelector({
  onSwitching,
}: {
  onSwitching: (value: boolean) => void;
}) {
  const { user, replaceSession } = useAuth();
  const { resetForBranch } = useNotifications();
  const router = useRouter();
  const [branches, setBranches] = useState<AssignedBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const loadVersion = useRef(0);
  const switchedVersion = useRef<string | null>(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const assigned = await getAssignedBranches();
      if (version !== loadVersion.current) return;
      setBranches(assigned);
      setError(null);
    } catch {
      if (version === loadVersion.current)
        setError("Could not load branches. Retry");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, load);
    return () => {
      ++loadVersion.current;
      window.removeEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, load);
    };
  }, [load, user?.id, user?.branchId]);

  const switchTo = async (branchId: string) => {
    if (!user || inFlight.current || branchId === user.branchId) return;
    if (!branches.some((branch) => branch.id === branchId)) return;
    inFlight.current = true;
    setSwitching(true);
    onSwitching(true);
    try {
      const result = await completeBranchSwitch(user, branchId, {
        replaceSession: (nextUser, tokens) => {
          replaceSession(nextUser, tokens);
          switchedVersion.current = tokenStorage.getSessionVersion();
        },
        reScopeOfflineData,
        refreshBranchState: resetForBranch,
        navigate: (path) => router.replace(path),
      });
      if (tokenStorage.getSessionVersion() !== switchedVersion.current) return;
      router.refresh();
      if (result.maintenanceErrors.length)
        toast.warning(
          "Branch changed. Some local data could not be refreshed."
        );
      else toast.success("Active branch changed across the application.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Could not switch branch. Your active branch is unchanged."
      );
    } finally {
      inFlight.current = false;
      setSwitching(false);
      onSwitching(false);
    }
  };

  const isOwner = Boolean(user?.roles.includes("OWNER"));
  const isManager = Boolean(
    user?.roles.includes("MANAGER") && !user?.roles.includes("OWNER")
  );

  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [showManageAccess, setShowManageAccess] = useState(false);

  return (
    <div className="w-48 min-w-0 max-w-full sm:w-56">
      {loading && branches.length === 0 ? (
        <span
          role="status"
          className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-500"
        >
          Loading branches...
        </span>
      ) : (
        <BranchSelector
          branches={branches}
          activeBranchId={user?.branchId ?? ""}
          switching={switching || loading}
          onSwitch={switchTo}
          showSingle
        />
      )}

      {error ? (
        <button
          type="button"
          onClick={() => void load()}
          className="mt-1 block text-left text-xs text-rose-700 hover:underline"
        >
          {error}
        </button>
      ) : null}

      {/* Manager Option: Request Access */}
      {isManager && (
        <button
          type="button"
          onClick={() => setShowRequestAccess(true)}
          className="mt-1 block text-left text-[11px] font-medium text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
        >
          + Request branch access
        </button>
      )}

      {/* Owner Option: Review Requests & Revoke Access */}
      {isOwner && (
        <button
          type="button"
          onClick={() => setShowManageAccess(true)}
          className="mt-1 block text-left text-[11px] font-medium text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
        >
          + Manage branch access
        </button>
      )}

      {/* Modals */}
      {isManager && (
        <RequestBranchAccessModal
          isOpen={showRequestAccess}
          onClose={() => setShowRequestAccess(false)}
        />
      )}

      {isOwner && (
        <ManageBranchAccessModal
          isOpen={showManageAccess}
          onClose={() => setShowManageAccess(false)}
        />
      )}
    </div>
  );
}