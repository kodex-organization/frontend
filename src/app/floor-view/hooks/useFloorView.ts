"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  fetchFloorView,
  fetchNotifications,
  markNotificationAsRead,
} from "../api";
import {
  isUnreadNotification,
  type FloorViewTable,
  type Notification,
} from "../types";

const POLL_INTERVAL_MS = 8_000;
const REQUEST_TIMEOUT_MS = 10_000;

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
    return "The floor service could not be reached. Existing data is still available.";
  }
  return error instanceof Error
    ? error.message
    : "The floor view could not be refreshed.";
}

export function useFloorView(selectedBranchId?: string) {
  const {
    isAuthenticated,
    isLoading: authLoading,
    user,
  } = useAuth();
  const isOnline = useOnlineStatus();
  const authScope = user ? `${user.id}:${user.branchId}:${selectedBranchId ?? "all"}` : null;
  const [tables, setTables] = useState<FloorViewTable[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const mountedRef = useRef(false);
  const requestRef = useRef<Promise<void> | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const overtimeToastIdsRef = useRef<Set<string>>(new Set());
  const notificationMutationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      for (const toastId of overtimeToastIdsRef.current) {
        toast.dismiss(toastId);
      }
      overtimeToastIdsRef.current.clear();
    };
  }, []);

  const dismissOvertimeAlert = useCallback((sessionId: string) => {
    const toastId = `overtime-${sessionId}`;
    toast.dismiss(toastId);
    overtimeToastIdsRef.current.delete(toastId);
  }, []);

  const updateSessionOptimistically = useCallback((sessionId: string, nextStatus: "active" | "paused" | "ended") => {
    setTables((current) => current.map((table) => {
      if (table.session?.sessionId !== sessionId) return table;
      if (nextStatus === "ended") return { ...table, status: "available", session: null };
      return {
        ...table,
        status: "occupied",
        session: { ...table.session, billingState: nextStatus === "paused" ? "paused" : "accruing", isPaused: nextStatus === "paused" },
      };
    }));
  }, []);

  const fetchData = useCallback(async (): Promise<void> => {
    if (authLoading) return;
    if (!isAuthenticated || !authScope) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    if (!isOnline) {
      if (mountedRef.current) {
        setLoading(false);
        setError("You are offline. Polling will resume when the connection returns.");
      }
      return;
    }
    if (
      requestRef.current &&
      !activeControllerRef.current?.signal.aborted
    ) {
      return requestRef.current;
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const operation = (async () => {
      if (mountedRef.current) setRefreshing(true);

      try {
        const nextTables = await fetchFloorView({ signal: controller.signal, branchId: selectedBranchId });
        if (!mountedRef.current) return;

        setTables(nextTables);
        setLastUpdated(new Date());

        const activeOvertimeToastIds = new Set(
          nextTables.flatMap((table) =>
            table.session?.isOvertime
              ? [`overtime-${table.session.sessionId}`]
              : [],
          ),
        );

        for (const toastId of Array.from(overtimeToastIdsRef.current)) {
          if (!activeOvertimeToastIds.has(toastId)) {
            toast.dismiss(toastId);
            overtimeToastIdsRef.current.delete(toastId);
          }
        }

        for (const table of nextTables) {
          const session = table.session;
          if (!session?.isOvertime) continue;

          const toastId = `overtime-${session.sessionId}`;
          if (overtimeToastIdsRef.current.has(toastId)) continue;

          overtimeToastIdsRef.current.add(toastId);
          toast.warning(
            `Table ${table.tableNumber ?? "N/A"} (${session.customerName || "Walk-in"}) has exceeded its expected time.`,
            {
              autoClose: 8000,
              toastId,
              position: "top-right",
            },
          );
        }

        const nextNotifications = await fetchNotifications({
          signal: controller.signal,
        });
        if (!mountedRef.current) return;

        setNotifications(nextNotifications);
        setError(null);
        toast.dismiss("floor-view-fetch-error");
      } catch (requestError) {
        if (!mountedRef.current) return;
        if (controller.signal.aborted && !timedOut) return;

        if (
          requestError instanceof ApiError &&
          requestError.status === 401
        ) {
          activeControllerRef.current?.abort();
          return;
        }

        const message = timedOut
          ? "The floor service timed out. Existing data is still available."
          : requestErrorMessage(requestError);
        setError(message);
      } finally {
        window.clearTimeout(timeoutId);
        const isCurrentRequest = activeControllerRef.current === controller;
        if (mountedRef.current && isCurrentRequest) {
          setLoading(false);
          setRefreshing(false);
        }
        if (isCurrentRequest) {
          activeControllerRef.current = null;
        }
      }
    })();

    requestRef.current = operation;
    try {
      await operation;
    } finally {
      if (requestRef.current === operation) requestRef.current = null;
    }
  }, [authLoading, authScope, isAuthenticated, isOnline, selectedBranchId]);

  useEffect(() => {
    if (authLoading) return;

    activeControllerRef.current?.abort();
    setTables([]);
    setNotifications([]);
    setLastUpdated(null);
    setError(null);
    notificationMutationsRef.current.clear();

    for (const toastId of overtimeToastIdsRef.current) {
      toast.dismiss(toastId);
    }
    overtimeToastIdsRef.current.clear();
    setLoading(authScope !== null);
    setRefreshing(false);
  }, [authLoading, authScope]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !authScope || !isOnline) {
      if (!authLoading) setLoading(false);
      return;
    }

    if (document.visibilityState === "visible") {
      void fetchData();
    }
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchData();
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [authLoading, authScope, fetchData, isAuthenticated, isOnline]);

  useEffect(() => {
    if (!isOnline) {
      setError("You are offline. Polling will resume when the connection returns.");
      activeControllerRef.current?.abort();
    }
  }, [isOnline]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isOnline) {
        void fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData, isOnline]);

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      if (!authScope) return;
      if (notificationMutationsRef.current.has(id)) return;
      notificationMutationsRef.current.add(id);

      try {
        const result = await markNotificationAsRead(id);
        if (!mountedRef.current) return;
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === id
              ? {
                  ...notification,
                  status: result.status,
                  readAt: result.readAt,
                }
              : notification,
          ),
        );
      } catch (markError) {
        if (markError instanceof ApiError && markError.status === 401) {
          return;
        } else if (mountedRef.current) {
          toast.error(requestErrorMessage(markError), {
            toastId: `notification-read-${id}`,
          });
        }
      } finally {
        notificationMutationsRef.current.delete(id);
      }
    },
    [authScope],
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const unreadIds = notifications
      .filter(isUnreadNotification)
      .map((notification) => notification.id);
    await Promise.all(unreadIds.map((id) => markAsRead(id)));
  }, [markAsRead, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter(isUnreadNotification).length,
    [notifications],
  );

  return {
    tables,
    notifications,
    unreadCount,
    loading: loading || authLoading,
    refreshing,
    error,
    isOnline,
    lastUpdated,
    fetchData,
    markAsRead,
    markAllAsRead,
    dismissOvertimeAlert,
    updateSessionOptimistically,
  };
}
