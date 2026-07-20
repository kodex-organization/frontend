// src/modules/floor-view/hooks/useFloorView.ts
"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { tokenStorage } from "@/lib/auth/session"; // ✅ Import tokenStorage
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  fetchFloorView,
  fetchNotifications,
  markNotificationAsRead,
} from "../api";
import type { FloorViewTable, Notification } from "../types";

export function useFloorView() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [tables, setTables] = useState<FloorViewTable[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notifiedOvertime, setNotifiedOvertime] = useState<Set<string>>(
    new Set(),
  );
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Use tokenStorage to get the token correctly
  const getToken = () => {
    const stored = tokenStorage.get();
    return stored?.accessToken || null;
  };

  const clearAuthAndRedirect = () => {
    tokenStorage.clear(); // ✅ Use tokenStorage.clear() instead of manual removal
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    router.push("/login");
  };

  const fetchData = useCallback(async () => {
    // ✅ Check auth state first
    if (!user) {
      console.log("❌ No user authenticated");
      clearAuthAndRedirect();
      return;
    }

    const token = getToken();
    if (!token) {
      console.log("❌ No token found");
      clearAuthAndRedirect();
      return;
    }

    try {
      setLoading(true);

      // Fetch floor view
      const floorData = await fetchFloorView(token);
      if (floorData.success) {
        setTables(floorData.data);
        setLastUpdated(new Date());

        // Check for overtime notifications
        floorData.data.forEach((table: FloorViewTable) => {
          if (
            table.session?.isOvertime &&
            !notifiedOvertime.has(table.tableId)
          ) {
            toast.error(`Table ${table.tableNumber} session is over`, {
              autoClose: false,
              toastId: `overtime-${table.tableId}`,
              position: "top-right",
            });
            setNotifiedOvertime((prev) => new Set(prev).add(table.tableId));
          }
        });
      }

      // Fetch notifications
      const notifData = await fetchNotifications(token);
      if (notifData.success) {
        setNotifications(notifData.data);
        setUnreadCount(
          notifData.data.filter((n: Notification) => n.status === "queued")
            .length,
        );
      }
    } catch (error: any) {
      console.error("❌ Failed to fetch:", error);

      if (error.message === "Unauthorized" || error.message?.includes("401")) {
        clearAuthAndRedirect();
        return;
      }

      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user, notifiedOvertime, router]);

  const markAsRead = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) return;

      try {
        await markNotificationAsRead(token, id);
        await fetchData();
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    },
    [fetchData],
  );

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => n.status === "queued");
    for (const n of unread) {
      await markAsRead(n.id);
    }
  }, [notifications, markAsRead]);

  // ✅ Use auth loading state
  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;

    fetchData();
    intervalRef.current = setInterval(fetchData, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, fetchData]);

  return {
    tables,
    notifications,
    unreadCount,
    loading: loading || authLoading,
    lastUpdated,
    fetchData,
    markAsRead,
    markAllAsRead,
  };
}
