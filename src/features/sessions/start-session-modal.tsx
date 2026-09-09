"use client";

import { useEffect, useState } from "react";

import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { fetchBranches } from "@/lib/api/branch";
import { toast } from "@/lib/toast";
import { getActiveOfflineBranchId } from "@/lib/sync/offline-db";

import { sessionApi } from "./session-api";
import type { ActiveSession, Customer, TableOption } from "./types";

interface StartSessionModalProps {
  open: boolean;
  onClose: () => void;
  onStarted: (session?: ActiveSession) => void | Promise<void>;
}

function formatRate(table: TableOption) {
  const amount = Number(table.defaultHourlyRate);
  if (!Number.isFinite(amount)) return "Rate unavailable";
  if (!table.currency) return `${amount.toFixed(2)}/hr`;

  try {
    return `${new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: table.currency,
      maximumFractionDigits: 2,
    }).format(amount)}/hr`;
  } catch {
    return `${table.currency} ${amount.toFixed(2)}/hr`;
  }
}

export function StartSessionModal({
  open,
  onClose,
  onStarted,
}: StartSessionModalProps) {
  const isOnline = useOnlineStatus();
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [tables, setTables] = useState<TableOption[]>([]);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tableId, setTableId] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!isOnline) {
      setSelectedBranchId(getActiveOfflineBranchId() || "offline-branch");
    }
    void fetchBranches({ limit: 100 })
      .then((result) => {
        const list = result.branches.map((branch) => ({
          id: branch.id,
          name: branch.name || "Unnamed branch",
        }));
        setBranches(list);
        if (list.length > 0) {
          setSelectedBranchId((current) => current || list[0].id);
        }
      })
      .catch(() => setBranches([]));
  }, [open]);

  useEffect(() => {
    if (!open || !selectedBranchId) return;

    let cancelled = false;
    setError("");
    void sessionApi
      .tables(selectedBranchId)
      .then((nextTables) => {
        if (!cancelled) setTables(nextTables);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load available tables",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline, open, selectedBranchId]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (walkIn || trimmedQuery.length === 0 || !isOnline) {
      setCustomers([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void sessionApi
        .customers(trimmedQuery)
        .then((nextCustomers) => {
          if (!cancelled) setCustomers(nextCustomers);
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setError(
              searchError instanceof Error
                ? searchError.message
                : "Customer search failed",
            );
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOnline, query, walkIn]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const started = await sessionApi.start({
        branchId: selectedBranchId || undefined,
        tableId,
        customerId: walkIn ? null : customerId,
      });
      await onStarted(started);
      if (!isOnline || "offlineQueued" in started) toast.info("Saved offline. Action queued for sync.");
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not start session",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-session-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="start-session-title" className="text-xl font-semibold">
            Start session
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close start session dialog"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium">
          Branch
          <select
            className="mt-1 w-full rounded-lg border p-3"
            value={selectedBranchId}
            onChange={(event) => {
              setSelectedBranchId(event.target.value);
              setTableId("");
            }}
            disabled={busy}
          >
            {branches.length === 0 ? (
              <option value="">No branches available</option>
            ) : (
              branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium">
          Table
          <select
            className="mt-1 w-full rounded-lg border p-3"
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            disabled={busy || !selectedBranchId}
          >
            <option value="">{tables.length === 0 ? "No tables found in this branch" : "Select an available table"}</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                Table {table.tableNumber} — {formatRate(table)}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={walkIn}
            onChange={(event) => {
              setWalkIn(event.target.checked);
              setCustomerId(null);
            }}
            disabled={busy}
          />
          Walk-in customer
        </label>

        {!walkIn && (
          <div className="mt-4">
            <input
              className="w-full rounded-lg border p-3"
              placeholder="Search name or phone"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={busy || !isOnline}
            />
            <div className="mt-2 max-h-36 overflow-auto rounded-lg border">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setCustomerId(customer.id)}
                  className={`block w-full p-3 text-left text-sm ${
                    customerId === customer.id
                      ? "bg-brand-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <strong>{customer.fullName}</strong>
                  <br />
                  {customer.phone}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isOnline && <p className="mt-3 text-sm text-amber-700">Offline Mode active. Actions are saved locally and will synchronize when connection returns.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={
            !tableId ||
            (!walkIn && !customerId) ||
            busy
          }
          onClick={() => void submit()}
          className="mt-6 w-full rounded-lg bg-brand-600 p-3 font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Starting…" : "Start timer"}
        </button>
      </div>
    </div>
  );
}
