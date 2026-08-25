"use client";

import { AlertTriangle, CornerDownRight, LogOut } from "lucide-react";
import React from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { usePlatformAdminAuth } from "@/lib/platform-admin/auth-context";
import { useImpersonation } from "@/lib/platform-admin/impersonation-context";
import { formatDateTime } from "../format";

export function ImpersonationBannerSummary({
  active,
  adminName,
}: {
  active: NonNullable<ReturnType<typeof useImpersonation>["active"]>;
  adminName: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold uppercase">Impersonation active</p>
      <p className="mt-1 text-sm">
        <strong>{active.session.tenantNameSnapshot}</strong> | Branch {active.session.branchNameSnapshot}
      </p>
      <p className="mt-1 text-xs text-red-800">
        Admin {adminName} | Reason: {active.session.reason}
      </p>
      <p className="mt-1 text-xs text-red-800">
        Scope: {active.session.allowedScopes.join(", ")} | Expires {formatDateTime(active.session.expiresAt)}
      </p>
    </div>
  );
}

export function ImpersonationBanner() {
  const { admin } = usePlatformAdminAuth();
  const { active, end, switchBranch } = useImpersonation();
  const [branchId, setBranchId] = useState("");
  const [switching, setSwitching] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchOptions = useMemo(
    () => active?.allowedBranchIds ?? [],
    [active?.allowedBranchIds],
  );

  if (!active) return null;
  const canSwitch = active.session.allowedScopes.includes("branch_switch");

  const handleEnd = async () => {
    const reason = window.prompt(
      "Reason for ending this support session",
      "Support diagnostics completed",
    );
    if (!reason || reason.trim().length < 3) return;
    setEnding(true);
    setError(null);
    try {
      await end(reason.trim());
    } catch (requestError) {
      window.alert(
        requestError instanceof ApiError
          ? `${requestError.message} Normal PlatformAdmin access has been restored.`
          : "The remote session could not be ended, but normal PlatformAdmin access has been restored.",
      );
    } finally {
      setEnding(false);
    }
  };

  const handleSwitch = async () => {
    const target = branchId.trim();
    if (!target || target === active.session.branchId) return;
    setSwitching(true);
    setError(null);
    try {
      await switchBranch(target, "Platform support branch switch", target);
      setBranchId("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not switch the impersonated branch.",
      );
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="border-b-4 border-red-700 bg-red-50 px-6 py-4 text-red-950" role="status">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-700 text-white">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <ImpersonationBannerSummary
            active={active}
            adminName={admin?.fullName ?? active.session.platformAdminEmailSnapshot}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {canSwitch ? (
            <>
              <label className="text-xs font-medium text-red-900">
                Switch branch
                {branchOptions.length > 0 ? (
                  <Select
                    aria-label="Impersonation target branch"
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    className="mt-1 w-64 border-red-300"
                  >
                    <option value="">Select allowed branch</option>
                    {branchOptions.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    aria-label="Impersonation target branch"
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    placeholder="Active branch UUID"
                    className="mt-1 w-64 border-red-300"
                  />
                )}
              </label>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Switch impersonated branch"
                aria-label="Switch impersonated branch"
                isLoading={switching}
                onClick={() => void handleSwitch()}
              >
                <CornerDownRight className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            className="bg-red-700 hover:bg-red-800 focus-visible:ring-red-700"
            isLoading={ending}
            onClick={() => void handleEnd()}
          >
            <LogOut className="h-4 w-4" /> End impersonation
          </Button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs font-medium text-red-800">{error}</p> : null}
    </div>
  );
}
