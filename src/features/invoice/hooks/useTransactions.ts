"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { offlineDB } from "@/lib/sync/offline-db";
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
      setError(null);
      setLoading(true);
      try {
        const branchId = user.branchId;
        const pendingPayments = await offlineDB.pendingQueue
          .where("entity")
          .equals("payment")
          .toArray();
        const branchPayments = pendingPayments.filter(
          (p) => !branchId || p.branchId === branchId,
        );
        const cachedInvoices = await offlineDB.cachedInvoices.toArray();
        const invoiceMap = new Map(cachedInvoices.map((inv) => [inv.id, inv.data]));

        const offlineTransactions: BillingTransaction[] = branchPayments.map((p) => {
          const payload = p.payload as any;
          const invoice = invoiceMap.get(payload.invoiceId) as any;
          return {
            id: payload.id || String(p.id),
            invoice: {
              id: payload.invoiceId,
              invoiceNumber:
                invoice?.invoiceNumber ||
                `INV-${String(payload.invoiceId).slice(-6)}`,
              status: invoice?.status || "paid",
              branch: {
                id: p.branchId,
                name: invoice?.branch?.name || "Current Branch",
                currency: invoice?.branch?.currency || "PKR",
              },
              customer: invoice?.customer || null,
            },
            tenderType: payload.paymentMethod || "cash",
            amount: Number(payload.amount || 0),
            paymentReference: payload.reference || null,
            payerLabel: null,
            createdAt: p.originTimestamp || new Date().toISOString(),
          };
        });

        setTransactions(offlineTransactions);
        setPagination({
          page: 1,
          pageSize: Math.max(25, offlineTransactions.length),
          total: offlineTransactions.length,
          totalPages: 1,
        });
      } catch {
        setTransactions([]);
        setPagination(emptyPagination);
      } finally {
        setLoading(false);
      }
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

  useEffect(() => {
    const handleQueueChange = () => {
      void refresh();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("cuecloud:offline-queue-changed", handleQueueChange);
      window.addEventListener("cuecloud:payment-recorded", handleQueueChange);
      return () => {
        window.removeEventListener("cuecloud:offline-queue-changed", handleQueueChange);
        window.removeEventListener("cuecloud:payment-recorded", handleQueueChange);
      };
    }
  }, [refresh]);

  return {
    transactions,
    pagination,
    loading,
    error,
    refresh,
  };
}
