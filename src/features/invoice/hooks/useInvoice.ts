"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { invoiceService } from "../services/invoiceService";
import type { Invoice } from "../types/invoice";

export function useInvoice(id: string) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isOnline = useOnlineStatus();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (authLoading) return;

    if (!isAuthenticated || !user?.branchId) {
      setLoading(false);
      return;
    }

    if (!id) {
      setError("Invoice ID is missing.");
      setLoading(false);
      return;
    }

    // When offline, invoiceService loads from offlineDB.cachedInvoices automatically

    setLoading(true);
    setError(null);

    try {
      setInvoice(await invoiceService.getInvoice(id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Invoice details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    authLoading,
    id,
    isAuthenticated,
    isOnline,
    user?.branchId,
  ]);

  useEffect(() => {
    void fetchInvoice();
  }, [fetchInvoice]);

  return {
    invoice,
    loading,
    error,
    refresh: fetchInvoice,
    setInvoice,
  };
}
