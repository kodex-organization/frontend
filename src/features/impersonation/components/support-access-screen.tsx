"use client";

import { Ban, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { FormField, Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, toDateTimeInput } from "@/features/platform-admin/format";
import {
  getAssignedBranches,
  type AssignedBranch,
} from "@/features/tenancy/branch-switching";
import type { ImpersonationScope } from "@/lib/platform-admin/impersonation-session";
import {
  getConsentState,
  grantTenantConsent,
  listTenantConsents,
  revokeTenantConsent,
  type TenantImpersonationConsent,
} from "../tenant-consents";

const scopes: Array<{ value: ImpersonationScope; label: string }> = [
  { value: "tenant_read", label: "Tenant diagnostics" },
  { value: "branch_read", label: "Branch diagnostics" },
  { value: "branch_switch", label: "Switch support branch" },
];

function defaultExpiry() {
  return toDateTimeInput(new Date(Date.now() + 60 * 60_000).toISOString());
}

export function SupportAccessScreen() {
  const [consents, setConsents] = useState<TenantImpersonationConsent[]>([]);
  const [branches, setBranches] = useState<AssignedBranch[]>([]);
  const [allowedScopes, setAllowedScopes] = useState<ImpersonationScope[]>([
    "tenant_read",
    "branch_read",
  ]);
  const [restrictBranches, setRestrictBranches] = useState(false);
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TenantImpersonationConsent | null>(null);
  const [revokeReason, setRevokeReason] = useState("Support access is no longer required");
  const [feedbackModal, setFeedbackModal] = useState<{ type: "success" | "warning" | "error"; title: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [consentItems, assignedBranches] = await Promise.all([
        listTenantConsents(),
        getAssignedBranches(),
      ]);
      setConsents(consentItems);
      setBranches(assignedBranches);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not load support access settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleScope = (scope: ImpersonationScope) => {
    setAllowedScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  };

  const toggleBranch = (branchId: string) => {
    setAllowedBranchIds((current) =>
      current.includes(branchId)
        ? current.filter((item) => item !== branchId)
        : [...current, branchId],
    );
  };

  const grantConsent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (allowedScopes.length === 0) {
      setError("Select at least one support scope.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Explain the support need in at least 10 characters.");
      return;
    }
    if (!expiresAt || new Date(expiresAt) <= new Date()) {
      setError("Consent expiry must be in the future.");
      return;
    }
    if (restrictBranches && allowedBranchIds.length === 0) {
      setError("Select at least one branch or allow all tenant branches.");
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await grantTenantConsent({
        allowedScopes,
        allowedBranchIds: restrictBranches ? allowedBranchIds : [],
        reason: reason.trim(),
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setReason("");
      setExpiresAt(defaultExpiry());
      setFeedback("Support consent granted. Access remains limited by its scope and expiry.");
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not grant support consent.",
      );
    } finally {
      setSaving(false);
    }
  };

  const revokeConsent = (consent: TenantImpersonationConsent) => {
    setRevokeTarget(consent);
    setRevokeReason("Support access is no longer required");
  };

  const confirmRevokeConsent = async () => {
    if (!revokeTarget) return;
    const reason = revokeReason.trim();
    if (reason.length < 3) {
      setError("Enter a reason at least 3 characters long.");
      return;
    }
    setError(null);
    setFeedback(null);
    setRevokeTarget(null);
    try {
      const result = await revokeTenantConsent(revokeTarget.id, reason);
      const message =
        result.endedSessionCount > 0
          ? `Consent revoked and ${result.endedSessionCount} active support session ended.`
          : "Consent revoked.";
      setFeedback(message);
      setFeedbackModal({
        type: "success",
        title: "Consent revoked",
        message,
      });
      await load();
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : "Could not revoke support consent.";
      setError(message);
      setFeedbackModal({
        type: "error",
        title: "Revocation failed",
        message,
      });
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-brand-700">Tenant consent</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Support access</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Explicitly control what platform support may inspect, which branches it may use, and when access expires.
        </p>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <section className="grid gap-8 border-t border-slate-200 pt-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={grantConsent} className="space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-700" />
            <h2 className="text-lg font-semibold text-slate-900">Grant consent</h2>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Allowed scope</legend>
            <div className="mt-2 space-y-2">
              {scopes.map((scope) => (
                <label key={scope.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allowedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  {scope.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={restrictBranches}
              onChange={(event) => setRestrictBranches(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Restrict access to selected assigned branches
          </label>
          {restrictBranches ? (
            <fieldset className="max-h-48 overflow-y-auto border-y border-slate-200 py-3">
              <legend className="sr-only">Allowed branches</legend>
              <div className="space-y-2">
                {branches.map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={allowedBranchIds.includes(branch.id)}
                      onChange={() => toggleBranch(branch.id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <FormField label="Support reason" htmlFor="support-consent-reason">
            <textarea
              id="support-consent-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
              placeholder="Describe the issue support is allowed to diagnose"
            />
          </FormField>
          <FormField label="Consent expires" htmlFor="support-consent-expiry">
            <Input
              id="support-consent-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </FormField>
          <Button type="submit" isLoading={saving} className="w-full">
            <CheckCircle2 className="h-4 w-4" /> Grant support consent
          </Button>
        </form>

        <div className="border-l border-slate-200 pl-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Consent history</h2>
              <p className="mt-1 text-sm text-slate-500">Active, expired, and revoked records.</p>
            </div>
            <Button type="button" variant="outline" size="icon" title="Refresh consent history" aria-label="Refresh consent history" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="py-8 text-sm text-slate-500">Loading consent history...</p>
            ) : consents.length === 0 ? (
              <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">No support consent has been granted.</div>
            ) : (
              consents.map((consent) => {
                const state = getConsentState(consent);
                return (
                  <article key={consent.id} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${state === "active" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                            {state}
                          </span>
                          <span className="text-xs text-slate-500">{consent.allowedScopes.join(", ")}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{consent.reason}</p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" /> Expires {formatDateTime(consent.expiresAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {consent.allowedBranchIds.length > 0
                            ? `${consent.allowedBranchIds.length} restricted branches`
                            : "All active tenant branches"}
                        </p>
                      </div>
                      {state === "active" ? (
                        <Button type="button" variant="ghost" size="icon" title="Revoke consent" aria-label="Revoke consent" onClick={() => void revokeConsent(consent)}>
                          <Ban className="h-4 w-4 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      <ConfirmModal
        isOpen={Boolean(revokeTarget)}
        title="Revoke support consent"
        description="Explain why support access should be revoked."
        confirmText="Revoke consent"
        cancelText="Keep access"
        variant="danger"
        onConfirm={() => void confirmRevokeConsent()}
        onCancel={() => {
          setRevokeTarget(null);
          setRevokeReason("Support access is no longer required");
        }}
      >
        <label className="block text-sm font-medium text-slate-700">
          Revoke reason
          <textarea
            value={revokeReason}
            onChange={(event) => setRevokeReason(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
      </ConfirmModal>

      {feedbackModal ? (
        <FeedbackModal
          isOpen={Boolean(feedbackModal)}
          type={feedbackModal.type}
          title={feedbackModal.title}
          message={feedbackModal.message}
          onClose={() => setFeedbackModal(null)}
        />
      ) : null}
    </div>
  );
}
