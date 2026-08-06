"use client";

import { useEffect, useMemo, useState } from "react";

import { createUdhaarAdjustment, getUdhaarAging, getUdhaarCustomers, getUdhaarStatement, type UdhaarAgingSummary, type UdhaarCustomerSummary, type UdhaarStatementEntry } from "../api/udhaarApi";

export function useUdhaarLedger() {
  const [customers, setCustomers] = useState<UdhaarCustomerSummary[]>([]);
  const [aging, setAging] = useState<UdhaarAgingSummary | null>(null);
  const [statement, setStatement] = useState<{ customerId: string; from: string; to: string; entries: UdhaarStatementEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus = status === "all" || customer.status === status;
      const matchesQuery = !query || `${customer.fullName ?? ""} ${customer.phone ?? ""}`.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [customers, search, status]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [customerData, agingData] = await Promise.all([getUdhaarCustomers(search, status), getUdhaarAging()]);
      setCustomers(customerData);
      setAging(agingData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load udhaar ledger.");
    } finally {
      setLoading(false);
    }
  };

  const loadStatement = async (customerId: string, from: string, to: string) => {
    try {
      const nextStatement = await getUdhaarStatement(customerId, from, to);
      setStatement(nextStatement);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load customer statement.");
    }
  };

  const addAdjustment = async (payload: { customerId: string; amount: number; reason: string; approvedById?: string | null; approvedByPin?: string | null }) => {
    try {
      await createUdhaarAdjustment(payload);
      await refresh();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save adjustment.");
      return false;
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    customers,
    filteredCustomers,
    aging,
    statement,
    loading,
    error,
    search,
    setSearch,
    status,
    setStatus,
    refresh,
    loadStatement,
    addAdjustment,
  };
}
