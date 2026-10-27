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
  type FloorViewSession,
  type FloorViewTable,
  type Notification,
} from "../types";
import { sessionApi } from "@/features/sessions/session-api";
import { readCachedTables } from "@/features/sessions/offline-tables-cache";
import { getActiveOfflineBranchId } from "@/lib/sync/offline-db";
import type { ActiveSession, TableOption } from "@/features/sessions/types";
import { getSyncQueue, type QueueItem } from "@/lib/offline-sync";
import { computeSessionTiming, getServerNowMs } from "@/features/sessions/session-timing";
import { queueNotificationRead } from "@/features/notifications/offline";
import { markCachedNotificationsRead, readCachedNotifications } from "@/features/notifications/offline-cache";
import { isNotificationVisible } from "@/features/notifications/types";

const POLL_INTERVAL_MS = 8_000;
const REQUEST_TIMEOUT_MS = 10_000;
const OFFLINE_FLOOR_TABLES_KEY = "cuecloud_offline_floor_tables";

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
    return "The floor service could not be reached. Existing data is still available.";
  }
  return error instanceof Error
    ? error.message
    : "The floor view could not be refreshed.";
}

// Replays queued PAUSE/RESUME on server data so a paused table stays frozen until sync completes.
function applyPendingPauseActions(table: FloorViewTable, actions: QueueItem[]): FloorViewTable {
  const session = table.session;
  if (!session) return table;
  const mine = actions
    .filter((action) => action.entityId === session.sessionId)
    .sort((a, b) => String(a.originTimestamp).localeCompare(String(b.originTimestamp)));
  if (mine.length === 0) return table;

  const pauses = Array.isArray(session.pauses) ? session.pauses.map((pause) => ({ ...pause })) : [];
  let paused = session.isPaused;
  for (const action of mine) {
    if (action.action === "PAUSE" && !paused) {
      pauses.push({ pausedAt: action.originTimestamp, resumedAt: null });
      paused = true;
    } else if (action.action === "RESUME" && paused) {
      const openIndex = pauses.map((pause) => pause.resumedAt ?? null).lastIndexOf(null);
      if (openIndex >= 0) pauses[openIndex] = { ...pauses[openIndex], resumedAt: action.originTimestamp };
      paused = false;
    }
  }
  if (paused === session.isPaused) return table;

  const openPause = [...pauses].reverse().find((pause) => !pause.resumedAt && pause.pausedAt);
  return {
    ...table,
    status: paused ? ("paused" as const) : ("occupied" as const),
    session: {
      ...session,
      isPaused: paused,
      billingState: (paused ? "paused" : "accruing") as FloorViewSession["billingState"],
      pausedAt: paused ? openPause?.pausedAt ?? null : null,
      pauses,
    },
  };
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

  const updateSessionOptimistically = useCallback(
    (sessionId: string, nextStatus: "active" | "paused" | "ended") => {
      setTables((current) => {
        const nowIso = new Date(getServerNowMs()).toISOString();
        const updated = current.map((table) => {
          if (table.session?.sessionId !== sessionId) return table;
          if (nextStatus === "ended") return { ...table, status: "available" as const, session: null };

          const currentPauses = Array.isArray(table.session?.pauses) ? [...table.session.pauses] : [];
          let nextPauses = currentPauses;
          if (nextStatus === "paused") {
            nextPauses = [
              ...currentPauses,
              { pausedAt: nowIso, resumedAt: null },
            ];
          } else if (nextStatus === "active") {
            const lastOpenIdx = currentPauses.map((p) => p.resumedAt).lastIndexOf(null);
            if (lastOpenIdx >= 0) {
              currentPauses[lastOpenIdx] = {
                ...currentPauses[lastOpenIdx],
                resumedAt: nowIso,
              };
            }
            nextPauses = currentPauses;
          }

          return {
            ...table,
            status: (nextStatus === "paused" ? "paused" : "occupied") as any,
            session: {
              ...table.session!,
              billingState: (nextStatus === "paused" ? "paused" : "accruing") as FloorViewSession["billingState"],
              isPaused: nextStatus === "paused",
              pausedAt: nextStatus === "paused" ? nowIso : null,
              pauses: nextPauses,
            },
          };
        });

        if (typeof window !== "undefined") {
          try {
            const cacheKey = `${OFFLINE_FLOOR_TABLES_KEY}_${selectedBranchId || "all"}`;
            window.localStorage.setItem(cacheKey, JSON.stringify(updated));
            window.localStorage.setItem(`${OFFLINE_FLOOR_TABLES_KEY}_all`, JSON.stringify(updated));
          } catch {}
        }

        return updated;
      });
    },
    [selectedBranchId],
  );

  const startSessionOptimistically = useCallback(
    (session: ActiveSession) => {
      setTables((current) => {
        const updated = current.map((table) => {
          if (table.tableId !== session.table.id) return table;
          const sessionData: FloorViewSession = {
            sessionId: session.id,
            customerName: session.customer?.fullName || "Walk-in",
            startedAt: session.startedAt,
            expectedEndTime: null,
            appliedHourlyRate: Number(session.appliedHourlyRate) || 0,
            billingType: session.billingType,
            gameCount: session.gameCount ?? null,
            appliedPerGameRate: Number(session.appliedPerGameRate) || null,
            durationSeconds: 0,
            pauseDurationSeconds: 0,
            billableDurationSeconds: 0,
            estimatedCharge: null,
            billingState: (session.status === "paused" ? "paused" : "accruing") as FloorViewSession["billingState"],
            isPaused: session.status === "paused",
            isOvertime: false,
            pauses: session.pauses ?? [],
          };
          return {
            ...table,
            status: "occupied" as const,
            session: sessionData,
          };
        });

        if (typeof window !== "undefined") {
          try {
            const cacheKey = `${OFFLINE_FLOOR_TABLES_KEY}_${selectedBranchId || "all"}`;
            window.localStorage.setItem(cacheKey, JSON.stringify(updated));
            window.localStorage.setItem(`${OFFLINE_FLOOR_TABLES_KEY}_all`, JSON.stringify(updated));
          } catch {}
        }

        return updated;
      });
    },
    [selectedBranchId],
  );

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

        const restoreOffline = async () => {
          let cached: FloorViewTable[] = [];
          if (typeof window !== "undefined") {
            try {
              const cacheKey = `${OFFLINE_FLOOR_TABLES_KEY}_${selectedBranchId || "all"}`;
              const cachedRaw = window.localStorage.getItem(cacheKey);
              if (cachedRaw) cached = JSON.parse(cachedRaw);
              // "_all" holds the last viewed branch, so use it only when no branch is selected.
              if (!selectedBranchId && (!Array.isArray(cached) || cached.length === 0)) {
                const allFloorRaw = window.localStorage.getItem(`${OFFLINE_FLOOR_TABLES_KEY}_all`);
                if (allFloorRaw) cached = JSON.parse(allFloorRaw);
              }
              if (!Array.isArray(cached) || cached.length === 0) {
                const genTables = readCachedTables(selectedBranchId || getActiveOfflineBranchId());
                cached = genTables.map((t: TableOption) => ({
                  tableId: t.id,
                  tableNumber: t.tableNumber,
                  status: "available" as const,
                  currency: t.currency || "PKR",
                  session: null,
                }));
              }
            } catch {}
          }

          try {
            const [activeSessions, pausedSessions] = await Promise.all([
              sessionApi.active(selectedBranchId).catch(() => []),
              sessionApi.paused(selectedBranchId).catch(() => []),
            ]);
            const allSessions = [...activeSessions, ...pausedSessions];
            const sessionByTableId = new Map(
              allSessions
                .filter((s) => s.table?.id && (s.status === "active" || s.status === "paused"))
                .map((s) => [s.table.id, s]),
            );

            // If cached is still empty, synthesize tables from offline sessions
            if ((!Array.isArray(cached) || cached.length === 0) && allSessions.length > 0) {
              cached = allSessions.map((s) => ({
                tableId: s.table.id,
                tableNumber: s.table.tableNumber,
                status: "occupied" as const,
                currency: s.table.currency || s.branch?.currency || "PKR",
                session: null,
              }));
            }

            if (!Array.isArray(cached)) cached = [];

            const merged: FloorViewTable[] = cached.map((table) => {
              const active = sessionByTableId.get(table.tableId);
              if (active) {
                const rate = Number(active.appliedHourlyRate) || Number(active.table?.defaultHourlyRate) || 0;
                const isPausedSession = active.status === "paused";
                // Keep the pause history; without it a paused table kept counting time and charges.
                const pauses = Array.isArray(active.pauses)
                  ? active.pauses.map((pause) => ({
                      pausedAt: pause.pausedAt ?? null,
                      resumedAt: pause.resumedAt ?? null,
                    }))
                  : [];
                const timing = computeSessionTiming({
                  startedAt: active.startedAt,
                  status: active.status,
                  pauses,
                  pausedAt: active.pausedAt ?? null,
                  appliedHourlyRate: rate,
                  billingType: active.billingType,
                  gameCount: active.gameCount,
                  appliedPerGameRate: active.appliedPerGameRate,
                  isPaused: isPausedSession,
                });
                const sessionData: FloorViewSession = {
                  sessionId: active.id,
                  customerName: active.customer?.fullName || "Walk-in",
                  startedAt: active.startedAt,
                  expectedEndTime: null,
                  appliedHourlyRate: rate,
                  billingType: active.billingType,
                  gameCount: active.gameCount ?? null,
                  appliedPerGameRate: Number(active.appliedPerGameRate) || null,
                  durationSeconds: timing.totalSeconds,
                  pauseDurationSeconds: timing.pauseSeconds,
                  billableDurationSeconds: timing.billableSeconds,
                  estimatedCharge:
                    rate > 0 || active.billingType === "per_game" ? timing.charge : null,
                  billingState: (isPausedSession ? "paused" : "accruing") as FloorViewSession["billingState"],
                  isPaused: isPausedSession,
                  isOvertime: false,
                  pausedAt: isPausedSession ? active.pausedAt ?? null : null,
                  pauses,
                };
                return {
                  ...table,
                  status: isPausedSession ? ("paused" as const) : ("occupied" as const),
                  session: sessionData,
                };
              }
              if ((table.status === "occupied" || table.status === "paused") && !active) {
                return {
                  ...table,
                  status: "available" as const,
                  session: null,
                };
              }
              return table;
            });

            if (mountedRef.current) {
              setTables(merged);
              setLastUpdated(new Date());
            }
          } catch {}

          // Offline: show the last saved notifications instead of an empty bell.
          try {
            const cachedNotifications = await readCachedNotifications();
            if (mountedRef.current && cachedNotifications) {
              setNotifications(
                cachedNotifications.filter((item) => isNotificationVisible(item)) as Notification[],
              );
            }
          } catch {}
        };

        void restoreOffline();
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
        const pendingStarts = typeof window !== "undefined"
          ? getSyncQueue().filter((q) => q.entityType === "Session" && q.action === "START")
          : [];
        const pendingEnds = typeof window !== "undefined"
          ? new Set(getSyncQueue().filter((q) => q.entityType === "Session" && q.action === "END").map((q) => q.entityId))
          : new Set<string>();

        const pendingPauseActions = typeof window !== "undefined"
          ? getSyncQueue().filter(
              (q) => q.entityType === "Session" && (q.action === "PAUSE" || q.action === "RESUME"),
            )
          : [];

        const resolvedTables = nextTables.map((serverTable) => {
          const table = applyPendingPauseActions(serverTable, pendingPauseActions);
          if (table.session && pendingEnds.has(table.session.sessionId)) {
            return { ...table, status: "available" as const, session: null };
          }
          const pending = pendingStarts.find((p) => (p.payload as any)?.tableId === table.tableId);
          if (pending && !table.session && !pendingEnds.has(pending.entityId)) {
            const payload = pending.payload as any;
            const now = Date.now();
            const startedAtMs = pending.originTimestamp ? new Date(pending.originTimestamp).getTime() : now;
            const durationSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000));
            const rate = Number(payload.appliedHourlyRate) || 0;
            return {
              ...table,
              status: "occupied" as const,
              session: {
                sessionId: pending.entityId,
                customerName: payload.customer?.fullName || payload.customerName || "Walk-in",
                startedAt: pending.originTimestamp,
                expectedEndTime: null,
                appliedHourlyRate: rate,
                billingType: payload.billingType,
                gameCount: payload.gameCount ?? null,
                appliedPerGameRate: Number(payload.appliedPerGameRate) || null,
                durationSeconds,
                pauseDurationSeconds: 0,
                billableDurationSeconds: durationSeconds,
                estimatedCharge: rate > 0 ? (rate * durationSeconds) / 3600 : null,
                billingState: "accruing" as const,
                isPaused: false,
                isOvertime: false,
              },
            };
          }
          return table;
        });

        setTables(resolvedTables);
        setLastUpdated(new Date());

        if (typeof window !== "undefined") {
          try {
            const cacheKey = `${OFFLINE_FLOOR_TABLES_KEY}_${selectedBranchId || "all"}`;
            window.localStorage.setItem(cacheKey, JSON.stringify(resolvedTables));
            window.localStorage.setItem(`${OFFLINE_FLOOR_TABLES_KEY}_all`, JSON.stringify(resolvedTables));
          } catch {}
        }

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
    if (authLoading || !isAuthenticated || !authScope) {
      if (!authLoading) setLoading(false);
      return;
    }

    if (document.visibilityState === "visible") {
      void fetchData();
    }

    if (!isOnline) {
      setLoading(false);
      return;
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
      void fetchData();
    } else {
      setError(null);
      void fetchData();
    }
  }, [isOnline, fetchData]);

  useEffect(() => {
    const handleSyncChange = () => {
      void fetchData();
    };
    window.addEventListener("cuecloud:offline-queue-changed", handleSyncChange);
    window.addEventListener("cuecloud:sync-status-changed", handleSyncChange);
    return () => {
      window.removeEventListener("cuecloud:offline-queue-changed", handleSyncChange);
      window.removeEventListener("cuecloud:sync-status-changed", handleSyncChange);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      if (!authScope) return;
      if (notificationMutationsRef.current.has(id)) return;
      notificationMutationsRef.current.add(id);

      try {
        if (!isOnline) {
          // Offline: mark locally now and let the notification queue sync it later.
          await queueNotificationRead(id);
          void markCachedNotificationsRead(id);
          if (mountedRef.current) {
            const readAt = new Date().toISOString();
            setNotifications((current) =>
              current.map((notification) =>
                notification.id === id
                  ? { ...notification, status: "read" as const, readAt }
                  : notification,
              ),
            );
          }
          return;
        }
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
    [authScope, isOnline],
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
    startSessionOptimistically,
  };
}
