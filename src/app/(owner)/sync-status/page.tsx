"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  CircleGauge,
  Cloud,
  Database,
  FileText,
  RefreshCw,
  Server,
  Timer,
  Trash2,
  Users,
  CreditCard,
  BookOpen,
  Wifi,
  WifiOff,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  getPendingSyncItems,
  markItemAsFailed,
  markItemsAsSynced,
  removePendingQueueItem,
  clearSyncedItems,
  seedReviewSyncItems,
  type InvoiceOfflinePayload,
  type PendingSyncItem,
  type SessionOfflinePayload,
  type CustomerOfflinePayload,
  type PaymentOfflinePayload,
  type UdhaarOfflinePayload,
} from "@/lib/sync/offline-db";
import {
  getServerTime,
  pullSyncChanges,
  pushSyncChanges,
  sendHeartbeat,
  type HeartbeatResponse,
} from "@/services/sync.service";
import { AUTHENTICATED_HEARTBEAT_EVENT } from "@/components/sync/authenticated-heartbeat";
import { SYNC_STATUS_EVENT } from "@/lib/sync/sync-manager";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useAuth } from "@/lib/auth/auth-context";
import { tokenStorage } from "@/lib/auth/session";
import { getQueueCount, triggerSyncPush } from "@/lib/offline-sync";

type ActiveAction = "push" | "pull" | "connection" | "remove" | "clearSynced" | null;

function formatDateTime(value: string | null) {
  if (!value) return "Not available yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function relativeTime(value: string | null) {
  if (!value) return "Never";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Never";

  const seconds = Math.round((time - Date.now()) / 1000);
  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let duration = seconds;

  for (const [limit, unit] of ranges) {
    if (Math.abs(duration) < limit) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        Math.round(duration),
        unit,
      );
    }
    duration /= limit;
  }

  return "Never";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getEntityIcon(entity: string) {
  switch (entity) {
    case "session":
      return <Timer size={18} />;
    case "invoice":
      return <FileText size={18} />;
    case "customer":
      return <Users size={18} />;
    case "payment":
      return <CreditCard size={18} />;
    case "udhaar":
      return <BookOpen size={18} />;
    default:
      return <Cloud size={18} />;
  }
}

function getEntityBadgeColor(entity: string) {
  switch (entity) {
    case "session":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "invoice":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "customer":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "payment":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "udhaar":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function itemDescription(item: PendingSyncItem) {
  if (item.entity === "session") {
    const payload = item.payload as SessionOfflinePayload;
    return `${payload.status || "active"} session${payload.appliedHourlyRate ? ` · Rs. ${payload.appliedHourlyRate}/hr` : ""}`;
  }
  if (item.entity === "invoice") {
    const payload = item.payload as InvoiceOfflinePayload;
    return `${payload.invoiceNumber ? `Invoice ${payload.invoiceNumber}` : "Unnumbered invoice"}${payload.total ? ` · Total Rs. ${payload.total}` : ""}`;
  }
  if (item.entity === "customer") {
    const payload = item.payload as CustomerOfflinePayload;
    return `${payload.fullName || "Customer"} · Phone: ${payload.phone || "No phone"}`;
  }
  if (item.entity === "payment") {
    const payload = item.payload as PaymentOfflinePayload;
    return `Payment Rs. ${payload.amount || "0"} (${payload.paymentMethod || "CASH"})`;
  }
  if (item.entity === "udhaar") {
    const payload = item.payload as UdhaarOfflinePayload;
    return `Udhaar ${payload.entryType || "CHARGE"} Rs. ${payload.amount || "0"}`;
  }
  return `Offline mutation (${item.action})`;
}

export default function SyncStatusPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const accessContext = tokenStorage.getAccessContext();
  const syncDeviceId = isAuthenticated ? accessContext?.deviceId : null;
  const syncBranchId = isAuthenticated ? user?.branchId : null;

  const [pendingItems, setPendingItems] = useState<PendingSyncItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "failed" | "synced">("all");
  const [pulledChanges, setPulledChanges] = useState(0);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingSyncItem | null>(null);
  const [inspectItem, setInspectItem] = useState<PendingSyncItem | null>(null);
  const [localQueueCount, setLocalQueueCount] = useState(0);

  const loadQueue = useCallback(async () => {
    const items = await getPendingSyncItems();
    setPendingItems(items.sort((a, b) => b.originTimestamp.localeCompare(a.originTimestamp)));
    setLocalQueueCount(getQueueCount());
  }, []);

  const checkConnection = useCallback(async (showProgress = false) => {
    if (authLoading) return;
    if (showProgress) setActiveAction("connection");
    setError("");

    try {
      const time = await getServerTime();
      setServerTime(time.serverTime);

      if (!isAuthenticated || !syncDeviceId || !syncBranchId) {
        throw new Error("Sign in again to establish device sync context.");
      }

      const heartbeat = await sendHeartbeat(syncDeviceId, syncBranchId);
      setLastHeartbeat(heartbeat.lastHeartbeatAt);
    } catch (connectionError) {
      setError(getErrorMessage(connectionError, "The sync service could not be reached."));
    } finally {
      if (showProgress) setActiveAction(null);
    }
  }, [authLoading, isAuthenticated, syncBranchId, syncDeviceId]);

  const handlePush = async () => {
    setActiveAction("push");
    setError("");
    setNotice("");

    try {
      if (!navigator.onLine) throw new Error("You are currently offline. Operations remain stored locally.");
      if (!syncDeviceId) throw new Error("This device is not configured for synchronization.");

      if (getQueueCount() > 0) {
        await triggerSyncPush();
        setLocalQueueCount(0);
        setLastSynced(new Date().toISOString());
        setNotice("Synchronization Complete: All pending actions have been processed.");
        return;
      }

      const items = await getPendingSyncItems();
      const pushable = items.filter((i) => i.status === "pending" || i.status === "failed");
      if (pushable.length === 0) {
        setNotice("All changes are already synchronized.");
        return;
      }

      const response = await pushSyncChanges(
        syncDeviceId,
        pushable.map((item) => ({
          idempotencyKey: item.idempotencyKey,
          entityType: item.entity,
          entityId: item.entityId,
          action: item.action,
          payload: item.payload,
          originTimestamp: item.originTimestamp,
        })),
      );

      const acceptedKeys = new Set(
        response.acceptedChanges
          .map((change) => change.idempotencyKey)
          .filter(Boolean),
      );
      const rejectedByKey = new Map(
        response.rejectedChanges.map((change) => [
          change.idempotencyKey,
          change,
        ]),
      );

      const acceptedIds = pushable
        .filter((item) => acceptedKeys.has(item.idempotencyKey))
        .map((item) => item.id)
        .filter((id): id is number => typeof id === "number");

      await markItemsAsSynced(acceptedIds);

      for (const item of pushable.filter((entry) => !acceptedKeys.has(entry.idempotencyKey))) {
        if (typeof item.id === "number") {
          const rejection = rejectedByKey.get(item.idempotencyKey);
          await markItemAsFailed(
            item.id,
            rejection?.error ?? "The server rejected this local change.",
          );
        }
      }

      await loadQueue();
      setLastSynced(response.serverTime);
      setNotice(
        response.rejectedChanges.length
          ? `${acceptedIds.length} changes synchronized; ${response.rejectedChanges.length} need review.`
          : `${acceptedIds.length} ${acceptedIds.length === 1 ? "change" : "changes"} synchronized successfully.`,
      );
    } catch (pushError) {
      setError(getErrorMessage(pushError, "Pending changes could not be synchronized."));
    } finally {
      setActiveAction(null);
    }
  };

  const handlePull = async () => {
    setActiveAction("pull");
    setError("");
    setNotice("");

    try {
      if (!navigator.onLine) throw new Error("Reconnect to retrieve latest server changes.");
      if (!syncDeviceId) throw new Error("This device is not configured for synchronization.");

      const response = await pullSyncChanges(syncDeviceId, lastSynced ?? undefined);
      setPulledChanges(response.changeCount);
      setLastSynced(response.serverTime);
      setNotice(
        response.changeCount
          ? `${response.changeCount} changes received from the server.`
          : "This device has the latest updates from the server.",
      );
    } catch (pullError) {
      setError(getErrorMessage(pullError, "Server changes could not be retrieved."));
    } finally {
      setActiveAction(null);
    }
  };

  const handleClearSynced = async () => {
    setActiveAction("clearSynced");
    try {
      await clearSyncedItems();
      await loadQueue();
      setNotice("Cleared successfully synced records.");
    } finally {
      setActiveAction(null);
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemoval || typeof pendingRemoval.id !== "number") return;
    setActiveAction("remove");
    try {
      await removePendingQueueItem(pendingRemoval.id);
      await loadQueue();
      setNotice("The local pending change was discarded.");
    } finally {
      setPendingRemoval(null);
      setActiveAction(null);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const refreshLocalQueue = () => setLocalQueueCount(getQueueCount());
    window.addEventListener("online", refreshLocalQueue);
    window.addEventListener("cuecloud:offline-queue-changed", refreshLocalQueue);
    window.addEventListener(SYNC_STATUS_EVENT, refreshLocalQueue);
    return () => {
      window.removeEventListener("online", refreshLocalQueue);
      window.removeEventListener("cuecloud:offline-queue-changed", refreshLocalQueue);
      window.removeEventListener(SYNC_STATUS_EVENT, refreshLocalQueue);
    };
  }, []);

  // Listen to background sync manager events
  useEffect(() => {
    const onSyncStatusChanged = () => {
      void loadQueue();
    };

    window.addEventListener(SYNC_STATUS_EVENT, onSyncStatusChanged);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, onSyncStatusChanged);
  }, [loadQueue]);

  useEffect(() => {
    const onHeartbeat = (event: Event) => {
      const heartbeat = (event as CustomEvent<HeartbeatResponse>).detail;
      if (heartbeat.deviceId === syncDeviceId && heartbeat.branchId === syncBranchId) {
        setLastHeartbeat(heartbeat.lastHeartbeatAt);
      }
    };

    window.addEventListener(AUTHENTICATED_HEARTBEAT_EVENT, onHeartbeat);
    return () => window.removeEventListener(AUTHENTICATED_HEARTBEAT_EVENT, onHeartbeat);
  }, [syncBranchId, syncDeviceId]);

  const isBusy = activeAction !== null;
  const pendingCount = pendingItems.filter((item) => item.status === "pending").length;
  const failedCount = pendingItems.filter((item) => item.status === "failed").length;
  const syncedCount = pendingItems.filter((item) => item.status === "synced").length;

  const filteredItems = useMemo(() => {
    if (filterStatus === "all") return pendingItems;
    return pendingItems.filter((item) => item.status === filterStatus);
  }, [pendingItems, filterStatus]);

  const status = error ? "attention" : !isOnline ? "offline" : pendingCount ? "pending" : "ready";
  const statusStyles = {
    attention: "border-red-200 bg-red-50 text-red-800",
    offline: "border-amber-200 bg-amber-50 text-amber-800",
    pending: "border-blue-200 bg-blue-50 text-blue-800",
    ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[status];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Offline Sync &amp; Replication
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              {isOnline ? "Network available" : "Offline mode"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            All sessions, invoices, payments, customers, and udhaar actions operate seamlessly offline and synchronize automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePush}
            disabled={isBusy || !isOnline || (localQueueCount === 0 && pendingCount === 0 && failedCount === 0)}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <ArrowUpFromLine size={15} className={activeAction === "push" ? "animate-bounce" : ""} />
            <span>Sync Now ({localQueueCount + pendingCount + failedCount})</span>
          </button>
        </div>
      </div>

      {/* Notice Ribbon */}
      {notice && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 animate-in fade-in">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Waiting to Send</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <ArrowUpFromLine size={16} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{localQueueCount + pendingCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Pending transmission</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Needs Review</span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle size={16} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{failedCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Conflict or invalid data</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Last Synced</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Check size={16} />
            </span>
          </div>
          <p className="text-sm font-bold text-slate-900 mt-2">{relativeTime(lastSynced)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{formatDateTime(lastSynced)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Heartbeat Status</span>
            <span className="p-2 rounded-lg bg-brand-50 text-brand-600">
              <Wifi size={16} />
            </span>
          </div>
          <p className="text-sm font-bold text-slate-900 mt-2">{relativeTime(lastHeartbeat)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{formatDateTime(lastHeartbeat)}</p>
        </div>
      </div>

      {/* Sync Control Actions Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Replication Controls</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-sync runs in background every 45s when online. You can also trigger manual pulls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePull}
            disabled={isBusy || !isOnline}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowDownToLine size={14} />
            <span>Pull Server Changes</span>
          </button>

          <button
            type="button"
            onClick={() => void checkConnection(true)}
            disabled={isBusy || !isOnline}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Wifi size={14} />
            <span>Ping Heartbeat</span>
          </button>

          {syncedCount > 0 && (
            <button
              type="button"
              onClick={handleClearSynced}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              <span>Clear Synced Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline Queue Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Local Offline Queue</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Persistent browser IndexedDB buffer for this device
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(["all", "pending", "failed", "synced"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${
                  filterStatus === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {key} ({key === "all" ? pendingItems.length : key === "pending" ? pendingCount : key === "failed" ? failedCount : syncedCount})
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Queue is completely clear</p>
            <p className="text-xs text-slate-400">
              No local offline operations pending in this filter category.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Operation</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">Origin Time</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const badgeColor = getEntityBadgeColor(item.entity);
                  return (
                    <tr key={item.id ?? item.idempotencyKey} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`p-2 rounded-lg border shrink-0 ${badgeColor}`}>
                            {getEntityIcon(item.entity)}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 capitalize">
                              {item.action} {item.entity}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Key: {item.idempotencyKey.slice(0, 8)}…
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        {itemDescription(item)}
                        {item.lastError && (
                          <span className="block text-rose-600 font-normal text-[11px] mt-0.5">
                            {item.lastError}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-slate-500">
                        {formatDateTime(item.originTimestamp)}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            item.status === "synced"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : item.status === "failed"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectItem(item)}
                            title="Inspect Payload"
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Info size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingRemoval(item)}
                            title="Discard Local Item"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Inspection Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-lg border ${getEntityBadgeColor(inspectItem.entity)}`}>
                  {getEntityIcon(inspectItem.entity)}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 capitalize">
                    {inspectItem.action} {inspectItem.entity} Payload
                  </h3>
                  <p className="text-[11px] text-slate-400">Idempotency: {inspectItem.idempotencyKey}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 custom-scrollbar">
              {JSON.stringify(inspectItem.payload, null, 2)}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingRemoval)}
        title="Discard Offline Change"
        description={pendingRemoval ? `Discard this ${pendingRemoval.entity} mutation from this device? It will not be synchronized to the cloud.` : ""}
        confirmText="Discard Mutation"
        cancelText="Keep"
        variant="warning"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoval(null)}
      />
    </main>
  );
}
