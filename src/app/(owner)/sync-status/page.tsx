"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  getPendingSyncItems,
  markItemAsFailed,
  markItemsAsSynced,
  removePendingQueueItem,
  seedReviewSyncItems,
  type InvoiceOfflinePayload,
  type PendingSyncItem,
  type SessionOfflinePayload,
} from "@/lib/sync/offline-db";
import {
  getServerTime,
  pullSyncChanges,
  pushSyncChanges,
  sendHeartbeat,
  type HeartbeatResponse,
} from "@/services/sync.service";
import { AUTHENTICATED_HEARTBEAT_EVENT } from "@/components/sync/authenticated-heartbeat";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useAuth } from "@/lib/auth/auth-context";
import { tokenStorage } from "@/lib/auth/session";

type ActiveAction = "push" | "pull" | "connection" | "remove" | null;

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

function itemDescription(item: PendingSyncItem) {
  if (item.entity === "session") {
    const payload = item.payload as SessionOfflinePayload;
    return `${payload.status} session${payload.appliedHourlyRate ? ` · rate ${payload.appliedHourlyRate}/hr` : ""}`;
  }

  const payload = item.payload as InvoiceOfflinePayload;
  return `${payload.invoiceNumber ? `Invoice ${payload.invoiceNumber}` : "Unnumbered invoice"}${payload.total ? ` · total ${payload.total}` : ""}`;
}

export default function SyncStatusPage() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();
  const isOnline = useOnlineStatus();
  const accessContext = tokenStorage.getAccessContext();
  const syncDeviceId = isAuthenticated
    ? accessContext?.deviceId
    : null;
  const syncBranchId = isAuthenticated
    ? user?.branchId
    : null;
  const isReviewAccount =
    process.env.NODE_ENV === "development" &&
    user?.email?.toLowerCase() === "reviewer@cuecloud.local";
  const [pendingItems, setPendingItems] = useState<PendingSyncItem[]>([]);
  const [pulledChanges, setPulledChanges] = useState(0);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const loadQueue = useCallback(async () => {
    const items = await getPendingSyncItems();
    setPendingItems(items.sort((a, b) => b.originTimestamp.localeCompare(a.originTimestamp)));
  }, []);

  const checkConnection = useCallback(async (showProgress = false) => {
    if (authLoading) return;
    if (showProgress) setActiveAction("connection");
    setError("");

    try {
      const time = await getServerTime();
      setServerTime(time.serverTime);

      if (
        !isAuthenticated ||
        !syncDeviceId ||
        !syncBranchId
      ) {
        throw new Error(
          "Sign in again to establish the device and branch sync context.",
        );
      }

      const heartbeat = await sendHeartbeat(syncDeviceId, syncBranchId);
      setLastHeartbeat(heartbeat.lastHeartbeatAt);
    } catch (connectionError) {
      setError(getErrorMessage(connectionError, "The sync service could not be reached."));
    } finally {
      if (showProgress) setActiveAction(null);
    }
  }, [
    authLoading,
    isAuthenticated,
    syncBranchId,
    syncDeviceId,
  ]);

  const handlePush = async () => {
    setActiveAction("push");
    setError("");
    setNotice("");

    try {
      if (!navigator.onLine) throw new Error("You are offline. Pending work remains safe on this device.");
      if (!syncDeviceId) throw new Error("This device is not configured for synchronization.");

      const items = await getPendingSyncItems();
      if (items.length === 0) {
        setNotice("Everything is already synchronized.");
        return;
      }

      const response = await pushSyncChanges(
        syncDeviceId,
        items.map((item) => ({
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
      const acceptedIds = items
        .filter((item) => acceptedKeys.has(item.idempotencyKey))
        .map((item) => item.id)
        .filter((id): id is number => typeof id === "number");

      await markItemsAsSynced(acceptedIds);

      for (const item of items.filter((entry) => !acceptedKeys.has(entry.idempotencyKey))) {
        if (typeof item.id === "number") {
          const rejection = rejectedByKey.get(item.idempotencyKey);
          await markItemAsFailed(
            item.id,
            rejection?.error ??
              "The server rejected this local change.",
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
      if (!navigator.onLine) throw new Error("Reconnect to retrieve the latest server changes.");
      if (!syncDeviceId) throw new Error("This device is not configured for synchronization.");

      const response = await pullSyncChanges(syncDeviceId, lastSynced ?? undefined);
      setPulledChanges(response.changeCount);
      setLastSynced(response.serverTime);
      setNotice(
        response.changeCount
          ? `${response.changeCount} ${response.changeCount === 1 ? "change" : "changes"} received from the server.`
          : "This device already has the latest server changes.",
      );
    } catch (pullError) {
      setError(getErrorMessage(pullError, "Server changes could not be retrieved."));
    } finally {
      setActiveAction(null);
    }
  };

  const handleRemove = async (item: PendingSyncItem) => {
    if (typeof item.id !== "number") return;
    if (!window.confirm(`Discard this pending ${item.entity} change from this device?`)) return;

    setActiveAction("remove");
    await removePendingQueueItem(item.id);
    await loadQueue();
    setNotice("The local pending change was removed.");
    setActiveAction(null);
  };

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (
      !isReviewAccount ||
      !user ||
      !syncDeviceId ||
      !syncBranchId
    ) {
      return;
    }

    let cancelled = false;
    void seedReviewSyncItems({
      branchId: syncBranchId,
      userId: user.id,
      deviceId: syncDeviceId,
    })
      .then((seeded) => {
        if (!cancelled && seeded) return loadQueue();
      })
      .catch((seedError: unknown) => {
        if (!cancelled) {
          setError(
            getErrorMessage(
              seedError,
              "Review sync examples could not be prepared.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isReviewAccount,
    loadQueue,
    syncBranchId,
    syncDeviceId,
    user,
  ]);

  useEffect(() => {
    if (!isOnline) return;

    let cancelled = false;
    void getServerTime()
      .then((time) => {
        if (!cancelled) setServerTime(time.serverTime);
      })
      .catch((connectionError: unknown) => {
        if (!cancelled) {
          setError(
            getErrorMessage(
              connectionError,
              "The sync service could not be reached.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    const onHeartbeat = (event: Event) => {
      const heartbeat = (
        event as CustomEvent<HeartbeatResponse>
      ).detail;
      if (
        heartbeat.deviceId === syncDeviceId &&
        heartbeat.branchId === syncBranchId
      ) {
        setLastHeartbeat(heartbeat.lastHeartbeatAt);
      }
    };

    window.addEventListener(
      AUTHENTICATED_HEARTBEAT_EVENT,
      onHeartbeat,
    );
    return () => {
      window.removeEventListener(
        AUTHENTICATED_HEARTBEAT_EVENT,
        onHeartbeat,
      );
    };
  }, [syncBranchId, syncDeviceId]);

  const isBusy = activeAction !== null;
  const failedCount = pendingItems.filter((item) => item.status === "failed").length;
  const status = error ? "attention" : !isOnline ? "offline" : pendingItems.length ? "pending" : "ready";
  const statusStyles = {
    attention: "border-red-200 bg-red-50 text-red-800",
    offline: "border-amber-200 bg-amber-50 text-amber-800",
    pending: "border-blue-200 bg-blue-50 text-blue-800",
    ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[status];
  const statusCopy = {
    attention: ["Sync needs attention", error],
    offline: ["Working offline", "Changes stay on this device until the connection returns."],
    pending: ["Changes are waiting", `${pendingItems.length} local ${pendingItems.length === 1 ? "change is" : "changes are"} ready to send.`],
    ready: ["Everything is up to date", "The device is connected and the local sync queue is clear."],
  }[status];

  return (
    <main className="mx-auto w-full max-w-6xl pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Device &amp; data</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Synchronization</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Monitor locally saved session and invoice changes, then exchange them securely with CueCloud.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
          {isOnline ? "Network available" : "Offline mode"}
        </div>
      </div>

      <section className={`mt-7 rounded-2xl border p-5 shadow-sm ${statusStyles}`} aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
            {status === "attention" ? <AlertTriangle size={21} /> : status === "offline" ? <WifiOff size={21} /> : status === "ready" ? <Check size={22} /> : <Cloud size={21} />}
          </span>
          <div>
            <h2 className="font-bold text-slate-950">{statusCopy[0]}</h2>
            <p className="mt-1 text-sm leading-6">{statusCopy[1]}</p>
          </div>
        </div>
      </section>

      {notice && !error && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
          <Check size={18} /> {notice}
        </div>
      )}

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Sync summary">
        <SummaryCard icon={<ArrowUpFromLine />} label="Waiting to send" value={String(pendingItems.length)} detail={failedCount ? `${failedCount} need review` : "From Sessions and Billing"} />
        <SummaryCard icon={<ArrowDownToLine />} label="Last received" value={String(pulledChanges)} detail="Changes from the server" />
        <SummaryCard icon={<CircleGauge />} label="Last sync" value={relativeTime(lastSynced)} detail={formatDateTime(lastSynced)} />
        <SummaryCard icon={<Wifi />} label="Last heartbeat" value={relativeTime(lastHeartbeat)} detail={formatDateTime(lastHeartbeat)} />
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Data exchange</h2>
            <p className="mt-1 text-sm text-slate-600">Send local work or retrieve changes made on other devices.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionButton onClick={handlePush} disabled={isBusy || !isOnline || pendingItems.length === 0} primary icon={<ArrowUpFromLine size={17} />} loading={activeAction === "push"}>
              Sync pending changes
            </ActionButton>
            <ActionButton onClick={handlePull} disabled={isBusy || !isOnline} icon={<ArrowDownToLine size={17} />} loading={activeAction === "pull"}>
              Get latest changes
            </ActionButton>
            <ActionButton onClick={() => void checkConnection(true)} disabled={isBusy || !isOnline} icon={<Wifi size={17} />} loading={activeAction === "connection"}>
              Check connection
            </ActionButton>
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-xs text-slate-500 sm:grid-cols-2">
          <p className="flex items-center gap-2"><ArrowUpFromLine size={14} className="text-emerald-600" /> Sync uses <code className="rounded bg-slate-100 px-1.5 py-0.5">POST /sync/push</code></p>
          <p className="flex items-center gap-2"><ArrowDownToLine size={14} className="text-blue-600" /> Latest changes use <code className="rounded bg-slate-100 px-1.5 py-0.5">GET /sync/pull</code></p>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-bold text-slate-950">Pending module changes</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isReviewAccount
                ? "Two development-only examples are included for reviewer walkthroughs."
                : "Only real locally queued records appear here—no sample data is generated."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/sessions" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sessions</Link>
            <Link href="/billing" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Billing</Link>
          </div>
        </div>

        {pendingItems.length === 0 ? (
          <div className="border-t border-slate-200 px-6 py-12 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check size={21} /></span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">No local changes waiting</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Session and invoice changes saved for synchronization will be listed here with their source and status.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {pendingItems.map((item) => (
              <li key={item.id ?? item.idempotencyKey} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.entity === "session" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
                    {item.entity === "session" ? <Timer size={19} /> : <FileText size={19} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold capitalize text-slate-900">{item.action} {item.entity}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.status === "failed" ? "Needs review" : "Waiting"}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{itemDescription(item)} · {formatDateTime(item.originTimestamp)}</p>
                    {item.lastError && <p className="mt-1 text-xs font-medium text-red-600">{item.lastError}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Link href={item.entity === "session" ? "/sessions" : "/billing"} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Open module</Link>
                  <button type="button" onClick={() => void handleRemove(item)} disabled={activeAction === "remove"} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Discard pending ${item.entity} change`} title="Discard local change"><Trash2 size={17} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="group mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5 sm:px-6">
          <div className="flex items-center gap-3"><Database size={19} className="text-slate-500" /><div><h2 className="text-sm font-bold text-slate-900">Connection details</h2><p className="mt-0.5 text-xs text-slate-500">Server timing and device configuration</p></div></div>
          <ChevronDown size={18} className="text-slate-400 transition group-open:rotate-180" />
        </summary>
        <dl className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Server time" value={formatDateTime(serverTime)} icon={<Server size={15} />} />
          <Detail label="Last heartbeat" value={formatDateTime(lastHeartbeat)} icon={<Wifi size={15} />} />
          <Detail label="Device" value={syncDeviceId ? `Configured ···${syncDeviceId.slice(-6)}` : "Not configured"} icon={<CircleGauge size={15} />} />
          <Detail label="Branch" value={syncBranchId ? `Configured ···${syncBranchId.slice(-6)}` : "Not configured"} icon={<Database size={15} />} />
        </dl>
      </details>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{label}</p><span className="rounded-lg bg-slate-100 p-2 text-slate-600">{icon}</span></div>
      <p className="mt-4 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500" title={detail}>{detail}</p>
    </article>
  );
}

function ActionButton({ children, icon, loading, primary = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; loading: boolean; primary?: boolean }) {
  return (
    <button {...props} type="button" className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${primary ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {loading ? <RefreshCw size={17} className="animate-spin" /> : icon}{children}
    </button>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="bg-white p-5"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">{icon}{label}</dt><dd className="mt-2 truncate text-sm font-semibold text-slate-900" title={value}>{value}</dd></div>;
}
