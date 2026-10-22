"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/lib/toast";

import { sessionApi } from "./session-api";
import type { ActiveSession, Customer, TableOption } from "./types";
import { customerFormUrl } from "@/features/customers/customer-redirect";

interface StartSessionModalProps {
  open: boolean;
  onClose: () => void;
  onStarted: (session?: ActiveSession) => void | Promise<void>;
  defaultTableId?: string;
  initialCustomerId?: string | null;
  initialBillingType?: "hourly" | "per_game";
  initialGameCount?: number;
  returnTo?: string;
}

function formatRate(table: TableOption) {
  // Check active hourly rate first before falling back to default/base rate
  const rawAmount =
    (table as any).hourlyRate ??
    (table as any).rate ??
    (table as any).currentRate ??
    table.defaultHourlyRate;

  const amount = Number(rawAmount);
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

function getTableDisplayName(table: TableOption) {
  const identifier = table.tableNumber || (table as any).name || "";
  if (!identifier) return "Table";
  return identifier.toLowerCase().startsWith("table")
    ? identifier
    : `Table ${identifier}`;
}

export function StartSessionModal({
  open,
  onClose,
  onStarted,
  defaultTableId,
  initialCustomerId = null,
  initialBillingType = "hourly",
  initialGameCount = 1,
  returnTo = "/floor-view",
}: StartSessionModalProps) {
  const isOnline = useOnlineStatus();
  const { user } = useAuth();
  const router = useRouter();
  const selectedBranchId = user?.branchId ?? "";
  const [tables, setTables] = useState<TableOption[]>([]);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tableId, setTableId] = useState(defaultTableId ?? "");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState(true);
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  const [billingType, setBillingType] = useState<"hourly" | "per_game">(initialBillingType);
  const [gameCount, setGameCount] = useState(String(initialGameCount));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && defaultTableId) {
      setTableId(defaultTableId);
    } else if (!open) {
      setTableId("");
    }
  }, [defaultTableId, open]);

  useEffect(() => {
    if (!open) return;
    if (initialCustomerId) {
      setCustomerId(initialCustomerId);
      setWalkIn(false);
      setCreateNewCustomer(false);
    }
    setBillingType(initialBillingType);
    setGameCount(String(initialGameCount));
  }, [initialBillingType, initialCustomerId, initialGameCount, open]);

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

    if (walkIn || trimmedQuery.length === 0) {
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
      let selectedCustomerId = walkIn ? null : customerId;
      if (!tableId) throw new Error("Select an available table");
      if (!walkIn && createNewCustomer) {
        const params = new URLSearchParams({
          startSession: "1",
          tableId,
          billingType,
          returnTo,
        });
        if (billingType === "per_game") params.set("gameCount", String(Number(gameCount)));
        router.push(customerFormUrl(`${returnTo}?${params.toString()}`));
        return;
      }
      if (
        billingType === "per_game" &&
        (!Number.isInteger(Number(gameCount)) || Number(gameCount) <= 0)
      ) {
        throw new Error("Enter a valid number of games");
      }
      const started = await sessionApi.start({
        branchId: selectedBranchId || undefined,
        tableId,
        customerId: selectedCustomerId,
        billingType,
        ...(billingType === "per_game" ? { gameCount: Number(gameCount) } : {}),
      });
      await onStarted(started);
      if (!isOnline || "offlineQueued" in started) {
        toast.info("Saved offline. Action queued for sync.");
      }
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
            className="rounded p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            ×
          </button>
        </div>

        <p className="mt-5 text-sm text-slate-500">
          This session will start in the active branch shown in the header.
        </p>

        <label className="mt-4 block text-sm font-medium">
          Table
          <select
            className="mt-1 w-full rounded-lg border p-3 bg-white"
            value={tableId}
            onChange={(event) => {
              const nextTableId = event.target.value;
              setTableId(nextTableId);
              if (!tables.find((table) => table.id === nextTableId)?.perGameRate) {
                setBillingType("hourly");
              }
            }}
            disabled={busy || !selectedBranchId}
          >
            <option value="">
              {tables.length === 0
                ? "No tables found in this branch"
                : "Select an available table"}
            </option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {getTableDisplayName(table)} — {formatRate(table)}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 flex gap-2 text-sm cursor-pointer select-none">
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createNewCustomer}
                onChange={(event) => {
                  setCreateNewCustomer(event.target.checked);
                  setCustomerId(null);
                }}
                disabled={busy}
              />
              New customer in Customer Directory
            </label>
            {createNewCustomer ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Add the customer details. Session setup will continue automatically after saving.
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !tableId}
                  className="mt-3 w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? "Opening Customer Directory..." : "Add Customer in Customer Directory"}
                </button>
              </div>
            ) : (
              <>
                <input
                  className="mt-2 w-full rounded-lg border p-3"
                  placeholder="Search name or phone"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={busy}
                />
                {!isOnline && (
              <p className="mt-1 text-xs text-slate-500">
                Offline: searching customers saved on this device.
              </p>
                )}
                <div className="mt-2 max-h-36 overflow-auto rounded-lg border">
              {customers.length === 0 && query.trim() !== "" ? (
                <p className="p-3 text-xs text-slate-400">No customers found</p>
              ) : (
                customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setCustomerId(customer.id)}
                    className={`block w-full p-3 text-left text-sm cursor-pointer ${
                      customerId === customer.id
                        ? "bg-brand-50 border-l-4 border-brand-600"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <strong>{customer.fullName}</strong>
                    <br />
                    <span className="text-xs text-slate-500">{customer.phone}</span>
                  </button>
                ))
              )}
                </div>
              </>
            )}
          </div>
        )}

        <label className="mt-4 block text-sm font-medium">
          Billing
          <select
            className="mt-1 w-full rounded-lg border p-3 bg-white"
            value={billingType}
            onChange={(event) => setBillingType(event.target.value as "hourly" | "per_game")}
            disabled={busy}
          >
            <option value="hourly">Hourly</option>
            <option
              value="per_game"
              disabled={!tables.find((table) => table.id === tableId)?.perGameRate}
            >
              Per game
            </option>
          </select>
        </label>
        {billingType === "per_game" && (
          <label className="mt-3 block text-sm font-medium">
            Number of games/sets
            <input
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded-lg border p-3"
              value={gameCount}
              onChange={(event) => setGameCount(event.target.value)}
              disabled={busy}
            />
          </label>
        )}

        {!isOnline && (
          <p className="mt-3 text-sm text-amber-700">
            Offline Mode active. Actions are saved locally and will synchronize when connection returns.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={
            !tableId ||
            (!walkIn && !createNewCustomer && !customerId) ||
            busy
          }
          onClick={() => void submit()}
          className="mt-6 w-full rounded-lg bg-brand-600 p-3 font-semibold text-white disabled:opacity-40 cursor-pointer"
        >
          {busy ? "Starting…" : "Start timer"}
        </button>
      </div>
    </div>
  );
}