"use client";

import { KeyRound, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useImpersonation } from "@/lib/platform-admin/impersonation-context";
import { formatDateTime } from "../format";
import {
  listImpersonationConsents,
  getImpersonatedBranch,
  getImpersonationContext,
  type ImpersonationConsent,
} from "../impersonation";
import { validateTenantId } from "../subscriptions";

export function ImpersonationConsole() {
  const { active, start } = useImpersonation();
  const [tenantFilter, setTenantFilter] = useState("");
  const [consents, setConsents] = useState<ImpersonationConsent[]>([]);
  const [selectedConsentId, setSelectedConsentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    tenant?: { id: string; name: string; status: string; timezone: string };
    branch?: {
      id: string;
      name: string;
      address?: string | null;
      currency: string;
      timezone: string;
      language?: string;
    };
  } | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsRefresh, setDiagnosticsRefresh] = useState(0);

  const selectedConsent = useMemo(
    () => consents.find((consent) => consent.id === selectedConsentId) ?? null,
    [consents, selectedConsentId],
  );

  const loadConsents = useCallback(async (tenantId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listImpersonationConsents(tenantId, true);
      setConsents(result.items);
      setSelectedConsentId((current) =>
        result.items.some(({ id }) => id === current)
          ? current
          : (result.items[0]?.id ?? ""),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not load impersonation consents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConsents();
  }, [loadConsents]);

  useEffect(() => {
    if (!selectedConsent) return;
    setBranchId(selectedConsent.allowedBranchIds[0] ?? "");
  }, [selectedConsent]);

  useEffect(() => {
    if (!active) {
      setDiagnostics(null);
      return;
    }
    let mounted = true;
    const loadDiagnostics = async () => {
      setDiagnosticsLoading(true);
      setError(null);
      try {
        const [context, branch] = await Promise.all([
          active.session.allowedScopes.includes("tenant_read")
            ? getImpersonationContext()
            : Promise.resolve(null),
          active.session.allowedScopes.includes("branch_read")
            ? getImpersonatedBranch()
            : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setDiagnostics({
          tenant: context?.tenant,
          branch: branch ?? context?.branch,
        });
      } catch (requestError) {
        if (!mounted) return;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Could not load the consented diagnostic context.",
        );
      } finally {
        if (mounted) setDiagnosticsLoading(false);
      }
    };
    void loadDiagnostics();
    return () => {
      mounted = false;
    };
  }, [active, diagnosticsRefresh]);

  const applyTenantFilter = () => {
    if (!tenantFilter.trim()) {
      void loadConsents();
      return;
    }
    const parsed = validateTenantId(tenantFilter);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid tenant UUID.");
      return;
    }
    void loadConsents(parsed.data);
  };

  const startSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConsent) {
      setError("Select a valid tenant consent.");
      return;
    }
    if (!validateTenantId(branchId).success) {
      setError("Enter or select a valid branch UUID.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Enter a support reason of at least 5 characters.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await start(
        {
          consentId: selectedConsent.id,
          tenantId: selectedConsent.tenantId,
          branchId: branchId.trim(),
          reason: reason.trim(),
        },
        selectedConsent,
      );
      setReason("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not start impersonation.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-red-700">Audited support access</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Support impersonation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Start a short-lived diagnostic session only within scope explicitly approved by the tenant owner.
        </p>
      </header>

      {active ? (
        <section className="border-t border-slate-200 pt-6">
          <Alert>
            A support session is active for {active.session.tenantNameSnapshot}. Use the persistent banner to switch branches or end impersonation.
          </Alert>
          {error ? <div className="mt-4"><Alert variant="error">{error}</Alert></div> : null}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Consented diagnostic context</h2>
                <p className="mt-1 text-sm text-slate-500">Each read below is recorded as an impersonated audit action.</p>
              </div>
              <Button type="button" variant="outline" size="icon" title="Refresh diagnostics" aria-label="Refresh diagnostics" disabled={diagnosticsLoading} onClick={() => setDiagnosticsRefresh((current) => current + 1)}>
                <RefreshCw className={`h-4 w-4 ${diagnosticsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {diagnosticsLoading ? (
              <p className="mt-5 text-sm text-slate-500">Reading consented tenant context...</p>
            ) : diagnostics ? (
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">Tenant</dt><dd className="mt-2 font-semibold text-slate-900">{diagnostics.tenant?.name ?? active.session.tenantNameSnapshot}</dd><dd className="mt-1 text-xs text-slate-500">{diagnostics.tenant?.status ?? "Read not permitted"}</dd></div>
                <div className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">Branch</dt><dd className="mt-2 font-semibold text-slate-900">{diagnostics.branch?.name ?? active.session.branchNameSnapshot}</dd><dd className="mt-1 text-xs text-slate-500">{diagnostics.branch?.address ?? active.session.branchId}</dd></div>
                <div className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">Timezone</dt><dd className="mt-2 font-semibold text-slate-900">{diagnostics.branch?.timezone ?? diagnostics.tenant?.timezone ?? "Unavailable"}</dd></div>
                <div className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">Currency</dt><dd className="mt-2 font-semibold text-slate-900">{diagnostics.branch?.currency ?? "Read not permitted"}</dd></div>
              </dl>
            ) : (
              <p className="mt-5 text-sm text-slate-500">The selected consent does not permit tenant or branch reads.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-8 border-t border-slate-200 pt-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Valid consents</h2>
                <p className="mt-1 text-sm text-slate-500">Only unexpired, non-revoked consent records are shown.</p>
              </div>
              <div className="flex w-full max-w-xl gap-2">
                <Input
                  aria-label="Filter consents by tenant UUID"
                  value={tenantFilter}
                  onChange={(event) => setTenantFilter(event.target.value)}
                  placeholder="Optional tenant UUID"
                />
                <Button type="button" variant="outline" size="icon" title="Filter consents" aria-label="Filter consents" onClick={applyTenantFilter}>
                  <Search className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" title="Refresh consents" aria-label="Refresh consents" onClick={() => void loadConsents(tenantFilter.trim() || undefined)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {error ? <div className="mt-4"><Alert variant="error">{error}</Alert></div> : null}
            <div className="mt-4 space-y-3">
              {loading ? (
                <p className="py-8 text-sm text-slate-500">Loading tenant consents...</p>
              ) : consents.length === 0 ? (
                <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  No valid consent is available for this tenant filter.
                </div>
              ) : (
                consents.map((consent) => (
                  <label
                    key={consent.id}
                    className={`block cursor-pointer rounded-md border p-4 ${
                      selectedConsentId === consent.id
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="impersonation-consent"
                        value={consent.id}
                        checked={selectedConsentId === consent.id}
                        onChange={() => setSelectedConsentId(consent.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{consent.tenantNameSnapshot}</p>
                        <p className="mt-1 text-sm text-slate-600">{consent.reason}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Scope: {consent.allowedScopes.join(", ")} | Expires {formatDateTime(consent.expiresAt)}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-400">Consent {consent.id}</p>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <form onSubmit={startSession} className="border-l border-slate-200 pl-7">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-700" />
              <h2 className="text-lg font-semibold text-slate-900">Session details</h2>
            </div>
            {selectedConsent ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Allowed scope</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedConsent.allowedScopes.map((scope) => (
                      <span key={scope} className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                        {scope.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
                <FormField label="Target branch" htmlFor="impersonation-branch">
                  {selectedConsent.allowedBranchIds.length > 0 ? (
                    <Select id="impersonation-branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                      {selectedConsent.allowedBranchIds.map((id) => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input id="impersonation-branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} placeholder="Active branch UUID" />
                  )}
                </FormField>
                <FormField label="Diagnostic reason" htmlFor="impersonation-reason">
                  <textarea
                    id="impersonation-reason"
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    placeholder="Describe the support task being performed"
                  />
                </FormField>
                <Button type="submit" isLoading={starting} className="w-full bg-red-700 hover:bg-red-800 focus-visible:ring-red-700">
                  <KeyRound className="h-4 w-4" /> Start impersonation
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Select a consent to configure the session.</p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
