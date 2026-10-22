"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranchCurrency } from "@/features/tenancy/useBranchCurrency";
import { formatCurrency } from "@/features/invoice/utils/formatCurrency";
import { ASSIGNED_BRANCHES_CHANGED_EVENT } from "@/features/tenancy/branch-switching";
import { tokenStorage } from "@/lib/auth/session";
import { isNetworkFailure } from "@/lib/sync/offline-reference-cache";
import { fetchCashReconciliation } from "@/features/reporting/api";
import type { CashReconciliation } from "@/features/reporting/types";

// Browser-local calendar date as YYYY-MM-DD.
function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ackStorageKey(branchId: string, dateKey: string) {
  return `cuecloud:cash-recon-ack:${branchId}:${dateKey}`;
}

export function CashReconciliationCard() {
  const currency = useBranchCurrency();
  const money = (value: unknown) => formatCurrency(Number(value ?? 0), currency);

  const [branchId, setBranchId] = useState(() => tokenStorage.getAccessContext()?.branchId ?? "");
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [today, setToday] = useState<CashReconciliation | null>(null);
  const [previous, setPrevious] = useState<CashReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewDay, setIsNewDay] = useState(false);

  const [openingInput, setOpeningInput] = useState("");
  const [countedInput, setCountedInput] = useState("");
  const [result, setResult] = useState<CashReconciliation | null>(null);
  const [checking, setChecking] = useState(false);
  const reconciliationHref = "/reporting?tab=cash-reconciliation";

  useEffect(() => {
    const updateBranch = () => setBranchId(tokenStorage.getAccessContext()?.branchId ?? "");
    window.addEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, updateBranch);
    return () => window.removeEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, updateBranch);
  }, []);

  const load = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    const now = new Date();
    const todayKey = toDateKey(now);
    const yesterdayKey = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    setLoading(true);
    setError(null);
    try {
      const [todayData, previousData] = await Promise.all([
        fetchCashReconciliation(branchId, todayKey, 0),
        fetchCashReconciliation(branchId, yesterdayKey, 0),
      ]);
      setDateKey(todayKey);
      setToday(todayData);
      setPrevious(previousData);
      setOffline(false);
      setOpeningInput((current) => (current === "" && todayData.openingCash ? String(todayData.openingCash) : current));
      try {
        setIsNewDay(window.localStorage.getItem(ackStorageKey(branchId, todayKey)) !== "1");
      } catch {
        setIsNewDay(false);
      }
    } catch (cause) {
      if (isNetworkFailure(cause)) setOffline(true);
      else setError(cause instanceof Error ? cause.message : "Failed to load cash reconciliation.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
    const revalidate = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [load]);

  const acknowledgeNewDay = () => {
    setIsNewDay(false);
    try {
      window.localStorage.setItem(ackStorageKey(branchId, dateKey), "1");
    } catch {
      // Storage can be blocked; the badge simply returns on next load.
    }
  };

  const handleCheck = async () => {
    const counted = Number(countedInput);
    const opening = openingInput === "" ? undefined : Number(openingInput);
    if (countedInput === "" || !Number.isFinite(counted) || counted < 0) {
      setError("Enter the counted cash amount (0 or more).");
      return;
    }
    if (opening !== undefined && (!Number.isFinite(opening) || opening < 0)) {
      setError("Opening cash must be 0 or more.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      setResult(await fetchCashReconciliation(branchId, dateKey, counted, opening));
      acknowledgeNewDay();
    } catch (cause) {
      setError(
        isNetworkFailure(cause)
          ? "You are offline. Reconnect to check cash."
          : cause instanceof Error
            ? cause.message
            : "Unable to check cash.",
      );
    } finally {
      setChecking(false);
    }
  };

  // Yesterday only needs attention if cash moved and the day was never sealed.
  const previousPending = previous && !previous.isSealed && Number(previous.cashTenderTotal ?? 0) > 0;
  const cashCollected = today?.cashTenderTotal ?? 0;
  const openingValue = openingInput === "" ? Number(today?.openingCash ?? 0) : Number(openingInput) || 0;
  const expectedCash = openingValue + Number(cashCollected);

  if (!branchId) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-50">
            <Banknote className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              Cash Reconciliation
              {isNewDay && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600">New day</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">Business date {dateKey}: compare expected cash with the drawer count.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isNewDay && (
            <Button variant="secondary" onClick={acknowledgeNewDay} className="w-auto px-3 py-2 text-xs">
              Got it
            </Button>
          )}
          <Button variant="secondary" onClick={() => void load()} className="w-auto px-3 py-2" aria-label="Refresh cash reconciliation">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {offline && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          You are offline. Cash reconciliation needs a connection and will load when it returns.
        </p>
      )}

      {previousPending && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Previous day ({previous?.date}) had {money(previous?.cashTenderTotal)} cash collected and is not sealed yet.
          </span>
          <Link href={reconciliationHref} className="font-semibold underline">
            Review in Reports
          </Link>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{error}</p>}

      {!offline && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Opening cash
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash collected</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{loading ? "..." : money(cashCollected)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Expected in drawer</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{loading ? "..." : money(expectedCash)}</p>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Counted cash
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={countedInput}
                onChange={(e) => setCountedInput(e.target.value)}
                placeholder="Enter counted cash"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => void handleCheck()} isLoading={checking} className="w-auto px-5 py-2">
              Check cash
            </Button>
            <Link href={reconciliationHref} className="text-xs font-semibold text-brand-600 hover:underline">
              Open full reconciliation and sealing
            </Link>
          </div>

          {result && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold ${
                result.hasDiscrepancy ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {result.hasDiscrepancy ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {result.hasDiscrepancy
                ? `Discrepancy of ${money(result.discrepancy)} (counted ${money(result.actualCashCounted)} vs expected ${money(result.expectedCash)})`
                : `Cash matches. Counted ${money(result.actualCashCounted)}.`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
