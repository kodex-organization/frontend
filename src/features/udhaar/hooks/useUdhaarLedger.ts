"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { tokenStorage } from "@/lib/auth/session";
import {
  cacheScopedJson,
  isNetworkFailure,
  readScopedJson,
} from "@/lib/sync/offline-reference-cache";
import { toast } from "@/lib/toast";
import {
  createUdhaarAdjustment,
  getThresholds,
  getUdhaarAging,
  getUdhaarCustomers,
  getUdhaarStatement,
  recordSettlement,
  updateThresholds,
  type UdhaarAgingSummary,
  type UdhaarCustomerSummary,
  type UdhaarStatementEntry,
  type UdhaarThresholdSettings,
} from "../api/udhaarApi";
import {
  applyPendingToAging,
  applyPendingToCustomers,
  getPendingUdhaarEntries,
  pendingStatementEntries,
  queueOfflineAdjustment,
  queueOfflineSettlement,
} from "../offline-ledger";

type LedgerStatement = { customerId: string; from: string; to: string; entries: UdhaarStatementEntry[] };

/** The last real server answer, kept on this device for offline use. */
type LedgerSnapshot = {
  customers: UdhaarCustomerSummary[];
  aging: UdhaarAgingSummary | null;
};

// This app event is fired by the sync manager after every sync attempt.
const SYNC_STATUS_EVENT = "cuecloud:sync-status-changed";

// The server answers per active branch, so the saved copies are per branch too.
const branchScope = () => tokenStorage.getAccessContext()?.branchId ?? "default";
const ledgerCacheName = () => `udhaar-ledger:${branchScope()}`;
const thresholdCacheName = () => `udhaar-thresholds:${branchScope()}`;
const statementCacheName = (customerId: string, from: string, to: string) =>
  `udhaar-statement:${branchScope()}:${customerId}:${from}:${to}`;

const isBrowserOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

/**
 * The date pickers give "2026-10-01". The server reads that as midnight, which
 * would cut off the whole last day. Send the full local day instead.
 */
function toServerRange(from: string, to: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  return {
    from: dateOnly.test(from) ? new Date(`${from}T00:00:00`).toISOString() : from,
    to: dateOnly.test(to) ? new Date(`${to}T23:59:59.999`).toISOString() : to,
  };
}

export function useUdhaarLedger() {
  const [customers, setCustomers] = useState<UdhaarCustomerSummary[]>([]);
  const [aging, setAging] = useState<UdhaarAgingSummary | null>(null);
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  // Set when the screen shows the last saved ledger because the server is unreachable.
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  // Entries saved on this device that the server has not received yet.
  const [pendingCount, setPendingCount] = useState(0);

  // Untouched server data (before waiting entries are added on top).
  const rawRef = useRef<{ snapshot: LedgerSnapshot; savedAt: string | null } | null>(null);
  const pendingCountRef = useRef(0);
  const snapshotAtRef = useRef<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus = status === "all" || customer.status === status;
      const matchesQuery = !query || `${customer.fullName ?? ""} ${customer.phone ?? ""}`.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [customers, search, status]);

  /** Screen = server data + entries still waiting to sync. */
  const showLedger = async (snapshot: LedgerSnapshot, savedAt: string | null) => {
    rawRef.current = { snapshot, savedAt };
    const pending = await getPendingUdhaarEntries();
    const merged = applyPendingToCustomers(snapshot.customers, pending);
    setCustomers(merged);
    setAging(applyPendingToAging(snapshot.aging, snapshot.customers, merged, pending));
    setSnapshotAt(savedAt);
    snapshotAtRef.current = savedAt;
    setPendingCount(pending.length);
    pendingCountRef.current = pending.length;
  };

  /** Re-draw from the data we already have (used right after saving an entry offline). */
  const rebuild = async () => {
    if (rawRef.current) {
      await showLedger(rawRef.current.snapshot, rawRef.current.savedAt);
    }
  };

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const [customerData, agingData] = await Promise.all([getUdhaarCustomers(search, status), getUdhaarAging()]);
      const snapshot: LedgerSnapshot = { customers: customerData, aging: agingData };
      // Save only the full, unfiltered list (the screen filters it again by itself).
      if (!search.trim() && status === "all") {
        void cacheScopedJson<LedgerSnapshot>(ledgerCacheName(), snapshot);
      }
      await showLedger(snapshot, null);
    } catch (requestError) {
      if (isNetworkFailure(requestError)) {
        // Offline / server down: show the last ledger saved while online.
        const saved = await readScopedJson<LedgerSnapshot>(ledgerCacheName());
        if (saved) {
          await showLedger(saved.data, saved.savedAt);
          return;
        }
        if (!silent) {
          setError(
            "You are offline and no saved Udhaar data exists on this device yet. Open the Udhaar Ledger once while online, then it will be available offline.",
          );
        }
        return;
      }
      if (!silent) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load udhaar ledger.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadStatement = async (customerId: string, from: string, to: string) => {
    const withWaitingEntries = async (entries: UdhaarStatementEntry[]) => {
      const range = toServerRange(from, to);
      const pending = await getPendingUdhaarEntries();
      const known = new Set(entries.map((entry) => entry.id));
      const extra = pendingStatementEntries(customerId, range.from, range.to, pending).filter(
        (entry) => !known.has(entry.id),
      );
      return [...entries, ...extra].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    };

    try {
      const range = toServerRange(from, to);
      const result = await getUdhaarStatement(customerId, range.from, range.to);
      void cacheScopedJson<LedgerStatement>(statementCacheName(customerId, from, to), result);
      setStatement({ customerId, from, to, entries: await withWaitingEntries(result.entries) });
    } catch (requestError) {
      if (isNetworkFailure(requestError)) {
        const saved = await readScopedJson<LedgerStatement>(statementCacheName(customerId, from, to));
        if (saved) {
          setStatement({ customerId, from, to, entries: await withWaitingEntries(saved.data.entries) });
          toast.warning(`Offline: showing the statement saved on ${new Date(saved.savedAt).toLocaleString()}.`);
        } else {
          // Do not replace the whole ledger with an error page just for this.
          toast.warning("You are offline. This statement was not saved earlier, so it needs a connection.");
        }
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Unable to load customer statement.");
    }
  };

  /**
   * Customer pays back udhaar (SRS 3.7: partial settlement allowed, credit entry).
   * Online -> server. Offline / server down -> saved here and synced later.
   */
  const recordLedgerSettlement = async (input: {
    customerId: string;
    amount: number;
    reason: string;
  }): Promise<{ mode: "online" | "offline" }> => {
    const customer = customers.find((item) => item.id === input.customerId);
    if (customer && input.amount > customer.outstandingBalance + 0.001) {
      throw new Error("Settlement exceeds outstanding balance");
    }

    // Keep the order: if this customer already has entries waiting, queue behind them.
    const waiting = (await getPendingUdhaarEntries()).some((entry) => entry.customerId === input.customerId);
    if (!isBrowserOffline() && !waiting) {
      try {
        await recordSettlement(input);
        await refresh(true);
        return { mode: "online" };
      } catch (requestError) {
        if (!isNetworkFailure(requestError)) throw requestError;
      }
    }

    await queueOfflineSettlement(input);
    await rebuild();
    return { mode: "offline" };
  };

  const addAdjustment = async (payload: { customerId: string; amount: number; reason: string; approvedById?: string | null; approvedByPin?: string | null }) => {
    const saveOffline = async () => {
      // The signed-in owner/manager approves; no PIN is stored on the device.
      await queueOfflineAdjustment({
        customerId: payload.customerId,
        amount: payload.amount,
        reason: payload.reason,
      });
      await rebuild();
      toast.success("Adjustment saved on this device. It will sync when the connection returns.");
      return true;
    };

    try {
      const waiting = (await getPendingUdhaarEntries()).some((entry) => entry.customerId === payload.customerId);
      if (isBrowserOffline() || waiting) return await saveOffline();

      await createUdhaarAdjustment(payload);
      await refresh();
      return true;
    } catch (requestError) {
      if (isNetworkFailure(requestError)) return saveOffline();
      setError(requestError instanceof Error ? requestError.message : "Unable to save adjustment.");
      return false;
    }
  };

  /** Credit limits: readable offline (saved copy), changeable only online. */
  const loadThresholds = async (): Promise<UdhaarThresholdSettings> => {
    try {
      const current = await getThresholds();
      void cacheScopedJson<UdhaarThresholdSettings>(thresholdCacheName(), current);
      return current;
    } catch (requestError) {
      if (!isNetworkFailure(requestError)) throw requestError;
      const saved = await readScopedJson<UdhaarThresholdSettings>(thresholdCacheName());
      if (saved) {
        toast.warning("Offline: showing the credit limits saved on this device.");
        return saved.data;
      }
      throw new Error("You are offline and the credit limits were never saved on this device.");
    }
  };

  const saveThresholds = async (payload: UdhaarThresholdSettings) => {
    try {
      const saved = await updateThresholds(payload);
      void cacheScopedJson<UdhaarThresholdSettings>(thresholdCacheName(), saved);
      return saved;
    } catch (requestError) {
      if (isNetworkFailure(requestError)) {
        // Limits apply to every device of the club, so they need the server.
        throw new Error("You are offline. Credit limits can only be changed with a connection.");
      }
      throw requestError;
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After every sync attempt, reload the real data if we were showing saved/waiting data.
  useEffect(() => {
    const onSync = () => {
      if (snapshotAtRef.current || pendingCountRef.current > 0) void refresh(true);
    };
    const onBackOnline = () => void refresh(true);
    window.addEventListener(SYNC_STATUS_EVENT, onSync);
    window.addEventListener("online", onBackOnline);
    return () => {
      window.removeEventListener(SYNC_STATUS_EVENT, onSync);
      window.removeEventListener("online", onBackOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return {
    customers,
    filteredCustomers,
    aging,
    statement,
    loading,
    error,
    snapshotAt,
    pendingCount,
    search,
    setSearch,
    status,
    setStatus,
    refresh,
    loadStatement,
    addAdjustment,
    recordLedgerSettlement,
    loadThresholds,
    saveThresholds,
  };
}
