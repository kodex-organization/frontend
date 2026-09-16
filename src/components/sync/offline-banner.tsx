"use client";

import { useConnectionStatus } from "@/lib/connectivity/online-status";

export function OfflineBanner() {
  const status = useConnectionStatus();

  if (status !== 'offline') {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-center text-sm font-medium text-yellow-900 print:hidden">
      Sync server unavailable. Pending changes remain on this device until the connection returns.
    </div>
  );
}
