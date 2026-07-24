"use client";

import { useState } from "react";

import {
  isUnreadNotification,
  notificationMessage,
  type Notification,
} from "../types";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  async function handleMarkAsRead(id: string) {
    if (busyIds.has(id)) return;
    setBusyIds((current) => new Set(current).add(id));
    try {
      await onMarkAsRead(id);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleMarkAllAsRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await onMarkAllAsRead();
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleNotificationClick(
    notification: Notification,
  ) {
    setIsOpen(false);

    if (notification.payload) {
      try {
        const payload: unknown = JSON.parse(notification.payload);
        const tableId =
          typeof payload === "object" &&
          payload !== null &&
          "tableId" in payload &&
          typeof payload.tableId === "string"
            ? payload.tableId
            : null;
        if (tableId) {
          document
            .getElementById(`floor-table-${tableId}`)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }
      } catch {
        // A malformed legacy payload still remains readable and markable.
      }
    }

    if (isUnreadNotification(notification)) {
      await handleMarkAsRead(notification.id);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`relative rounded-lg border p-2.5 outline-none transition-colors ${
          isOpen
            ? "border-slate-300 bg-slate-100 text-slate-800"
            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        }`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-md border border-white bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <section
            aria-label="Notification list"
            className="absolute right-0 z-50 mt-2.5 flex max-h-[440px] w-80 origin-top-right flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96"
          >
            <header className="flex items-center justify-between border-b border-slate-100 p-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Notifications
                </p>
                <p className="text-[11px] text-slate-500">
                  {unreadCount
                    ? `${unreadCount} unread`
                    : "You are all caught up"}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllAsRead()}
                  disabled={markingAll}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {markingAll ? "Marking…" : "Mark all read"}
                </button>
              )}
            </header>

            <div className="divide-y divide-slate-100 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No notifications
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Overtime alerts will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const isUnread = isUnreadNotification(notification);
                  const isBusy = busyIds.has(notification.id);

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void handleNotificationClick(notification)
                      }
                      className={`flex w-full gap-3 p-3.5 text-left transition-colors ${
                        isUnread
                          ? "border-l-2 border-blue-500 bg-blue-50/40 hover:bg-blue-50"
                          : "bg-white hover:bg-slate-50"
                      } disabled:opacity-75`}
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          isUnread ? "bg-blue-500" : "bg-slate-300"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-xs leading-relaxed ${
                            isUnread
                              ? "font-medium text-slate-900"
                              : "text-slate-600"
                          }`}
                        >
                          {notificationMessage(notification)}
                        </span>
                        <span className="mt-1.5 block text-[10px] text-slate-400">
                          {new Date(notification.createdAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                          {isBusy ? " · Marking as read…" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
