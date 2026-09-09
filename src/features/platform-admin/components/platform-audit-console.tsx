"use client";

import { useEffect, useState, useCallback } from "react";
import { platformAdminFetch } from "@/lib/platform-admin/client";
import { ImpersonationAuditConsole } from "./impersonation-audit-console";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TenancyApi, Tenant } from "@/features/tenancy";
import {
  FileSearch,
  AlertTriangle,
  ScanFace,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  actorUserId: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  severity: string;
  occurredAt: string;
  tenant?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  actorUser?: { id: string; fullName: string | null; email: string | null } | null;
}

interface AnomalyItem {
  id: string;
  tenantId: string;
  anomalyType: string;
  severity: string;
  description: string;
  isResolved: boolean;
  detectedAt: string;
  tenant?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  user?: { id: string; fullName: string | null; email: string | null } | null;
}

export function PlatformAuditConsole() {
  const [activeTab, setActiveTab] = useState<"logs" | "anomalies" | "impersonation">("logs");

  // Filter States for Logs
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");

  // Audit Logs State
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Anomalies State
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);
  const [anomaliesError, setAnomaliesError] = useState<string | null>(null);

  // Load Tenants for Dropdown
  useEffect(() => {
    TenancyApi.listTenants()
      .then(setTenants)
      .catch(() => []);
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTenantId) params.set("tenantId", selectedTenantId);
      if (actionTypeFilter) params.set("actionType", actionTypeFilter);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (severityFilter) params.set("severity", severityFilter);
      params.set("limit", "50");

      const res = await platformAdminFetch<{ items: AuditLogItem[]; total: number }>(
        `/super-admin/audit/logs?${params.toString()}`
      );
      setLogs(res.items);
      setTotalLogs(res.total);
    } catch (err: any) {
      setLogsError(err.message || "Failed to load audit logs");
    } finally {
      setLogsLoading(false);
    }
  }, [selectedTenantId, actionTypeFilter, entityTypeFilter, severityFilter]);

  const fetchAnomalies = useCallback(async () => {
    setAnomaliesLoading(true);
    setAnomaliesError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTenantId) params.set("tenantId", selectedTenantId);
      params.set("limit", "50");

      const res = await platformAdminFetch<{ items: AnomalyItem[]; total: number }>(
        `/super-admin/audit/anomalies?${params.toString()}`
      );
      setAnomalies(res.items);
    } catch (err: any) {
      setAnomaliesError(err.message || "Failed to load anomalies");
    } finally {
      setAnomaliesLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (activeTab === "logs") {
      void fetchAuditLogs();
    } else if (activeTab === "anomalies") {
      void fetchAnomalies();
    }
  }, [activeTab, fetchAuditLogs, fetchAnomalies]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Audit & Compliance</h1>
          <p className="text-sm text-slate-500">
            Immutable system logs, financial mutations, detected anomalies, and impersonation records.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab !== "impersonation" && (
            <Button
              onClick={() => (activeTab === "logs" ? fetchAuditLogs() : fetchAnomalies())}
              variant="secondary"
              className="w-auto px-3"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        aria-label="Audit views"
        className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
        role="tablist"
      >
        <button
          aria-selected={activeTab === "logs"}
          className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
            activeTab === "logs"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("logs")}
          role="tab"
          type="button"
        >
          <FileSearch className="h-4 w-4" /> Platform & Tenant Logs
        </button>
        <button
          aria-selected={activeTab === "anomalies"}
          className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
            activeTab === "anomalies"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("anomalies")}
          role="tab"
          type="button"
        >
          <AlertTriangle className="h-4 w-4" /> High-Risk Anomalies
        </button>
        <button
          aria-selected={activeTab === "impersonation"}
          className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
            activeTab === "impersonation"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("impersonation")}
          role="tab"
          type="button"
        >
          <ScanFace className="h-4 w-4" /> Impersonation Trail
        </button>
      </div>

      {/* Tab 1: Platform & Tenant Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="text-xs"
            >
              <option value="">All Tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>

            <Input
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              placeholder="Filter by action (e.g. create, void)..."
              className="text-xs"
            />

            <Input
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              placeholder="Filter by entity (e.g. invoice, session)..."
              className="text-xs"
            />

            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
          </div>

          {logsError && <Alert variant="error">{logsError}</Alert>}

          {logsLoading ? (
            <div className="h-64 bg-slate-100 rounded-xl border border-slate-200 animate-pulse"></div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center bg-white">
              <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-800">No audit logs match criteria</p>
              <p className="text-xs text-slate-500">Try changing or clearing your search filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 font-sans">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {new Date(log.occurredAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {log.tenant?.name || "System"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {log.actorUser?.fullName || log.actorUser?.email || "System / Automated"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-slate-100 text-slate-800 rounded px-2 py-0.5 text-xs font-mono font-semibold">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                        {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)})` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            log.severity === "critical"
                              ? "bg-rose-100 text-rose-800"
                              : log.severity === "warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: High Risk Anomalies */}
      {activeTab === "anomalies" && (
        <div className="space-y-4">
          {anomaliesError && <Alert variant="error">{anomaliesError}</Alert>}

          {anomaliesLoading ? (
            <div className="h-64 bg-slate-100 rounded-xl border border-slate-200 animate-pulse"></div>
          ) : anomalies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center bg-white">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-slate-800">No anomalies detected</p>
              <p className="text-xs text-slate-500">Platform operations and financial transactions are healthy.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Detected At</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Anomaly Type</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {anomalies.map((anom) => (
                    <tr key={anom.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        {new Date(anom.detectedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {anom.tenant?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-800">
                        {anom.anomalyType}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                            anom.severity === "critical"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {anom.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{anom.description}</td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {anom.isResolved ? (
                          <span className="text-emerald-600 inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                          </span>
                        ) : (
                          <span className="text-rose-600 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Open
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Impersonation Audit */}
      {activeTab === "impersonation" && <ImpersonationAuditConsole />}
    </div>
  );
}
