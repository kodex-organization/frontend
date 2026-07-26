"use client";

import { useEffect } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { tokenStorage } from "@/lib/auth/session";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { sendHeartbeat } from "@/services/sync.service";

export const AUTHENTICATED_HEARTBEAT_EVENT =
  "cuecloud:authenticated-heartbeat";

const HEARTBEAT_INTERVAL_MS = 60_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;

/**
 * Keeps every visible authenticated client represented in SyncDevice. A
 * completion-based timeout prevents overlapping requests when the network is
 * slow, and hidden tabs intentionally become eligible for manager takeover
 * after the server-configured offline threshold.
 */
export function AuthenticatedHeartbeat() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (
      isLoading ||
      !isAuthenticated ||
      !user ||
      !isOnline
    ) {
      return;
    }

    const accessContext = tokenStorage.getAccessContext();
    if (
      !accessContext ||
      accessContext.userId !== user.id ||
      accessContext.branchId !== user.branchId
    ) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let timeoutId: number | undefined;
    let requestController: AbortController | null = null;

    const schedule = () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      timeoutId = window.setTimeout(() => {
        void heartbeat();
      }, HEARTBEAT_INTERVAL_MS);
    };

    const heartbeat = async () => {
      if (
        cancelled ||
        inFlight ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      inFlight = true;
      requestController = new AbortController();
      const requestTimeoutId = window.setTimeout(
        () => requestController?.abort(),
        HEARTBEAT_TIMEOUT_MS,
      );
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      try {
        const result = await sendHeartbeat(
          accessContext.deviceId,
          user.branchId,
          requestController.signal,
        );
        if (!cancelled) {
          window.dispatchEvent(
            new CustomEvent(AUTHENTICATED_HEARTBEAT_EVENT, {
              detail: result,
            }),
          );
        }
      } catch {
        // Connectivity/auth handling remains centralized in apiFetch. A
        // subsequent online/visibility event or scheduled attempt retries.
      } finally {
        window.clearTimeout(requestTimeoutId);
        requestController = null;
        inFlight = false;
        schedule();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      } else if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );
    void heartbeat();

    return () => {
      cancelled = true;
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      requestController?.abort();
    };
  }, [
    isAuthenticated,
    isLoading,
    isOnline,
    user,
  ]);

  return null;
}
