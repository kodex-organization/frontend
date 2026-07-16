// src/modules/floor-view/components/NotificationBell.tsx
"use client";

import { useState } from "react";
import { Notification } from "../types";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-200 transition-colors"
        aria-label="Notifications"
      >
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-lg">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    onMarkAllAsRead();
                    setIsOpen(false);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-gray-500 text-center">
                <span className="text-4xl block mb-2"></span>
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                try {
                  const payload = JSON.parse(n.payload);
                  return (
                    <div
                      key={n.id}
                      className={`p-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                        n.status === "queued"
                          ? "bg-blue-50 border-l-4 border-l-blue-500"
                          : ""
                      }`}
                      onClick={() => {
                        onMarkAsRead(n.id);
                        setIsOpen(false);
                      }}
                    >
                      <div className="text-sm text-gray-800">
                        {payload.message}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-400">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                        {n.status === "queued" && (
                          <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full inline-block"></span>
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  );
                } catch {
                  return (
                    <div key={n.id} className="p-3 border-b hover:bg-gray-50">
                      <div className="text-sm text-gray-800">
                        New notification
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
