// src/modules/floor-view/hooks/useFloorView.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  fetchFloorView,
  fetchNotifications,
  markNotificationAsRead,
} from "../api";
import type { FloorViewTable, Notification } from "../types";

export function useFloorView() {
  const [tables, setTables] = useState<FloorViewTable[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notifiedOvertime, setNotifiedOvertime] = useState<Set<string>>(
    new Set(),
  );
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getToken = () => localStorage.getItem("accessToken");

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      window.location.href = "/login";
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
    } catch (error) {
      console.error("Failed to fetch:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [notifiedOvertime]);

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

  // Auto-refresh every 30 seconds (polling)
  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling
    intervalRef.current = setInterval(fetchData, 30000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  return {
    tables,
    notifications,
    unreadCount,
    loading,
    lastUpdated,
    fetchData,
    markAsRead,
    markAllAsRead,
  };
}
