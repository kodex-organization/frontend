"use client";

import { useEffect, useState } from "react";
import {
  addDemoInvoiceQueueItem,
  addDemoSessionQueueItem,
  clearPendingQueue,
  getPendingSyncCount,
  getPendingSyncItems,
  markItemsAsSynced,
} from "@/lib/sync/offline-db";
import {
  getServerTime,
  pullSyncChanges,
  pushSyncChanges,
  sendHeartbeat,
} from "@/services/sync.service";

const syncDeviceId = process.env.NEXT_PUBLIC_SYNC_DEVICE_ID;
const syncBranchId = process.env.NEXT_PUBLIC_SYNC_BRANCH_ID;

export default function SyncStatusPage() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pulledChanges, setPulledChanges] = useState(0);
  const [serverTime, setServerTime] = useState("Not fetched yet");
  const [lastHeartbeat, setLastHeartbeat] = useState("Not sent yet");
  const [lastSynced, setLastSynced] = useState("Not synced yet");
  const [error, setError] = useState("");

  const loadPendingCount = async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  };

  const loadServerTime = async () => {
    try {
      setError("");

      const response = await getServerTime();

      setServerTime(response.data.serverTime);
    } catch {
      setError(
        "Unable to fetch server time. Make sure backend is running.",
      );
    }
  };

  const handleHeartbeat = async () => {
    try {
      setError("");

      if (!syncDeviceId || !syncBranchId) {
        setError(
          "Sync device or branch configuration is missing.",
        );
        return;
      }

      const response = await sendHeartbeat(
        syncDeviceId,
        syncBranchId,
      );

      setLastHeartbeat(response.data.lastHeartbeatAt);
    } catch {
      setError(
        "Unable to send heartbeat. Make sure backend and sync configuration are available.",
      );
    }
  };

  const handleRetrySync = async () => {
    try {
      setError("");

      if (!navigator.onLine) {
        setError(
          "You are offline. Sync will run when internet returns.",
        );
        return;
      }

      if (!syncDeviceId) {
        setError("Sync device configuration is missing.");
        return;
      }

      const pendingItems = await getPendingSyncItems();

      if (pendingItems.length === 0) {
        setError("No pending items to sync.");
        return;
      }

      const changes = pendingItems.map((item) => ({
        idempotencyKey: item.idempotencyKey,
        entityType: item.entity,
        entityId: item.entityId,
        action: item.action,
        payload: item.payload,
        originTimestamp: item.originTimestamp,
      }));

      const response = await pushSyncChanges(
        syncDeviceId,
        changes,
      );

      const itemIds = pendingItems
        .map((item) => item.id)
        .filter(
          (id): id is number => typeof id === "number",
        );

      await markItemsAsSynced(itemIds);
      await loadPendingCount();

      setLastSynced(response.data.serverTime);
    } catch {
      setError(
        "Unable to sync pending items. Make sure backend is running.",
      );
    }
  };

  const handlePullSync = async () => {
    try {
      setError("");

      if (!navigator.onLine) {
        setError(
          "You are offline. Cannot pull server changes.",
        );
        return;
      }

      if (!syncDeviceId) {
        setError("Sync device configuration is missing.");
        return;
      }

      const response = await pullSyncChanges(
        syncDeviceId,
        lastSynced === "Not synced yet"
          ? undefined
          : lastSynced,
      );

      setPulledChanges(response.data.changeCount);
      setLastSynced(response.data.serverTime);
    } catch {
      setError(
        "Unable to pull sync changes. Make sure backend is running.",
      );
    }
  };

  const handleAddDemoSession = async () => {
    try {
      setError("");

      await addDemoSessionQueueItem();
      await loadPendingCount();
    } catch {
      setError("Unable to add session to offline queue.");
    }
  };

  const handleAddDemoInvoice = async () => {
    try {
      setError("");

      await addDemoInvoiceQueueItem();
      await loadPendingCount();
    } catch {
      setError("Unable to add invoice to offline queue.");
    }
  };

  const handleClearQueue = async () => {
    await clearPendingQueue();
    await loadPendingCount();

    setPulledChanges(0);
    setLastSynced("Not synced yet");
    setError("");
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      loadServerTime();
      handleHeartbeat();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    setIsOnline(navigator.onLine);
    loadPendingCount();

    if (navigator.onLine) {
      loadServerTime();
      handleHeartbeat();
    }

    const heartbeatInterval = window.setInterval(() => {
      if (navigator.onLine) {
        handleHeartbeat();
      }
    }, 60000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearInterval(heartbeatInterval);

      window.removeEventListener("online", handleOnline);
      window.removeEventListener(
        "offline",
        handleOffline,
      );
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Sync Status
      </h1>

      <p className="mt-2 text-sm text-slate-600">
        Offline session and invoice queue, server time, and device
        heartbeat.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Current Status:{" "}
            <span
              className={
                isOnline
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </p>

          <p>Pending Sync Items: {pendingCount}</p>

          <p>Pulled Changes: {pulledChanges}</p>

          <p>Last Synced: {lastSynced}</p>

          <p>Server Time: {serverTime}</p>

          <p>Last Heartbeat: {lastHeartbeat}</p>

          {error && (
            <p className="text-red-600">{error}</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAddDemoSession}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add Demo Session
          </button>

          <button
            type="button"
            onClick={handleAddDemoInvoice}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add Demo Invoice
          </button>

          <button
            type="button"
            onClick={handleRetrySync}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Retry Sync
          </button>

          <button
            type="button"
            onClick={handlePullSync}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Pull From Server
          </button>

          <button
            type="button"
            onClick={handleClearQueue}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Clear Queue
          </button>

          <button
            type="button"
            onClick={loadServerTime}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Refresh Server Time
          </button>

          <button
            type="button"
            onClick={handleHeartbeat}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Send Heartbeat
          </button>
        </div>
      </div>
    </div>
  );
}