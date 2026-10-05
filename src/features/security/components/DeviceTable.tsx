"use client";

import { useEffect, useState } from "react";
import DeviceCard from "./DeviceCard";
import { getDevices, revokeDevice, type Device } from "../api";
import { getDeviceInfo } from "@/features/auth/index";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/toast";
import { isNetworkFailure, loadWithOfflineSnapshot } from "@/lib/sync/offline-reference-cache";
import { OfflineSnapshotNotice } from "@/components/sync/offline-snapshot-notice";

const ITEMS_PER_PAGE = 6;



function formatOS(userAgent: string) {
  if (!userAgent) return "-";

  let os = "Unknown";
  let browser = "Unknown";

  // ---------- Operating System ----------
  const osInfo = userAgent.match(/\((.*?)\)/)?.[1] ?? "";

  if (/Android/i.test(osInfo)) {
    os = "Android";
  } else if (/(iPhone|iPad|iPod)/i.test(osInfo)) {
    os = "iOS";
  } else if (/Mac OS X|Macintosh/i.test(osInfo)) {
    os = "macOS";
  } else if (/Windows/i.test(osInfo)) {
    os = "Windows";
  } else if (/Linux/i.test(osInfo)) {
    os = "Linux";
  } else if (osInfo) {
    // Fallback: show the first part inside ()
    os = osInfo.split(";")[0].trim();
  }

  // ---------- Browser ----------
  const browserMatch = userAgent.match(
    /(Edg|Chrome|Firefox|Safari|Opera)\/[\d.]+/i
  );

  if (browserMatch) {
    browser = browserMatch[1]
      .replace("Edg", "Edge")
      .replace("OPR", "Opera");
  }

  return `${os} • ${browser}`;
}

export default function DeviceTable() {
  const [devices, setDevices] = useState<Device[]>([]);
  const currentDeviceIdentifier = getDeviceInfo().deviceIdentifier;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingRevokeDevice, setPendingRevokeDevice] = useState<Device | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadDevices = async (): Promise<void> => {
    setError(null);
    try {
      const { data, savedAt } = await loadWithOfflineSnapshot("security:devices", () => getDevices());
      setDevices(data);
      setSnapshotAt(savedAt);
    } catch (error: any) {
      if (isNetworkFailure(error)) {
        setError("You are offline and no saved device list exists on this device yet. Open this page once while online.");
        return;
      }
      toast.error("Could not load devices. Please try again.");
      setError("Could not load devices. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevokeClick = (device: Device) => {
    setPendingRevokeDevice(device);
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevokeDevice) return;

    try {
      setIsRevoking(true);
      await revokeDevice(pendingRevokeDevice.id);
      toast.success("The device has been revoked successfully.");
      setPendingRevokeDevice(null);
      await loadDevices();
    } catch (error: any) {
      toast.error(error.message || "Unable to revoke the selected device.");
    } finally {
      setIsRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 h-6 w-48 rounded bg-gray-200"></div>
            <div className="mb-3 h-4 w-32 rounded bg-gray-200"></div>
            <div className="mb-2 h-4 w-40 rounded bg-gray-200"></div>
            <div className="h-4 w-36 rounded bg-gray-200"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        <p className="mb-3">{error}</p>
        <button
          onClick={loadDevices}
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        No active devices found.
      </div>
    );
  }

    const sortedDevices = [...devices].sort((a, b) => {
    if (a.deviceIdentifier === currentDeviceIdentifier) return -1;
    if (b.deviceIdentifier === currentDeviceIdentifier) return 1;

    return (
      new Date(b.lastSeenAt).getTime() -
      new Date(a.lastSeenAt).getTime()
    );
  });

    const totalPages = Math.ceil(sortedDevices.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDevices = sortedDevices.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  return (
    <div>
    {snapshotAt && <OfflineSnapshotNotice savedAt={snapshotAt} note="Revoking a device needs an internet connection." />}
    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {paginatedDevices.map((device) => (
        <DeviceCard
          key={device.id}
          deviceName={device.deviceName ?? "Unknown Device"}
          deviceType={device.deviceType ?? "-"}
          operatingSystem={
            device.os ? formatOS(device.os) : "-"
          }
          appVersion={device.appVersion ?? "-"}
          lastSeen={new Date(device.lastSeenAt).toLocaleString()}
          isCurrentDevice={
            device.deviceIdentifier === currentDeviceIdentifier
          }
          onRevoke={() => handleRevokeClick(device)}
        />
      ))}
    </div>


      {totalPages > 1 && (
  <div className="mt-8 flex items-center justify-center gap-2">
    <button
      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
      disabled={currentPage === 1}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-300"
    >
      Previous  
    </button>

    {Array.from({ length: totalPages }, (_, index) => (
      <button
        key={index}
        onClick={() => setCurrentPage(index + 1)}
        className={`h-10 w-10 rounded-md text-sm font-medium transition ${
          currentPage === index + 1
            ? "bg-[#15803D] text-white"
            : "border border-gray-300 bg-white hover:bg-gray-300"
        }`}
      >
        {index + 1}
      </button>
    ))}

    <button
      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
      disabled={currentPage === totalPages}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-300"
    >
      Next
    </button>
  </div>
)}

      <ConfirmModal
        isOpen={Boolean(pendingRevokeDevice)}
        title="Revoke Device Access"
        description={
          pendingRevokeDevice
            ? `Are you sure you want to revoke access for "${pendingRevokeDevice.deviceName || "this device"}"? The user will need to sign in again to access the account.`
            : ""
        }
        confirmText={isRevoking ? "Revoking..." : "Revoke Access"}
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmRevoke}
        onCancel={() => !isRevoking && setPendingRevokeDevice(null)}
      />
    </div>
  );
}