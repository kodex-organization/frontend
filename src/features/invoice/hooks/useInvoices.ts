"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { invoiceService } from "../services/invoiceService";
import type {
  Invoice,
  InvoiceListFilters,
  Pagination,
} from "../types/invoice";

const emptyPagination: Pagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
};

export function useInvoices(filters: InvoiceListFilters = {}) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isOnline = useOnlineStatus();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] =
    useState<Pagination>(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    page = 1,
    pageSize = 25,
    search,
    status,
    from,
    to,
    branchId,
  } = filters;

  const fetchInvoices = useCallback(async () => {
    if (authLoading) return;

    if (!isAuthenticated || !user?.branchId) {
      setInvoices([]);
      setPagination(emptyPagination);
      setLoading(false);
      return;
    }

    // When offline, invoiceService loads from offlineDB.cachedInvoices automatically

    setLoading(true);
    setError(null);

    try {
      const response = await invoiceService.getInvoices({
        page,
        pageSize,
        search,
        status,
        from,
        to,
        branchId,
      });
      setInvoices(response.items);
      setPagination(response.pagination);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Invoices could not be loaded.",
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
    search,
    status,
    to,
    user?.branchId,
    branchId,
  ]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const handleEvents = () => {
      void fetchInvoices();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("cuecloud:offline-queue-changed", handleEvents);
      window.addEventListener("cuecloud:invoice-created", handleEvents);
      window.addEventListener("cuecloud:invoice-voided", handleEvents);
      window.addEventListener("cuecloud:payment-recorded", handleEvents);
      return () => {
        window.removeEventListener("cuecloud:offline-queue-changed", handleEvents);
        window.removeEventListener("cuecloud:invoice-created", handleEvents);
        window.removeEventListener("cuecloud:invoice-voided", handleEvents);
        window.removeEventListener("cuecloud:payment-recorded", handleEvents);
      };
    }
  }, [fetchInvoices]);

  return {
    invoices,
    pagination,
    loading,
    error,
    refresh: fetchInvoices,
  };
}
