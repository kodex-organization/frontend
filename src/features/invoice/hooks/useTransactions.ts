"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { invoiceService } from "../services/invoiceService";
import type {
  BillingTransaction,
  Pagination,
} from "../types/invoice";

const emptyPagination: Pagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
};

export function useTransactions({
  page = 1,
  pageSize = 25,
  from,
  to,
}: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isOnline = useOnlineStatus();
  const [transactions, setTransactions] = useState<
    BillingTransaction[]
  >([]);
  const [pagination, setPagination] =
    useState<Pagination>(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading) return;

    if (!isAuthenticated || !user?.branchId) {
      setLoading(false);
      return;
    }

    if (!isOnline) {
      setError("Reconnect to load transaction history.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await invoiceService.getTransactions({
        page,
        pageSize,
        from,
        to,
      });
      setTransactions(response.items);
      setPagination(response.pagination);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Transactions could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    authLoading,
    from,
    isAuthenticated,
    isOnline,
    page,
    pageSize,
    to,
    user?.branchId,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    transactions,
    pagination,
    loading,
    error,
    refresh,
  };
}
