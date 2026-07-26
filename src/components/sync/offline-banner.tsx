"use client";

import { useOnlineStatus } from "@/lib/connectivity/online-status";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-center text-sm font-medium text-yellow-900">
      You are offline. Changes will sync when internet returns.
    </div>
  );
}
