"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  AnomalyAlertItem,
  AuditKPIs,
  AuditLogItem,
  AuditRetentionPolicy,
} from "../../../types/audit";
import {
  fetchAnomalyAlerts,
  fetchAuditKPIs,
  fetchAuditLogs,
  fetchRetentionPolicy,
  resolveAnomaly,
  triggerAnomalyScan,
  updateRetentionPolicy,
  verifyClientClock,
} from "../../../lib/api/audit";

import { toast } from "@/lib/toast";
import { tokenStorage } from "@/lib/auth/session";
import {
  cacheScopedJson,
  isNetworkFailure,
  readScopedJson,
} from "@/lib/sync/offline-reference-cache";

// Offline copy of the audit view 
const auditCacheName = (name: string) =>
  `audit:${tokenStorage.getAccessContext()?.userId ?? "anon"}:${name}`;

function filterSavedLogs(
  list: AuditLogItem[],
  filters: { search: string; severity: string },
): AuditLogItem[] {
  const term = filters.search.trim().toLowerCase();
  return list.filter((log) => {
    if (filters.severity && log.severity !== filters.severity) return false;
    if (!term) return true;
    return [
      log.actionType,
      log.entityType,
      log.ipAddress,
      log.actorUser?.fullName,
      log.actorUser?.email,
      log.branch?.name,
    ].some((value) => (value ?? "").toLowerCase().includes(term));
  });
}

export default function AuditPage() {
  const [kpis, setKpis] = useState<AuditKPIs | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlertItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [activeAlertTab, setActiveAlertTab] = useState<"active" | "resolved">("active");

  const [isLoading, setIsLoading] = useState(true);
  // True while the page shows the saved copy because the server cannot be reached.
  const [offlineMode, setOfflineMode] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState({ kpis: false, logs: false, alerts: false });
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifyingClock, setIsVerifyingClock] = useState(false);
  const [clockStatus, setClockStatus] = useState<{
    message: string;
    isTampered: boolean;
  } | null>(null);

  // Retention Modal State
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [retentionPolicy, setRetentionPolicy] = useState<AuditRetentionPolicy | null>(null);
  const [retentionDays, setRetentionDays] = useState(365);
  const [autoArchive, setAutoArchive] = useState(false);

  // Resolve Alert Modal State
  const [resolvingAlert, setResolvingAlert] = useState<AnomalyAlertItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      // Remember which calls failed, so a failed call is never shown or saved as real data.
      const status = { kpi: false, logs: false, alerts: false, unreachable: false };
      const fallbackOnError =
        <T,>(key: "kpi" | "logs" | "alerts", fallback: T) =>
        (err: unknown): T => {
          status[key] = true;
          if (isNetworkFailure(err)) status.unreachable = true;
          return fallback;
        };
      const [kpiRes, logRes, alertRes] = await Promise.all([
        fetchAuditKPIs().catch(fallbackOnError("kpi", null)),
        fetchAuditLogs({
          page,
          limit: 15,
          search: search || undefined,
          severity: severityFilter ? (severityFilter as any) : undefined,
        }).catch(
          fallbackOnError("logs", {
            total: 0,
            page: 1,
            limit: 15,
            totalPages: 0,
            logs: [],
          }),
        ),
        fetchAnomalyAlerts({ isResolved: activeAlertTab === "resolved" }).catch(
          fallbackOnError("alerts", {
            total: 0,
            page: 1,
            limit: 15,
            totalPages: 0,
            alerts: [],
          }),
        ),
      ]);

      if (status.unreachable) {
        // Offline / server unreachable: show the last copy saved while online.
        const [savedKpis, savedLogs, savedAlerts] = await Promise.all([
          readScopedJson<AuditKPIs>(auditCacheName("kpis")),
          readScopedJson<{ logs: AuditLogItem[]; total: number }>(auditCacheName("logs")),
          readScopedJson<AnomalyAlertItem[]>(auditCacheName(`alerts-${activeAlertTab}`)),
        ]);
        const stamps = [savedKpis, savedLogs, savedAlerts]
          .flatMap((entry) => (entry ? [entry.savedAt] : []))
          .sort();
        setOfflineMode(true);
        setSavedAt(stamps[0] ?? null);
        setUnavailable({ kpis: !savedKpis, logs: !savedLogs, alerts: !savedAlerts });
        setKpis(savedKpis ? savedKpis.data : null);
        setLogs(
          savedLogs
            ? filterSavedLogs(savedLogs.data.logs, { search, severity: severityFilter })
            : [],
        );
        setTotalLogs(savedLogs ? savedLogs.data.total : 0);
        setAlerts(savedAlerts ? savedAlerts.data : []);
        return;
      }

      if (kpiRes) setKpis(kpiRes);
      if (logRes) {
        setLogs(logRes.logs || []);
        setTotalLogs(logRes.total || 0);
      }
      if (alertRes) setAlerts(alertRes.alerts || []);
      setOfflineMode(false);
      setSavedAt(null);

      // Keep the last real server answers for offline use (never the empty fallbacks).
      if (!status.kpi && kpiRes) {
        void cacheScopedJson(auditCacheName("kpis"), kpiRes);
      }
      if (!status.logs && logRes && page === 1 && !search.trim() && !severityFilter) {
        void cacheScopedJson(auditCacheName("logs"), {
          logs: logRes.logs || [],
          total: logRes.total || 0,
        });
      }
      if (!status.alerts && alertRes) {
        void cacheScopedJson(auditCacheName(`alerts-${activeAlertTab}`), alertRes.alerts || []);
      }
    } catch (err) {
      if (!isSilent) toast.error("Failed to load audit data.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, severityFilter, activeAlertTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamic Revalidation & Invalidation Listeners
  useEffect(() => {
    const handleRevalidate = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadData(true);
      }
    };

    window.addEventListener("focus", handleRevalidate);
    document.addEventListener("visibilitychange", handleRevalidate);
    window.addEventListener("cuecloud:anomaly-invalidated", handleRevalidate);
    window.addEventListener("cuecloud:audit-invalidated", handleRevalidate);
    window.addEventListener("cuecloud:invoice-voided", handleRevalidate);
    window.addEventListener("cuecloud:authenticated-heartbeat", handleRevalidate);
    window.addEventListener("online", handleRevalidate);

    // Dynamic polling interval (every 8s) to react to background changes
    const timer = setInterval(handleRevalidate, 8000);

    return () => {
      window.removeEventListener("focus", handleRevalidate);
      document.removeEventListener("visibilitychange", handleRevalidate);
      window.removeEventListener("cuecloud:anomaly-invalidated", handleRevalidate);
      window.removeEventListener("cuecloud:audit-invalidated", handleRevalidate);
      window.removeEventListener("cuecloud:invoice-voided", handleRevalidate);
      window.removeEventListener("cuecloud:authenticated-heartbeat", handleRevalidate);
      window.removeEventListener("online", handleRevalidate);
      clearInterval(timer);
    };
  }, [loadData]);

  // Handle Clock Verification
  const handleVerifyClock = async () => {
    try {
      setIsVerifyingClock(true);
      const res = await verifyClientClock({
        clientTimestamp: new Date().toISOString(),
        toleranceSeconds: 300,
      });

      if (res.isTampered) {
        setClockStatus({
          message: `Clock skew detected: ${res.diffSeconds}s offset from server!`,
          isTampered: true,
        });
        toast.warning(`Clock skew detected: ${res.diffSeconds}s offset from server!`);
      } else {
        setClockStatus({
          message: `Clock synchronized with authoritative server (Skew: ${res.diffSeconds}s).`,
          isTampered: false,
        });
        toast.success(`Clock synchronized with authoritative server (Skew: ${res.diffSeconds}s).`);
      }
      loadData();
    } catch (err: any) {
      if (isNetworkFailure(err)) {
        // Offline is not tampering: only the server can judge the clock (SRS 3.13).
        toast.warning("Server clock check needs an internet connection.");
      } else {
        setClockStatus({
          message: `Failed to verify clock: ${err.message}`,
          isTampered: true,
        });
        toast.error(`Failed to verify clock: ${err.message}`);
      }
    } finally {
      setIsVerifyingClock(false);
    }
  };

  // Handle Anomaly Scan
  const handleTriggerScan = async () => {
    try {
      setIsScanning(true);
      const res = await triggerAnomalyScan();
      toast.success(`Scan complete: ${res.detectedCount} new anomaly alert(s) identified.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to run scan.");
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Opening Resolution Modal
  const handleOpenResolveModal = (alertItem: AnomalyAlertItem) => {
    setResolvingAlert(alertItem);
    setResolutionNotes("");
  };

  // Handle Submitting Resolution
  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlert) return;
    if (!resolutionNotes.trim()) {
      toast.error("Please enter resolution notes or audit justification.");
      return;
    }

    try {
      setIsSubmittingResolution(true);
      await resolveAnomaly(resolvingAlert.id, resolutionNotes.trim());
      toast.success("Anomaly alert marked as resolved.");
      setResolvingAlert(null);
      setResolutionNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve alert.");
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // Open Retention Policy
  const handleOpenRetention = async () => {
    try {
      const policy = await fetchRetentionPolicy();
      setRetentionPolicy(policy);
      setRetentionDays(policy.retentionDays);
      setAutoArchive(policy.autoArchive);
      setIsRetentionModalOpen(true);
    } catch (err: any) {
      toast.error(
        isNetworkFailure(err)
          ? "The retention policy needs an internet connection."
          : err.message || "Failed to load retention policy.",
      );
    }
  };

  // Save Retention Policy
  const handleSaveRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateRetentionPolicy({ retentionDays, autoArchive });
      setIsRetentionModalOpen(false);
      toast.success("Retention policy updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update retention policy.");
    }
  };

  // Helper for formatting IP address display
  const formatIp = (ip?: string | null) => {
    if (!ip) return "Internal / Localhost";
    if (ip === "::1" || ip === "127.0.0.1") return "127.0.0.1 (Loopback)";
    return ip.replace(/^.*:/, ""); // Clean up IPv6 mapped IPv4
  };

  // Offline with no saved copy: show "—" instead of a made-up 0.
  const kpiText = (value?: number) => (offlineMode && !kpis ? "—" : value ?? 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Audit & Compliance Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable log trail, shift anomaly alerts, receipt reprints, and retention governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenRetention}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Retention Policy
          </button>

          <button
            onClick={() => void loadData(false)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {offlineMode && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800"
        >
          {savedAt ? (
            <>
              You are offline. Showing the audit data saved on{" "}
              <span className="font-semibold">{new Date(savedAt).toLocaleString()}</span>. It
              refreshes automatically when the connection returns.
            </>
          ) : (
            <>
              You are offline and no audit data was saved on this device yet. Open this page once
              while online, then the last copy will be available offline.
            </>
          )}{" "}
          Newer events, clock verification and alert actions need a connection.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        {/* Total Immutable Logs */}
        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Immutable Logs
            </span>
            <span className="p-2 rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiText(kpis?.totalLogs)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Cryptographically verified</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-200 text-[10px]">
                Append-Only
              </span>
            </div>
          </div>
        </div>

        {/* Anomalies (Today) */}
        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Anomalies (Today)
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiText(kpis?.anomaliesToday)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Shift & void pattern alerts</span>
              <span
                className={`px-2 py-0.5 rounded-full font-semibold border text-[10px] ${
                  (kpis?.anomaliesToday ?? 0) > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {offlineMode && !kpis ? "Unavailable" : (kpis?.anomaliesToday ?? 0) > 0 ? "Action Required" : "Normal"}
              </span>
            </div>
          </div>
        </div>

        {/* Clock Tamper Alerts */}
        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Clock Tamper Alerts
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiText(kpis?.tamperCount)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Server skew checks</span>
              <span
                className={`px-2 py-0.5 rounded-full font-semibold border text-[10px] ${
                  (kpis?.tamperCount ?? 0) > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-brand-50 text-brand-700 border-brand-200"
                }`}
              >
                {offlineMode && !kpis ? "Unavailable" : (kpis?.tamperCount ?? 0) > 0 ? "Alerts Recorded" : "Synchronized"}
              </span>
            </div>
          </div>
        </div>

        {/* Receipt Reprints */}
        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Receipt Reprints
            </span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiText(kpis?.reprintCount)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Logged reprint actions</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-[10px]">
                Monitored
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Clock Sync Banner */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              offlineMode
                ? "bg-amber-400"
                : clockStatus?.isTampered
                ? "bg-rose-500 animate-ping"
                : "bg-brand-500 animate-pulse"
            }`}
          />
          <span className="text-xs font-medium text-slate-700">
            {offlineMode
              ? "Offline: the server clock check is unavailable. This device's time is reconciled with the server when the connection returns."
              : clockStatus?.message ||
                "Server Authoritative Clock Sync is active (drift tolerance: ±5m)."}
          </span>
        </div>

        <button
          onClick={handleVerifyClock}
          disabled={isVerifyingClock || offlineMode}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors shrink-0 disabled:opacity-50"
        >
          {isVerifyingClock ? "Verifying..." : "Verify Clock Skew"}
        </button>
      </div>

      {/* Anomaly & Compliance Alert Center */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Anomaly & Compliance Alert Center
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  alerts.length > 0 && activeAlertTab === "active"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {offlineMode && unavailable.alerts
                  ? "Unavailable"
                  : activeAlertTab === "active"
                  ? `${alerts.length} Unresolved`
                  : `${alerts.length} History`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated monitoring for unauthorized voids, abnormal discounts, and clock tampering.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveAlertTab("active")}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeAlertTab === "active"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "hover:text-slate-900"
                }`}
              >
                Active Alerts
              </button>
              <button
                onClick={() => setActiveAlertTab("resolved")}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeAlertTab === "resolved"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "hover:text-slate-900"
                }`}
              >
                Resolved History
              </button>
            </div>

          </div>
        </div>

        {offlineMode && unavailable.alerts ? (
          <div className="p-8 text-center bg-amber-50 border border-amber-100 rounded-xl">
            <h4 className="text-sm font-semibold text-slate-900">
              Alerts are not available offline
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Anomaly alerts are checked on the server and no saved copy exists on this device.
              Connect once to load them.
            </p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2 border border-brand-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              {activeAlertTab === "active" ? "No active anomalies found" : "No resolved anomalies on record"}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeAlertTab === "active"
                ? "Your system has no pending security or operational anomalies."
                : "No past anomalies have been archived in this view."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <div key={alert.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        alert.severity === "critical"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{alert.anomalyType}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(alert.detectedAt).toLocaleString()}
                    </span>
                    {alert.metadata && typeof alert.metadata === "object" && (alert.metadata as any).ipAddress && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        IP: {formatIp((alert.metadata as any).ipAddress)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{alert.description}</p>
                  {alert.resolutionNotes && (
                    <p className="text-[11px] text-brand-700 mt-1 bg-brand-50/60 px-2 py-1 rounded-md border border-brand-100 inline-block">
                      <strong>Resolution Note:</strong> {alert.resolutionNotes}
                    </p>
                  )}
                </div>

                {!alert.isResolved && (
                  <button
                    onClick={() => handleOpenResolveModal(alert)}
                    disabled={offlineMode}
                    title={offlineMode ? "Needs an internet connection" : undefined}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Resolve Alert
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Immutable Audit Trail Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Immutable Audit Trail
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only system events recorded across all branches and user sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="Search actions, IPs, entities..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-56 max-w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />

            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white text-slate-700"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor / Network</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {offlineMode && unavailable.logs
                      ? "The audit trail is not available offline. Open this page once while online to save a copy."
                      : "No log events recorded."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.occurredAt).toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {log.actionType}
                    </td>

                    {/* Entity */}
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium text-[11px]">
                        {log.entityType}
                      </span>
                    </td>

                    {/* Actor & IP Address */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {log.actorUser?.fullName || log.actorUser?.email || "System"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <span>{formatIp(log.ipAddress)}</span>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {log.branch?.name || "Global / Root"}
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.severity === "critical"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : log.severity === "warning"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-brand-50 text-brand-700 border-brand-200"
                        }`}
                      >
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            {offlineMode
              ? `Showing ${logs.length} saved events (latest entries only)`
              : `Showing ${logs.length} of ${totalLogs} total events (Page ${page})`}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || offlineMode}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={offlineMode || logs.length < 15 || page * 15 >= totalLogs}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Retention Policy Modal */}
      {isRetentionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Audit Log Retention Policy
            </h3>
            <p className="text-xs text-slate-500">
              Configure data lifecycle and automatic archive schedules for compliance logs.
            </p>

            <form onSubmit={handleSaveRetention} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Retention Window (Days)
                </label>
                <input
                  type="number"
                  min={30}
                  max={3650}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoArchive"
                  checked={autoArchive}
                  onChange={(e) => setAutoArchive(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="autoArchive" className="text-xs font-medium text-slate-700">
                  Automatically compress & archive expired logs
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Anomaly Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Resolve Anomaly Alert
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provide an audit justification and resolution notes for compliance records.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  resolvingAlert.severity === "critical"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {resolvingAlert.severity.toUpperCase()}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">{resolvingAlert.anomalyType}</div>
              <div>{resolvingAlert.description}</div>
              <div className="text-[11px] text-slate-400">
                Detected: {new Date(resolvingAlert.detectedAt).toLocaleString()}
              </div>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Notes / Audit Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g., Reviewed by GM, verified valid manager discount with receipt attached..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSubmittingResolution}
                  onClick={() => {
                    setResolvingAlert(null);
                    setResolutionNotes("");
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolution || !resolutionNotes.trim()}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSubmittingResolution ? "Resolving..." : "Confirm & Resolve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}