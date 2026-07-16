"use client";

import { useEffect, useState } from "react";
import DeviceCard from "./DeviceCard";
import { getDevices, revokeDevice, type Device } from "../api";
import { getDeviceInfo } from "@/features/auth/index";
import Swal from "sweetalert2";

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
  const [currentPage, setCurrentPage] = useState(1);

  const loadDevices = async (): Promise<void> => {
    try {
      const data = await getDevices();
      setDevices(data);
    } catch (error) {
      console.error("Failed to load devices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (device: Device) => {
    const result = await Swal.fire({
  title: "Do you want to revoke?",
  text: `The user will need to sign in again to access the account.`,
  icon: "warning",
  showCancelButton: true,
  confirmButtonText: "Revoke",
  cancelButtonText: "Cancel",
  confirmButtonColor: "#2ab05b",
  cancelButtonColor: "#8d96a6",
   
});

if (!result.isConfirmed) return;

    try {
      await revokeDevice(device.id);

      await Swal.fire({
        icon: "success",
        title: "Device Revoked",
        text: "The device has been revoked successfully.",
        timer: 1800,
        showConfirmButton: false,
       
      });

      // Refresh the device list
      await loadDevices();
    } catch (error) {
      console.error("Failed to revoke device:", error);
      
      await Swal.fire({
        icon: "error",
        title: "Revoke Failed",
        text: "Unable to revoke the selected device.",
        confirmButtonColor: "#dc2626",
        
      });

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
          onRevoke={() => handleRevoke(device)}
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

    </div>
  );
}

