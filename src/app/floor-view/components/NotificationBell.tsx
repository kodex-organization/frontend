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
      {/* Sleek UI Trigger with Interactive Badge Accent */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-lg border transition-all duration-200 outline-none ${
          isOpen
            ? "bg-slate-100 border-slate-300 text-slate-800 shadow-inner"
            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 shadow-sm"
        }`}
        aria-label="Toggle Operations Log Notification Stream"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] rounded-md h-4 min-w-[16px] px-1 flex items-center justify-center font-bold tracking-tight border border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Canvas Dismissal Underlay Overlay */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          {/* Floating Dropdown System Matrix panel */}
          <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200/90 z-50 max-h-[440px] overflow-y-auto flex flex-col transform origin-top-right transition-all duration-300">
            {/* Header Control Sub-Panel Layer */}
            <div className="p-3.5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-md rounded-t-xl z-10">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 tracking-tight">
                  System Events
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[10px] font-bold">
                    {unreadCount} Urgent
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    onMarkAllAsRead();
                    setIsOpen(false);
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold tracking-tight transition-colors py-1 px-2 rounded-md hover:bg-blue-50/60"
                >
                  Clear all alerts
                </button>
              )}
            </div>

            {/* Scrollable Notification Item List Pipeline Container */}
            <div className="divide-y divide-slate-50 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-12 text-slate-400 text-center flex flex-col items-center justify-center">
                  <svg
                    className="w-8 h-8 text-slate-200 mb-2.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  <p className="text-xs font-medium text-slate-700">
                    Operational Log Clean
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No asynchronous hardware event logs registered.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  let alertMessage =
                    "Hardware pipeline dispatch event notification broadcasted.";
                  try {
                    const payload = JSON.parse(n.payload);
                    if (payload?.message) alertMessage = payload.message;
                  } catch {
                    // Fail-safe fallthrough text context logic bounds handled properly
                  }

                  const isUnread = n.status === "queued";

                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-slate-50/80 cursor-pointer transition-all duration-150 flex gap-3 group relative ${
                        isUnread
                          ? "bg-blue-50/20 border-l-2 border-blue-500"
                          : ""
                      }`}
                      onClick={() => {
                        onMarkAsRead(n.id);
                        setIsOpen(false);
                      }}
                    >
                      {/* Operational Context Graphical Indicators */}
                      <div className="mt-0.5 flex-shrink-0">
                        {isUnread ? (
                          <div className="h-6 w-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center">
                            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                          </div>
                        )}
                      </div>

                      {/* Content Structural Grid Blocks */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-relaxed text-slate-700 tracking-tight break-words ${isUnread ? "font-medium text-slate-900" : ""}`}
                        >
                          {alertMessage}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                            {new Date(n.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            •{" "}
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isUnread && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50/60 px-1.5 py-0.5 border border-blue-100 rounded opacity-80 group-hover:opacity-100 transition-opacity">
                              Awaiting Verification
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
