"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { udhaarService } from "../services/udhaarService";
import type { CustomerBalance, LedgerEntry } from "../types";
import { BalancesPanel } from "./BalancesPanel";
import { LedgerPanel } from "./LedgerPanel";
import { SettlementForm } from "./SettlementForm";
import { ThresholdSettings } from "./ThresholdSettings";

export default function UdhaarWorkspace() {
  const { user } = useAuth();
  const isOwner = user?.roles.includes("OWNER") ?? false;

  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | null
  >(null);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState("");

  const selectedCustomer = selectedCustomerId
    ? (balances.find(
        (balance) => balance.customer.id === selectedCustomerId,
      )?.customer ?? null)
    : null;

  const loadBalances = useCallback(async () => {
    setLoadingBalances(true);
    setError("");

    try {
      const list = await udhaarService.getBalances();
      setBalances(list);

      const existing = list.some(
        (balance) => balance.customer.id === selectedCustomerId,
      );

      if (!selectedCustomerId || !existing) {
        const fallback = list.find(
          (balance) => balance.outstandingBalance !== 0,
        ) ?? list[0];
        setSelectedCustomerId(fallback?.customer.id ?? null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load customer balances.",
      );
    } finally {
      setLoadingBalances(false);
    }
  }, [selectedCustomerId]);

  const loadLedger = useCallback(
    async (customerId: string) => {
      setLoadingLedger(true);
      setError("");

      try {
        const [balance, ledger] = await Promise.all([
          udhaarService.getBalance(customerId),
          udhaarService.getEntries(customerId),
        ]);
        setOutstandingBalance(balance.outstandingBalance);
        setEntries(ledger);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load the ledger.",
        );
      } finally {
        setLoadingLedger(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    if (selectedCustomerId) {
      void loadLedger(selectedCustomerId);
    }
  }, [selectedCustomerId, loadLedger]);

  async function handleSettled() {
    if (!selectedCustomerId) return;

    await loadBalances();
    await loadLedger(selectedCustomerId);
  }

  return (
    <main className="mx-auto w-full max-w-6xl pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Customer credit
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Udhaar Ledger
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Track customer credit balances, settlements, and audit-safe
            ledger entries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBalances()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">
              Customer balances
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Select a customer to view their ledger.
            </p>
          </div>

          <BalancesPanel
            balances={balances}
            selectedCustomerId={selectedCustomerId}
            onSelect={setSelectedCustomerId}
            loading={loadingBalances}
            error={error && !selectedCustomerId ? error : ""}
          />
        </section>

        <div className="flex flex-col gap-5">
          {selectedCustomer ? (
            <>
              <LedgerPanel
                customerName={selectedCustomer.fullName ?? "Customer"}
                outstandingBalance={outstandingBalance}
                entries={entries}
                loading={loadingLedger}
                error={error && selectedCustomerId ? error : ""}
              />

              <SettlementForm
                customer={selectedCustomer}
                outstandingBalance={outstandingBalance}
                onSettled={() => void handleSettled()}
              />

              <ThresholdSettings isOwner={isOwner} />
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              No customers available. Create a customer to start using
              the udhaar ledger.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
