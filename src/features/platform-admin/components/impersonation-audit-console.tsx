"use client";

import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search } from "lucide-react";
import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "../format";
import {
  groupImpersonationAuditEvents,
  searchImpersonationAudit,
  type ImpersonationAuditEvent,
  type ImpersonationAuditFilters,
  type ImpersonationAuditSession,
} from "../impersonation";
import type { ImpersonationScope } from "@/lib/platform-admin/impersonation-session";

const PAGE_SIZE = 50;

interface FilterDraft {
  search: string;
  eventType: "" | ImpersonationAuditEvent["eventType"];
  scope: "" | ImpersonationScope;
  tenantId: string;
  branchId: string;
  platformAdminId: string;
  consentId: string;
  from: string;
  to: string;
}

const emptyFilters: FilterDraft = {
  search: "",
  eventType: "",
  scope: "",
  tenantId: "",
  branchId: "",
  platformAdminId: "",
  consentId: "",
  from: "",
  to: "",
};

function eventLabel(event: ImpersonationAuditEvent) {
  return event.eventType === "action" || event.eventType === "branch_switch"
    ? "Impersonated action"
    : "Session control";
}

export function ImpersonationAuditResults({
  sessions,
}: {
  sessions: ImpersonationAuditSession[];
}) {
  if (sessions.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        No impersonation audit events match these filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <article key={session.sessionId} className="rounded-md border border-slate-200 bg-white">
          <header className="border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                    Platform impersonation
                  </span>
                  <h2 className="font-semibold text-slate-900">{session.tenantName}</h2>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {session.adminEmail} | Branch {session.branchName}
                </p>
              </div>
              <p className="text-xs text-slate-500">Session {session.sessionId}</p>
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-slate-500">Started</dt><dd className="mt-1 font-medium text-slate-800">{formatDateTime(session.startAt)}</dd></div>
              <div><dt className="text-slate-500">Ended</dt><dd className="mt-1 font-medium text-slate-800">{session.endAt ? formatDateTime(session.endAt) : "Still active or not in result"}</dd></div>
              <div><dt className="text-slate-500">Session expiry</dt><dd className="mt-1 font-medium text-slate-800">{formatDateTime(session.expiresAt)}</dd></div>
              <div><dt className="text-slate-500">Consent</dt><dd className="mt-1 break-all font-medium text-slate-800">{session.consentId ?? "Unavailable"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">Diagnostic reason</dt><dd className="mt-1 text-slate-800">{session.reason ?? "Not recorded"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">Tenant consent reason</dt><dd className="mt-1 text-slate-800">{session.consentReason}</dd></div>
              {session.endReason ? <div className="sm:col-span-2"><dt className="text-slate-500">End reason</dt><dd className="mt-1 text-slate-800">{session.endReason}</dd></div> : null}
              <div><dt className="text-slate-500">Tenant ID</dt><dd className="mt-1 break-all text-slate-800">{session.tenantId ?? "Deleted tenant snapshot"}</dd></div>
              <div><dt className="text-slate-500">Branch ID</dt><dd className="mt-1 break-all text-slate-800">{session.branchId ?? "Deleted branch snapshot"}</dd></div>
              <div><dt className="text-slate-500">PlatformAdmin ID</dt><dd className="mt-1 break-all text-slate-800">{session.platformAdminId ?? "Deleted admin snapshot"}</dd></div>
            </dl>
          </header>
          <div className="divide-y divide-slate-100">
            {session.events.map((event) => (
              <div key={event.id} className="grid gap-3 p-4 md:grid-cols-[160px_minmax(0,1fr)_180px]">
                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    eventLabel(event) === "Impersonated action"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-700"
                  }`}>
                    {eventLabel(event)}
                  </span>
                  <p className="mt-2 text-xs capitalize text-slate-500">{event.eventType.replaceAll("_", " ")}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-slate-900">{event.action}</p>
                  {event.reason ? <p className="mt-1 text-sm text-slate-600">{event.reason}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Scope {event.scope?.replaceAll("_", " ") ?? "session lifecycle"}
                    {event.ipAddress ? ` | IP ${event.ipAddress}` : ""}
                  </p>
                  {event.metadata ? (
                    <details className="mt-2 text-xs text-slate-500">
                      <summary className="cursor-pointer font-medium">Linked action metadata</summary>
                      <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500 md:text-right">
                  <p>{formatDateTime(event.occurredAt)}</p>
                  <p className="mt-1 break-all">Branch {event.branchNameSnapshot}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function toQuery(draft: FilterDraft, offset: number): ImpersonationAuditFilters {
  return {
    search: draft.search.trim() || undefined,
    eventType: draft.eventType || undefined,
    scope: draft.scope || undefined,
    tenantId: draft.tenantId.trim() || undefined,
    branchId: draft.branchId.trim() || undefined,
    platformAdminId: draft.platformAdminId.trim() || undefined,
    consentId: draft.consentId.trim() || undefined,
    from: draft.from ? new Date(`${draft.from}T00:00:00.000Z`).toISOString() : undefined,
    to: draft.to ? new Date(`${draft.to}T23:59:59.999Z`).toISOString() : undefined,
    limit: PAGE_SIZE,
    offset,
  };
}

export function ImpersonationAuditConsole() {
  const [draft, setDraft] = useState<FilterDraft>(emptyFilters);
  const [applied, setApplied] = useState<FilterDraft>(emptyFilters);
  const [events, setEvents] = useState<ImpersonationAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchImpersonationAudit(toQuery(applied, offset));
      setEvents(result.items);
      setTotal(result.total);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not load impersonation audit records.",
      );
    } finally {
      setLoading(false);
    }
  }, [applied, offset]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const sessions = useMemo(
    () => groupImpersonationAuditEvents(events),
    [events],
  );

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setApplied({ ...draft });
  };

  const clearFilters = () => {
    setDraft({ ...emptyFilters });
    setApplied({ ...emptyFilters });
    setOffset(0);
  };

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-red-700">Security evidence</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Impersonation audit</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search PlatformAdmin support sessions and their linked impersonated actions. Ordinary tenant-user activity is not labeled or displayed as impersonation.
        </p>
      </header>

      <form onSubmit={applyFilters} className="border-y border-slate-200 py-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input aria-label="Search impersonation audit" value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder="Search action, reason, admin, tenant or branch" className="pl-9" />
          </div>
          <Select aria-label="Filter audit event type" value={draft.eventType} onChange={(event) => setDraft((current) => ({ ...current, eventType: event.target.value as FilterDraft["eventType"] }))}>
            <option value="">All event types</option>
            <option value="start">Start</option>
            <option value="action">Action</option>
            <option value="branch_switch">Branch switch</option>
            <option value="end">End</option>
          </Select>
          <Select aria-label="Filter audit scope" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as FilterDraft["scope"] }))}>
            <option value="">All scopes</option>
            <option value="tenant_read">Tenant read</option>
            <option value="branch_read">Branch read</option>
            <option value="branch_switch">Branch switch</option>
          </Select>
          <Input aria-label="Filter by tenant ID" value={draft.tenantId} onChange={(event) => setDraft((current) => ({ ...current, tenantId: event.target.value }))} placeholder="Tenant UUID" />
          <Input aria-label="Filter by branch ID" value={draft.branchId} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value }))} placeholder="Branch UUID" />
          <Input aria-label="Filter by admin ID" value={draft.platformAdminId} onChange={(event) => setDraft((current) => ({ ...current, platformAdminId: event.target.value }))} placeholder="PlatformAdmin UUID" />
          <Input aria-label="Filter by consent ID" value={draft.consentId} onChange={(event) => setDraft((current) => ({ ...current, consentId: event.target.value }))} placeholder="Consent UUID" />
          <label className="text-xs font-medium text-slate-600">From<Input type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} className="mt-1" /></label>
          <label className="text-xs font-medium text-slate-600">To<Input type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} className="mt-1" /></label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <Button type="submit"><Filter className="h-4 w-4" /> Apply filters</Button>
            <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>
            <Button type="button" variant="outline" size="icon" title="Refresh audit" aria-label="Refresh audit" onClick={() => void loadAudit()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading audit records...</div>
      ) : (
        <ImpersonationAuditResults sessions={sessions} />
      )}

      <footer className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
        <p>{total} matching events</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" title="Previous page" aria-label="Previous page" disabled={offset === 0 || loading} onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}><ChevronLeft className="h-4 w-4" /></Button>
          <span>{total === 0 ? "0" : `${offset + 1}-${Math.min(offset + PAGE_SIZE, total)}`}</span>
          <Button type="button" variant="outline" size="icon" title="Next page" aria-label="Next page" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset((current) => current + PAGE_SIZE)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </footer>
    </div>
  );
}
