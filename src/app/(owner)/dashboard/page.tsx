// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";

// This will auto-detect the correct backend port
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Table {
  tableId: string;
  tableNumber: string | null;
  status: string | null;
  session: {
    sessionId: string;
    customerName: string;
    startedAt: string | null;
    expectedEndTime: string | null;
    appliedHourlyRate: number | null;
    isPaused: boolean;
    isOvertime: boolean;
  } | null;
}

interface Notification {
  id: string;
  category: string;
  payload: string;
  status: string;
  createdAt: string;
  readAt: string | null;
}

export default function DashboardPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifiedOvertime, setNotifiedOvertime] = useState<Set<string>>(
    new Set(),
  );

  const getToken = () => localStorage.getItem("accessToken");

  const fetchData = async () => {
    try {
      const token = getToken();
      if (!token) {
        window.location.href = "/login";
        return;
      }

      // Fetch floor view
      const floorRes = await fetch(`${API_BASE_URL}/api/v1/floor-view`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (floorRes.status === 401) {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return;
      }

      const floorData = await floorRes.json();

      if (floorData.success) {
        setTables(floorData.data);

        // Check for overtime notifications
        floorData.data.forEach((table: Table) => {
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
      const notifRes = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const notifData = await notifRes.json();

      if (notifData.success) {
        setNotifications(notifData.data);
        setUnreadCount(
          notifData.data.filter((n: Notification) => n.status === "queued")
            .length,
        );
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const token = getToken();
      await fetch(`${API_BASE_URL}/api/v1/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => n.status === "queued");
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading floor view...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">🏠 Floor View</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            🔄 Refresh
          </button>
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              <span className="text-2xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b flex justify-between items-center sticky top-0 bg-white">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-gray-500 text-center">
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => {
                    try {
                      const payload = JSON.parse(n.payload);
                      return (
                        <div
                          key={n.id}
                          className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${
                            n.status === "queued" ? "bg-blue-50" : ""
                          }`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <div className="text-sm text-gray-800">
                            {payload.message}
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-400">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                            {n.status === "queued" && (
                              <span className="text-xs text-blue-600 font-medium">
                                ● New
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    } catch {
                      return (
                        <div
                          key={n.id}
                          className="p-3 border-b hover:bg-gray-50"
                        >
                          <div className="text-sm text-gray-800">
                            New notification
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg shadow-sm">
          Total: <span className="font-bold">{stats.total}</span>
        </div>
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg shadow-sm">
          Available: <span className="font-bold">{stats.available}</span>
        </div>
        <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg shadow-sm">
          Occupied: <span className="font-bold">{stats.occupied}</span>
        </div>
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((table) => {
          const isOccupied = table.status === "occupied";
          const isOvertime = table.session?.isOvertime || false;
          const isPaused = table.session?.isPaused || false;

          let cardStyle = "bg-green-100 border-green-500";
          let badgeStyle = "bg-green-500";
          let badgeText = "Available";

          if (isOvertime) {
            cardStyle = "bg-red-100 border-red-500";
            badgeStyle = "bg-red-500";
            badgeText = "⚠️ Overtime";
          } else if (isPaused) {
            cardStyle = "bg-yellow-100 border-yellow-500";
            badgeStyle = "bg-yellow-500";
            badgeText = "⏸️ Paused";
          } else if (isOccupied) {
            cardStyle = "bg-blue-100 border-blue-500";
            badgeStyle = "bg-blue-500";
            badgeText = "Active";
          }

          return (
            <div
              key={table.tableId}
              className={`border-l-4 p-4 rounded-lg shadow-md transition-all hover:shadow-lg ${cardStyle}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-800">
                  {table.tableNumber || "Unknown"}
                </h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full text-white font-medium ${badgeStyle}`}
                >
                  {badgeText}
                </span>
              </div>

              {isOccupied && table.session && (
                <div className="text-sm space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">
                      {table.session.customerName || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Started:</span>
                    <span>
                      {table.session.startedAt
                        ? new Date(table.session.startedAt).toLocaleTimeString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected End:</span>
                    <span>
                      {table.session.expectedEndTime
                        ? new Date(
                            table.session.expectedEndTime,
                          ).toLocaleTimeString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate:</span>
                    <span className="font-medium">
                      Rs. {table.session.appliedHourlyRate || 0}/hr
                    </span>
                  </div>
                  {isOvertime && (
                    <div className="mt-2 text-red-600 font-semibold text-xs bg-red-50 p-1 rounded text-center animate-pulse">
                      ⚠️ Session is overtime!
                    </div>
                  )}
                </div>
              )}

              {!isOccupied && (
                <div className="text-sm text-gray-500 mt-2">
                  {table.status === "available"
                    ? "✅ Ready for new session"
                    : table.status || "Unavailable"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">No tables available</p>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
